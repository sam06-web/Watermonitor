import json
import os
import tempfile
import zipfile

import numpy as np
import requests
import shapefile
from flask import Blueprint, jsonify, request

swot_bp = Blueprint('swot', __name__)

CMR_URL = os.getenv('SWOT_CMR_URL', 'https://cmr.earthdata.nasa.gov/search/granules.json')
CACHE_DIR = os.getenv('SWOT_CACHE_DIR', os.path.join(os.path.dirname(__file__), '..', 'server', 'cache', 'swot'))


def _cmr_search(lat, lng):
    """Find the latest SWOT L2 HR RiverSP Reach granule intersecting the point."""
    params = {
        'short_name': 'SWOT_L2_HR_RiverSP_2.0',
        'bounding_box': f'{lng},{lat},{lng},{lat}',
        'page_size': 8,
        'sort_key': '-start_date',
        'pretty': True
    }
    response = requests.get(CMR_URL, params=params, timeout=30)
    response.raise_for_status()
    reaches = []
    for entry in response.json().get('feed', {}).get('entry', []):
        if 'Reach' not in entry.get('title', ''):
            continue
        zip_href = next(
            (link.get('href') for link in entry.get('links', [])
             if link.get('rel', '').endswith('/data#')
             and 'protected' in link.get('href', '')
             and link.get('href', '').startswith('https://')
             and link.get('href', '').endswith('.zip')),
            None
        )
        if not zip_href:
            continue
        reaches.append({
            'id': entry.get('id'),
            'title': entry.get('title'),
            'start': entry.get('time_start'),
            'end': entry.get('time_end'),
            'size_mb': round(float(entry.get('granule_size') or 0), 1),
            'zip_url': zip_href
        })
    return reaches


def _download_zip(zip_url, token):
    """Download the granule zip once, caching it on disk keyed by granule id."""
    granule_id = zip_url.rsplit('/', 1)[-1].replace('.zip', '')
    os.makedirs(CACHE_DIR, exist_ok=True)
    cached = os.path.join(CACHE_DIR, f'{granule_id}.zip')
    if os.path.exists(cached) and os.path.getsize(cached) > 1024:
        return cached

    headers = {'Authorization': f'Bearer {token}'}
    with requests.get(zip_url, headers=headers, stream=True, timeout=60) as response:
        response.raise_for_status()
        with open(cached, 'wb') as handle:
            for chunk in response.iter_content(chunk_size=1 << 20):
                handle.write(chunk)
    return cached


def _extract_shp(zip_path):
    """Extract the shapefile components from the granule zip to a temp directory."""
    temp_dir = tempfile.mkdtemp(prefix='swot-shp-')
    with zipfile.ZipFile(zip_path) as archive:
        shp_name = next((name for name in archive.namelist() if name.endswith('.shp')), None)
        if not shp_name:
            raise ValueError('No shapefile found in SWOT granule zip')
        for name in ('shp', 'dbf', 'shx', 'prj'):
            candidate = shp_name[:-4] + '.' + name
            if candidate in archive.namelist():
                archive.extract(candidate, temp_dir)
    return os.path.join(temp_dir, shp_name)


def _field(record, name):
    try:
        return record[name]
    except (KeyError, IndexError, AttributeError):
        return None


def _parse_reach_metrics(shp_path, lat, lng):
    """Read the real SWOT reach attributes and pick the reach nearest the coordinates."""
    reader = shapefile.Reader(shp_path)
    records = reader.records()

    lats = np.asarray([_field(record, 'p_lat') for record in records], dtype=float)
    lons = np.asarray([_field(record, 'p_lon') for record in records], dtype=float)

    distances = np.sqrt((lats - lat) ** 2 + np.cos(np.radians(lat)) * (lons - lng) ** 2)
    index = int(np.nanargmin(distances))
    reach = records[index]

    def value(*names):
        for name in names:
            field_value = _field(reach, name)
            if field_value not in (None, '') and _is_number(field_value):
                return float(field_value)
        return None

    result = {
        'reach_id': int(_field(reach, 'reach_id')) if _is_number(_field(reach, 'reach_id')) else None,
        'river_name': str(_field(reach, 'river_name') or ''),
        'lat': float(_field(reach, 'p_lat')) if _is_number(_field(reach, 'p_lat')) else lat,
        'lng': float(_field(reach, 'p_lon')) if _is_number(_field(reach, 'p_lon')) else lng,
        'width_m': value('width', 'dwidth'),
        'width_uncert_m': value('width_u'),
        'wse_m': value('wse', 'height'),
        'wse_uncert_m': value('wse_u'),
        'slope_m_m': value('slope'),
        'slope_uncert_m_m': value('slope_u'),
        'discharge_m3_s': value('dschg_m', 'dschg_c', 'dschg_gc', 'dschg_gm')
    }
    return result


def _is_number(value):
    if value is None:
        return False
    try:
        number = float(value)
        return number == number and abs(number) < 1e11
    except (TypeError, ValueError):
        return False


@swot_bp.post('/process')
def process():
    """POST /swot/process — real SWOT river reach metrics for a coordinate.

    Body: { lat, lng, token }
    Token: NASA Earthdata bearer token (required to download granules).
    """
    body = request.get_json(silent=True) or {}
    lat = body.get('lat')
    lng = body.get('lng')
    token = body.get('token') or os.getenv('NASA_EARTHDATA_TOKEN')
    if not _is_number(lat) or not _is_number(lng):
        return jsonify({'error': 'Provide numeric lat and lng'}), 400
    if not token:
        return jsonify({'source': 'unavailable', 'error': 'NASA_EARTHDATA_TOKEN is not configured'}), 200

    try:
        granules = _cmr_search(float(lat), float(lng))
        if not granules:
            return jsonify({'source': 'unavailable', 'error': 'No SWOT pass covers this location recently'}), 200

        granule = granules[0]
        zip_path = _download_zip(granule['zip_url'], token)
        shp_path = _extract_shp(zip_path)
        try:
            metrics = _parse_reach_metrics(shp_path, float(lat), float(lng))
        finally:
            import shutil
            shutil.rmtree(os.path.dirname(shp_path), ignore_errors=True)

        return jsonify({
            'source': 'real',
            'granule': {
                'id': granule['id'],
                'title': granule['title'],
                'start': granule['start'],
                'end': granule['end'],
                'size_mb': granule['size_mb']
            },
            **metrics
        })
    except Exception as error:
        return jsonify({'source': 'unavailable', 'error': f'SWOT processing failed: {error}'}), 200


def _register(app):
    app.register_blueprint(swot_bp, url_prefix='/swot')