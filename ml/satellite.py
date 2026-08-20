import base64
import io
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import numpy as np
import rasterio
import requests
from flask import Blueprint, jsonify, request
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

satellite_bp = Blueprint('satellite', __name__)

STAC_SEARCH_URL = os.getenv('SATELLITE_STAC_URL', 'https://planetarycomputer.microsoft.com/api/stac/v1/search')
SAS_TOKEN_URL = os.getenv('SATELLITE_SAS_TOKEN_URL', 'https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a')
EARTH_SEARCH_URL = os.getenv('EARTH_SEARCH_STAC_URL', 'https://earth-search.aws.element84.com/v1/search')

BANDS_10M = ['B02', 'B03', 'B04', 'B08']
BANDS_20M = ['B11']
REFLECTANCE_SCALE = 10000.0
PIXEL_AREA_M2 = 10.0 * 10.0
MAX_IMAGE_WIDTH = 2000
MAX_IMAGE_OUTPUT = 900
OVERVIEW_LEVEL = 1
_token_cache = {'token': None, 'expires': 0.0}


class _TTLCache(dict):
    """Small in-memory cache with a fixed expiry; expired keys are dropped on get."""

    def __init__(self, ttl_seconds):
        super().__init__()
        self.ttl = ttl_seconds

    def get(self, key, default=None):
        entry = dict.get(self, key)
        if entry is None:
            return default
        value, expires = entry
        if time.time() >= expires:
            dict.pop(self, key, None)
            return default
        return value

    def set(self, key, value):
        dict.__setitem__(self, key, (value, time.time() + self.ttl))


PROCESS_CACHE = _TTLCache(6 * 60 * 60)


def _search_stac(bbox, start, end, max_cloud, limit=12, ascending=False, max_pages=1):
    """Search Sentinel-2 L2A scenes over a bbox, trying Planetary Computer then Earth Search."""
    payload = lambda page: {
        'collections': ['sentinel-2-l2a'],
        'bbox': bbox,
        'datetime': f'{start}T00:00:00Z/{end}T23:59:59Z',
        'query': {'eo:cloud_cover': {'lte': max_cloud}},
        'sortby': [{'field': 'properties.datetime', 'direction': 'asc' if ascending else 'desc'}],
        'limit': limit,
        **({'page': page} if page > 1 else {})
    }
    for url in (STAC_SEARCH_URL, EARTH_SEARCH_URL):
        try:
            collected = []
            for page in range(1, max_pages + 1):
                response = requests.post(url, json=payload(page), timeout=30)
                if not response.ok:
                    break
                page_features = response.json().get('features', [])
                collected.extend(page_features)
                if len(page_features) < limit:
                    break
            if collected:
                return collected
        except requests.RequestException:
            continue
    return []


def _sign_asset(href):
    if _token_cache['token'] and _token_cache['expires'] and time.time() < _token_cache['expires']:
        return f'{href}?{_token_cache["token"]}'
    try:
        resp = requests.get(SAS_TOKEN_URL, timeout=20).json()
        token = resp.get('token')
        if token:
            _token_cache['token'] = token
            # Honour the real SAS lifetime. Anonymous Planetary Computer
            # tokens expire in ~45 minutes; assuming a 20-hour validity makes
            # every band read return HTTP 403 once the cached token goes stale.
            try:
                expiry = datetime.fromisoformat(str(resp.get('msft:expiry', '')).replace('Z', '+00:00'))
                ttl = min((expiry - datetime.now(timezone.utc)).total_seconds(), 3600)
            except (ValueError, TypeError):
                ttl = 2400  # 40-minute default
            _token_cache['expires'] = time.time() + max(ttl, 60)
            return f'{href}?{token}'
    except (requests.RequestException, ValueError):
        pass
    return href


def _pick_best_scene(features, bbox):
    """Pick the lowest cloud-cover scene whose footprint intersects the river bbox."""
    best = None
    for feature in features:
        footprint = feature.get('bbox')
        if not footprint:
            continue
        # lon/lat intersection with requested bbox
        left = max(bbox[0], footprint[0])
        bottom = max(bbox[1], footprint[1])
        right = min(bbox[2], footprint[2])
        top = min(bbox[3], footprint[3])
        if left >= right or bottom >= top:
            continue
        cloud = float(feature.get('properties', {}).get('eo:cloud_cover') or 0)
        if best is None or cloud < best['cloud']:
            best = {'scene': feature, 'cloud': cloud,
                    'overlap': [left, bottom, right, top]}
    return best


def _window_for(src, overlap_projected):
    """Intersect the projected overlap with a dataset and return its pixel window."""
    left = max(overlap_projected[0], src.bounds.left)
    bottom = max(overlap_projected[1], src.bounds.bottom)
    right = min(overlap_projected[2], src.bounds.right)
    top = min(overlap_projected[3], src.bounds.top)
    if left >= right or bottom >= top:
        return None
    return from_bounds(left, bottom, right, top, transform=src.transform)


def _read_bands(assets, overlap_projected):
    """Read clipped band arrays aligned to a shared target grid.
    B04 fixes the target shape; coarser 20m bands (B11) are resampled to match."""
    signed = {band: _sign_asset(assets[band]['href']) for band in BANDS_10M + BANDS_20M if band in assets}
    if len(signed) < 4:
        return None

    with rasterio.open(signed['B04'], overview_level=OVERVIEW_LEVEL) as src:
        window = _window_for(src, overlap_projected)
        if window is None:
            return None
        target_shape = (int(round(window.height)), int(round(window.width)))
        b04 = src.read(1, window=window, out_shape=target_shape,
                       resampling=Resampling.average).astype(np.float64)

    def read_band(url):
        with rasterio.open(url, overview_level=OVERVIEW_LEVEL) as src:
            window = _window_for(src, overlap_projected)
            if window is None:
                return None
            return src.read(1, window=window, out_shape=target_shape,
                            resampling=Resampling.average).astype(np.float64)

    with ThreadPoolExecutor(max_workers=5) as executor:
        others = {band: url for band, url in signed.items() if band != 'B04'}
        futures = {band: executor.submit(read_band, url) for band, url in others.items()}
        result = {'B04': b04}
        for band, future in futures.items():
            array = future.result()
            if array is None:
                return None
            result[band] = array
        return result


def _percent_stretch(band, low=2, high=98):
    band = band.copy()
    valid = band[band > 0]
    if valid.size == 0:
        return np.zeros_like(band)
    lo = np.percentile(valid, low)
    hi = np.percentile(valid, high)
    if hi <= lo:
        hi = lo + 1e-6
    return np.clip((band - lo) / (hi - lo), 0, 1)


def _colorize(index, palette):
    """Map a normalized 0..1 index array to an RGB uint8 array."""
    h, w = index.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for channel in range(3):
        rgb[..., channel] = np.clip(palette[channel](index), 0, 255).astype(np.uint8)
    return rgb


def _encode_png(rgb_array):
    image = Image.fromarray(rgb_array, 'RGB')
    if max(image.size) > MAX_IMAGE_OUTPUT:
        image.thumbnail((MAX_IMAGE_OUTPUT, MAX_IMAGE_OUTPUT), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    return base64.b64encode(buffer.getvalue()).decode('ascii')


def _render_images(bands):
    red = bands['B04'] / REFLECTANCE_SCALE
    green = bands['B03'] / REFLECTANCE_SCALE
    blue = bands['B02'] / REFLECTANCE_SCALE
    nir = bands['B08'] / REFLECTANCE_SCALE

    ndwi = np.clip((green - nir) / (green + nir + 1e-6), -1, 1)
    ndvi = np.clip((nir - red) / (nir + red + 1e-6), -1, 1)

    # True colour RGB
    rgb = _percent_stretch(red), _percent_stretch(green), _percent_stretch(blue)
    rgb_image = np.stack([
        np.clip(rgb[0] * 255, 0, 255),
        np.clip(rgb[1] * 255, 0, 255),
        np.clip(rgb[2] * 255, 0, 255)
    ], axis=-1).astype(np.uint8)

    # False colour infrared (B08, B04, B03)
    fc = (_percent_stretch(nir), _percent_stretch(red), _percent_stretch(green))
    false_color_image = np.stack([
        np.clip(fc[0] * 255, 0, 255),
        np.clip(fc[1] * 255, 0, 255),
        np.clip(fc[2] * 255, 0, 255)
    ], axis=-1).astype(np.uint8)

    # NDWI water extraction with cyan-blue palette
    ndwi_norm = np.clip((ndwi + 1) / 2, 0, 1)
    ndwi_image = _colorize(ndwi_norm, [
        lambda v: np.clip(v * 130, 0, 255),
        lambda v: np.clip(180 - v * 40, 0, 255),
        lambda v: np.clip(120 + v * 135, 0, 255),
    ])

    images = {
        'rgb': _encode_png(rgb_image),
        'false_color': _encode_png(false_color_image),
        'ndwi': _encode_png(ndwi_image)
    }

    if 'B11' in bands:
        swir = bands['B11'] / REFLECTANCE_SCALE
        ndmi = np.clip((nir - swir) / (nir + swir + 1e-6), -1, 1)
        ndmi_norm = np.clip((ndmi + 1) / 2, 0, 1)
        moisture_image = _colorize(ndmi_norm, [
            lambda v: np.clip(20 + v * 90, 0, 255),
            lambda v: np.clip(70 + v * 160, 0, 255),
            lambda v: np.clip(40 + v * 100, 0, 255),
        ])
        images['moisture'] = _encode_png(moisture_image)
        ndmi_value = float(np.nanmean(ndmi[ndwi > -0.99]))
    else:
        ndmi_value = None

    return {
        'images': images,
        'ndwi': float(np.nanmean(ndwi[red + green + nir > 0])),
        'ndvi': float(np.nanmean(ndvi[red + green + nir > 0])),
        'ndmi': ndmi_value
    }


def _max_contiguous_run(boolean_array):
    """Vectorized length of the longest contiguous run of True along the last axis."""
    if boolean_array.size == 0 or not boolean_array.any():
        return 0
    padded = np.pad(boolean_array, ((0, 0), (1, 1)), mode='constant', constant_values=False)
    differences = np.diff(padded.astype(np.int8), axis=1)
    starts = np.argwhere(differences == 1)
    ends = np.argwhere(differences == -1)
    if starts.size == 0 or ends.size == 0:
        return 0
    lengths = ends[:, 1] - starts[:, 1]
    return int(lengths.max()) if lengths.size else 0


def _process_scene(best, assets, bbox, max_cloud):
    scene = best['scene']
    overlap = best['overlap']

    with rasterio.open(_sign_asset(assets['B04']['href']), overview_level=OVERVIEW_LEVEL) as src:
        crs = src.crs
        raster_bounds = src.bounds

    projected = transform_bounds('EPSG:4326', crs, *overlap)
    left = max(projected[0], raster_bounds.left)
    bottom = max(projected[1], raster_bounds.bottom)
    right = min(projected[2], raster_bounds.right)
    top = min(projected[3], raster_bounds.top)
    if left >= right or bottom >= top:
        return None
    overlap_projected = (left, bottom, right, top)

    bands = _read_bands(assets, overlap_projected)
    if bands is None:
        return None

    red = bands['B04'] / REFLECTANCE_SCALE
    green = bands['B03'] / REFLECTANCE_SCALE
    nir = bands['B08'] / REFLECTANCE_SCALE

    valid = red + green + nir > 0
    ndwi = np.clip((green - nir) / (green + nir + 1e-6), -1, 1)
    ndvi = np.clip((nir - red) / (nir + red + 1e-6), -1, 1)

    # Water mask from McFeeters NDWI
    water_mask = (ndwi > 0.05) & valid
    water_pixels = int(np.count_nonzero(water_mask))
    water_area_km2 = float(water_pixels * PIXEL_AREA_M2 / 1_000_000.0)

    river_width_m = float(_max_contiguous_run(water_mask) * 10.0)
    # Turbidity proxy: red-band reflectance over water (suspended sediment correlation)
    water_red = red[water_mask]
    red_reflectance = float(np.nanmean(water_red)) if water_red.size else 0.0
    turbidity_ntu = float(min(100.0, max(1.0, red_reflectance * 260.0)))

    render = _render_images(bands)

    properties = scene.get('properties', {})
    return {
        'source': 'real',
        'scene': {
            'id': scene['id'],
            'datetime': properties.get('datetime'),
            'cloud_cover': round(float(properties.get('eo:cloud_cover') or 0), 1),
            'platform': properties.get('platform') or 'Sentinel-2',
            'grid': '10m Multispectral (Level-2A BOA)'
        },
        'ndwi': render['ndwi'],
        'ndvi': render['ndvi'],
        'ndmi': render['ndmi'],
        'water_area_km2': round(water_area_km2, 2),
        'river_width_m': round(river_width_m, 1),
        'turbidity_ntu': round(turbidity_ntu, 1),
        'red_reflectance': round(red_reflectance, 4),
        'water_pixels': water_pixels,
        'images': render['images'],
        'bbox': overlap
    }


@satellite_bp.post('/process')
def process():
    """POST /satellite/process — compute real indices from the latest overlapping Sentinel-2 scene."""
    body = request.get_json(silent=True) or {}
    bbox = body.get('bbox')
    lat = body.get('lat')
    lng = body.get('lng')
    if not bbox or len(bbox) != 4:
        return jsonify({'error': 'Provide bbox as [west, south, east, north]'}), 400

    max_cloud = float(body.get('max_cloud') or 60)
    start = body.get('start') or '2026-05-01'
    end = body.get('end') or '2026-08-19'

    cache_key = (tuple(round(float(v), 3) for v in bbox), round(float(lat), 3), round(float(lng), 3), int(max_cloud), start, end)
    cached = PROCESS_CACHE.get(cache_key)
    if cached is not None:
        return jsonify(cached)

    features = _search_stac(bbox, start, end, max_cloud)
    if not features:
        result = {
            'source': 'unavailable',
            'error': 'No Sentinel-2 scenes found over the requested area within the cloud-cover limit'
        }
        PROCESS_CACHE.set(cache_key, result)
        return jsonify(result), 404

    best = _pick_best_scene(features, bbox)
    if best is None:
        result = {
            'source': 'unavailable',
            'error': 'No overlapping scene found for the requested water body'
        }
        PROCESS_CACHE.set(cache_key, result)
        return jsonify(result), 404

    result = _process_scene(best, best['scene']['assets'], bbox, max_cloud)
    if result is None:
        result = {
            'source': 'unavailable',
            'error': 'Failed to read spectral bands for the selected scene'
        }
        PROCESS_CACHE.set(cache_key, result)
        return jsonify(result), 502

    PROCESS_CACHE.set(cache_key, result)
    return jsonify(result)


@satellite_bp.post('/backfill')
def backfill():
    """POST /satellite/backfill — process every overlapping Sentinel-2 scene in a date range.

    Returns a JSON list of real observations (with embedded PNGs) for ingestion into
    the Node history store. Body: { bbox, lat, lng, max_cloud, start, end }.
    """
    body = request.get_json(silent=True) or {}
    bbox = body.get('bbox')
    lat = body.get('lat')
    lng = body.get('lng')
    if not bbox or len(bbox) != 4:
        return jsonify({'error': 'Provide bbox as [west, south, east, north]'}), 400

    max_cloud = float(body.get('max_cloud') or 60)
    start = body.get('start') or '2025-01-01'
    end = body.get('end') or datetime.utcnow().strftime('%Y-%m-%d')
    limit = int(body.get('limit') or 40)
    pages = int(body.get('pages') or 5)

    features = _search_stac(bbox, start, end, max_cloud, limit=limit, ascending=True, max_pages=pages)
    candidates = [_overlapping(feature, bbox) for feature in features]
    candidates = [candidate for candidate in candidates if candidate is not None]

    # Keep only the lowest-cloud scene per date BEFORE processing so a wide bbox
    # covering several Sentinel-2 tiles collapses to one representative pass per day.
    by_date = {}
    for candidate in candidates:
        scene_date = str(candidate['scene'].get('properties', {}).get('datetime', ''))[:10]
        cloud = candidate['cloud']
        if (scene_date not in by_date or cloud < by_date[scene_date]['cloud']):
            by_date[scene_date] = candidate
    candidates = [by_date[date_] for date_ in sorted(by_date)]

    observations = []
    errors = 0
    for candidate in candidates:
        result = _process_scene(candidate, candidate['scene']['assets'], bbox, max_cloud)
        if result is None:
            errors += 1
            continue
        observations.append(result)

    payload = {
        'source': 'real',
        'count': len(observations),
        'errors': errors,
        'start': start,
        'end': end,
        'observations': observations
    }
    return jsonify(payload)


def _overlapping(feature, bbox):
    footprint = feature.get('bbox')
    if not footprint:
        return None
    left = max(bbox[0], footprint[0])
    bottom = max(bbox[1], footprint[1])
    right = min(bbox[2], footprint[2])
    top = min(bbox[3], footprint[3])
    if left >= right or bottom >= top:
        return None
    cloud = float(feature.get('properties', {}).get('eo:cloud_cover') or 0)
    return {'scene': feature, 'cloud': cloud, 'overlap': [left, bottom, right, top]}


@satellite_bp.get('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'Sentinel-2 real-time processor'})


def _register(app):
    app.register_blueprint(satellite_bp, url_prefix='/satellite')
