import express from 'express';
import fs from 'fs';
import path from 'path';
import RiverDB from '../db/database.js';
import config from '../config/config.js';
import RiverGeoService from '../services/satelliteProviders/riverGeoService.js';
import HydrologyProvider from '../services/satelliteProviders/hydrologyProvider.js';
import AiAnalysisService from '../services/satelliteProviders/aiAnalysisService.js';

const router = express.Router();
const SATELLITE_REFRESH_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;
const SATELLITE_REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const IMAGE_CACHE_DIR = config.satellite.imageCacheDir;

// Tracks the last time a full satellite/SWOT reprocess was attempted per river so
// page loads never re-trigger an expensive pipeline more often than the cooldown.
const lastRefreshAttempt = new Map();

function safeFileName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function ensureCacheDir() {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

// Clamp the processing window to a small box centred on the river so each
// Sentinel-2 scene clips a focused reach instead of the whole basin. Seeded
// rivers store basin-wide bboxes (e.g. Cauvery spans several degrees) which
// makes every scene enormous to read and can push the ML processor past its
// chunk timeout. A tight window is also more representative of the river
// course, avoiding lakes/fields that inflate water-area and width estimates.
const MAX_BBOX_SPAN = 0.5;
function clampBbox(bbox, lat, lng) {
  const box = Array.isArray(bbox) ? bbox.map(Number) : null;
  if (!box || box.length !== 4 || !box.every(Number.isFinite)) {
    return [lng - 0.25, lat - 0.25, lng + 0.25, lat + 0.25];
  }
  let [west, south, east, north] = box;
  if (east - west > MAX_BBOX_SPAN) {
    const center = (west + east) / 2;
    west = center - MAX_BBOX_SPAN / 2;
    east = center + MAX_BBOX_SPAN / 2;
  }
  if (north - south > MAX_BBOX_SPAN) {
    const center = (south + north) / 2;
    south = center - MAX_BBOX_SPAN / 2;
    north = center + MAX_BBOX_SPAN / 2;
  }
  return [west, south, east, north];
}

function cachedImagePath(riverQuery, dateStr, type) {
  return path.join(IMAGE_CACHE_DIR, `${safeFileName(riverQuery)}-${dateStr}-${type}.png`);
}

function writeCachedImages(riverId, dateStr, images = {}) {
  ensureCacheDir();
  const urls = {};
  for (const [type, base64Data] of Object.entries(images)) {
    const filename = `${safeFileName(riverId)}-${dateStr}-${type}.png`;
    fs.writeFileSync(path.join(IMAGE_CACHE_DIR, filename), Buffer.from(base64Data, 'base64'));
    urls[type] = `/api/satellite/image?river=${encodeURIComponent(riverId)}&type=${type}&date=${encodeURIComponent(dateStr)}`;
  }
  return urls;
}

/**
 * Fetch real SWOT reach metrics (width, water surface elevation, slope) from
 * the Python processor. Requires a NASA Earthdata token; returns null otherwise.
 */
async function fetchSwotMetrics(river, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000);
  try {
    const response = await fetch(`${config.ml.url}/swot/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: Number(river.latitude), lng: Number(river.longitude), token }),
      signal: controller.signal
    });
    const data = await response.json();
    return data.source === 'real' ? data : null;
  } catch (error) {
    console.warn(`SWOT enrichment failed for ${river.name}: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper to resolve a river from query parameter (id, name, or OSM search).
 * Returns null if nothing is found — never falls back to a hardcoded default.
 */
async function resolveRiver(req) {
  const query = req.query.river || req.query.river_id || req.query.name;
  if (!query) return null;

  let river = await RiverDB.getRiverById(query.toLowerCase());
  if (!river) river = await RiverDB.getRiverByName(query);
  if (!river) {
    const searchRes = await RiverGeoService.searchRivers(query);
    if (searchRes.length > 0) river = searchRes[0];
  }
  return river || null;
}

/**
 * GET /api/satellite/search?river=
 * Search global rivers, lakes, reservoirs, and other named water bodies.
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.river || req.query.q || '';
    const rivers = await RiverGeoService.searchRivers(query);
    res.json({
      success: true,
      count: rivers.length,
      rivers: rivers.map(r => ({
        id: r.id,
        name: r.name,
        state: r.state,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        bbox: typeof r.bbox === 'string' ? JSON.parse(r.bbox) : r.bbox,
        length_km: r.length_km,
        basin: r.basin,
        waterType: r.water_type || 'river',
        description: r.description
      }))
    });
  } catch (error) {
    console.error('River search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/satellite/latest?river=
 * Get the newest available satellite observation and hydrological parameters
 */
router.get('/latest', async (req, res) => {
  try {
    const river = await resolveRiver(req);
    if (!river) {
      return res.status(404).json({ success: false, message: 'River not found' });
    }

    let observation = await RiverDB.getLatestObservation(river.id);
    const isObservationReal = observation?.raw_metadata?.includes('"source":"real"') ?? false;
    const observationTime = new Date(observation?.image_timestamp || observation?.image_date || 0).getTime();
    const isObservationStale = !Number.isFinite(observationTime) || Date.now() - observationTime >= SATELLITE_REFRESH_INTERVAL_MS;

    // Stale-while-revalidate: if a real observation exists, respond immediately and
    // reprocess the pipeline in the background at most once per cooldown window.
    // This keeps page loads instant even when the underlying scene is old or the
    // ML processor is cold. Without any real observation we must block instead.
    const lastAttempt = lastRefreshAttempt.get(river.id) || 0;
    const shouldRefresh = isObservationStale && Date.now() - lastAttempt >= SATELLITE_REFRESH_COOLDOWN_MS;
    if (isObservationReal && observation) {
      if (shouldRefresh) {
        lastRefreshAttempt.set(river.id, Date.now());
        refreshRiverObservation(river)
          .then(() => {
            return RiverDB.getLatestObservation(river.id);
          })
          .then(obs => {
            observation = obs;
          })
          .catch(error => console.warn(`Real satellite refresh failed for ${river.name}: ${error.message}`));
      }
    } else {
      lastRefreshAttempt.set(river.id, Date.now());
      try {
        observation = await refreshRiverObservation(river);
      } catch (error) {
        console.warn(`Real satellite refresh failed for ${river.name}: ${error.message}`);
        if (!observation) {
          const geometry = typeof river.geometry === 'string' ? JSON.parse(river.geometry) : river.geometry;
          const bbox = typeof river.bbox === 'string' ? JSON.parse(river.bbox) : river.bbox;
          return res.status(503).json({
            success: false,
            message: 'No real satellite observation is available yet. The live sensor dashboard remains fully operational.',
            error: error.message,
            river: {
              id: river.id,
              name: river.name,
              state: river.state,
              country: river.country,
              latitude: river.latitude,
              longitude: river.longitude,
              bbox: bbox,
              geometry: geometry,
              length_km: river.length_km,
              basin: river.basin
            }
          });
        }
      }
    }

    const geometry = typeof river.geometry === 'string' ? JSON.parse(river.geometry) : river.geometry;
    const bbox = typeof river.bbox === 'string' ? JSON.parse(river.bbox) : river.bbox;

    res.json({
      success: true,
      river: {
        id: river.id,
        name: river.name,
        state: river.state,
        country: river.country,
        latitude: river.latitude,
        longitude: river.longitude,
        bbox: bbox,
        geometry: geometry,
        length_km: river.length_km,
        basin: river.basin
      },
      observation: {
        id: observation.id,
        satelliteName: observation.satellite_name,
        sensor: observation.sensor,
        imageDate: observation.image_date,
        imageTimestamp: observation.image_timestamp,
        cloudCover: observation.cloud_cover,
        resolution: observation.resolution,
        ndwi: observation.ndwi,
        ndvi: observation.ndvi,
        waterAreaSqKm: observation.water_area,
        riverWidthMeters: observation.river_width,
        surfaceTemperatureC: observation.temperature,
        turbidityNtu: observation.turbidity,
        floodStatus: observation.flood_status,
        floodRiskPct: observation.flood_risk_pct,
        waterLevelMeters: observation.water_level,
        healthScore: observation.health_score,
        waterAvailability: observation.water_availability,
        pollutionRisk: observation.pollution_risk,
        aiSummary: observation.ai_summary,
        aiRecommendation: observation.ai_recommendation,
        imageUrl: observation.image_url,
        ndwiImageUrl: observation.ndwi_image_url,
        falseColorImageUrl: observation.false_color_image_url,
        prevImageUrl: observation.prev_image_url,
        rawMetadata: observation.raw_metadata ? JSON.parse(observation.raw_metadata) : null
      }
    });
  } catch (error) {
    console.error('Get latest satellite observation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/satellite/history?river=&period=
 * Returns historical observations for 7 Days, 30 Days, 6 Months (180 Days), or 1 Year (365 Days)
 */
router.get('/history', async (req, res) => {
  try {
    const river = await resolveRiver(req);
    if (!river) return res.status(400).json({ success: false, message: 'Provide a river name or id.' });
    const periodStr = (req.query.period || '30d').toLowerCase();

    let limitDays = 30;
    if (periodStr === '7d' || periodStr === '7days') limitDays = 7;
    else if (periodStr === '30d' || periodStr === '30days') limitDays = 30;
    else if (periodStr === '6m' || periodStr === '6months') limitDays = 180;
    else if (periodStr === '1y' || periodStr === '1year') limitDays = 365;

    const rawHistory = await RiverDB.getHistory(river.id, limitDays);

    const history = rawHistory.map(item => ({
      id: item.id,
      date: item.image_date,
      timestamp: item.image_timestamp,
      satelliteName: item.satellite_name,
      waterArea: item.water_area,
      temperature: item.temperature,
      turbidity: item.turbidity,
      ndwi: item.ndwi,
      ndvi: item.ndvi,
      riverWidth: item.river_width,
      cloudCover: item.cloud_cover,
      floodRiskPct: item.flood_risk_pct,
      healthScore: item.health_score
    }));

    res.json({
      success: true,
      river: { id: river.id, name: river.name },
      period: periodStr,
      limitDays: limitDays,
      totalCount: history.length,
      history: history
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/satellite/statistics?river=
 * Returns aggregate metrics, variance, and trend statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const river = await resolveRiver(req);
    if (!river) return res.status(400).json({ success: false, message: 'Provide a river name or id.' });
    const data = await RiverDB.getStatistics(river.id);

    res.json({
      success: true,
      river: { id: river.id, name: river.name },
      statistics: data.stats,
      latest: data.latest ? {
        satellite: data.latest.satellite_name,
        date: data.latest.image_date,
        ndwi: data.latest.ndwi,
        waterArea: data.latest.water_area,
        turbidity: data.latest.turbidity,
        temperature: data.latest.temperature,
        healthScore: data.latest.health_score,
        floodStatus: data.latest.flood_status
      } : null
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/satellite/refresh
 * Fetches latest real satellite observation from STAC / Open-Meteo and updates the database
 */
router.post('/refresh', async (req, res) => {
  try {
    const river = await resolveRiver(req);
    if (!river) return res.status(400).json({ success: false, message: 'Provide a river name or id.' });
    const newObs = await refreshRiverObservation(river);

    res.json({
      success: true,
      message: `Successfully retrieved latest satellite pass for ${river.name}`,
      observation: newObs
    });
  } catch (error) {
    console.error('Refresh satellite observation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper to fetch a REAL Sentinel-2 observation for a river.
 * The Python service queries the STAC catalog, reads the actual band COGs
 * clipped to the river bbox, and computes NDVI/NDWI/water area/turbidity
 * plus real rendered images. No values are synthesized here.
 */
async function refreshRiverObservation(river) {
  let bbox = river.bbox;
  try {
    bbox = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;
  } catch {
    bbox = null;
  }
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    bbox = [
      Number(river.longitude) - 0.5,
      Number(river.latitude) - 0.5,
      Number(river.longitude) + 0.5,
      Number(river.latitude) + 0.5
    ];
  }
  bbox = clampBbox(bbox, Number(river.latitude), Number(river.longitude));

  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let real;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    const response = await fetch(`${config.ml.url}/satellite/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bbox,
        lat: Number(river.latitude),
        lng: Number(river.longitude),
        max_cloud: 80,
        start,
        end
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`Satellite processor returned HTTP ${response.status}`);
    }
    real = await response.json();
  } catch (error) {
    console.error('Real satellite processing failed:', error.message);
    throw new Error('Real Sentinel-2 processing unavailable. No observation was synthesized.');
  }

  if (real.source !== 'real') {
    throw new Error(real.error || 'No real Sentinel-2 scene was available for this water body.');
  }

  await persistRealObservation(river, real, bbox);
  return await RiverDB.getLatestObservation(river.id);
}

/**
 * Persist one REAL satellite scene as a satellite_observations row, computing the
 * AI health/flood/pollution synthesis from the measured indices. Optional live
 * SWOT + hydrology enrichment is fetched for the newest scene only (backfill rows
 * keep temperature null when enrichment is skipped to stay fast).
 */
async function persistRealObservation(river, real, bbox, { enrichment = 'live' } = {}) {
  let hydroData = null;
  let swotData = null;
  const swotToken = config.providers.swot.token || config.providers.swot.podaacApiKey;
  const sceneDate = String(real.scene?.datetime || new Date().toISOString()).slice(0, 10);
  if (enrichment === 'historical') {
    hydroData = await HydrologyProvider.getHistoricalHydrology(river.latitude, river.longitude, sceneDate).catch(() => null);
  } else {
    [hydroData, swotData] = await Promise.all([
      HydrologyProvider.getSurfaceHydrology(river.latitude, river.longitude).catch(() => null),
      swotToken ? fetchSwotMetrics(river, swotToken) : Promise.resolve(null)
    ]);
  }

  const existingScene = await RiverDB.getObservationByScene(river.id, sceneDate, real.scene?.platform);

  const temperature = Number.isFinite(Number(hydroData?.surfaceTemp)) ? Number(hydroData.surfaceTemp) : null;
  const riverWidth = Number.isFinite(Number(swotData?.width_m)) ? Number(swotData.width_m) : real.river_width_m;

  const aiResult = AiAnalysisService.synthesizeAnalysis({
    riverName: river.name,
    ndwi: real.ndwi,
    ndvi: real.ndvi,
    waterArea: real.water_area_km2,
    baselineArea: real.water_area_km2,
    turbidity: real.turbidity_ntu,
    temperature,
    riverWidth,
    cloudCover: real.scene?.cloud_cover ?? 0,
    recentPrecipitation: hydroData?.dailyRainfall || 0
  });

  if (existingScene) {
    const storedTemp = Number(existingScene.temperature);
    const needsHistoricalTemp = enrichment === 'historical' && (!Number.isFinite(storedTemp) || storedTemp <= 0);
    if (needsHistoricalTemp || enrichment === 'historical') {
      await RiverDB.updateObservation({
        id: existingScene.id,
        temperature: temperature ?? 0,
        flood_status: aiResult.floodStatus,
        flood_risk_pct: aiResult.floodRiskPct,
        health_score: aiResult.healthScore,
        water_availability: aiResult.waterAvailability,
        pollution_risk: aiResult.pollutionRisk,
        ai_summary: aiResult.summary,
        ai_recommendation: aiResult.recommendation,
        raw_metadata: JSON.stringify({ source: 'real', scene: real.scene, hydrology: hydroData, provider: 'Sentinel-2 L2A (Planetary Computer / AWS)', refreshedAt: new Date().toISOString() })
      });
    }
    return;
  }

  const imageUrls = writeCachedImages(river.id, sceneDate, real.images || {});

  const prevDate = new Date(sceneDate);
  prevDate.setDate(prevDate.getDate() - 15);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const newObsData = {
    river_id: river.id,
    river_name: river.name,
    latitude: river.latitude,
    longitude: river.longitude,
    bbox: typeof bbox === 'string' ? bbox : JSON.stringify(bbox),
    satellite_name: real.scene?.platform || 'Sentinel-2',
    sensor: real.scene?.grid || 'MSI Level-2A (BOA Reflectance)',
    image_date: sceneDate,
    image_timestamp: real.scene?.datetime || new Date().toISOString(),
    cloud_cover: real.scene?.cloud_cover ?? 0,
    resolution: real.scene?.grid || '10m Multispectral',
    ndwi: real.ndwi,
    ndvi: real.ndvi,
    water_area: real.water_area_km2,
    river_width: riverWidth,
    temperature: temperature ?? 0,
    turbidity: real.turbidity_ntu,
    flood_status: aiResult.floodStatus,
    flood_risk_pct: aiResult.floodRiskPct,
    water_level: Number.isFinite(Number(swotData?.wse_m)) ? Number(swotData.wse_m) : null,
    health_score: aiResult.healthScore,
    water_availability: aiResult.waterAvailability,
    pollution_risk: aiResult.pollutionRisk,
    ai_summary: aiResult.summary,
    ai_recommendation: aiResult.recommendation,
    image_url: imageUrls.rgb || `/api/satellite/image?river=${encodeURIComponent(river.id)}&type=rgb&date=${sceneDate}`,
    ndwi_image_url: imageUrls.ndwi || `/api/satellite/image?river=${encodeURIComponent(river.id)}&type=ndwi&date=${sceneDate}`,
    false_color_image_url: imageUrls.false_color || `/api/satellite/image?river=${encodeURIComponent(river.id)}&type=false_color&date=${sceneDate}`,
    prev_image_url: `/api/satellite/image?river=${encodeURIComponent(river.id)}&type=rgb&date=${prevDateStr}`,
    raw_metadata: JSON.stringify({
      source: 'real',
      scene: real.scene,
      swot: swotData,
      bbox,
      hydrology: hydroData,
      provider: 'Sentinel-2 L2A (Planetary Computer / AWS) + NASA SWOT',
      refreshedAt: new Date().toISOString()
    })
  };

  await RiverDB.insertObservation(newObsData);
}

/**
 * POST /api/satellite/backfill?river=
 * Ingests REAL historical Sentinel-2 observations across a date range so the
 * history chart is built from actual remote-sensing data, not placeholders.
 * Body: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } (default: last 180 days).
 */
router.post('/backfill', async (req, res) => {
  try {
    const river = await resolveRiver(req);
    if (!river) return res.status(400).json({ success: false, message: 'Provide a river name or id.' });
    let bbox = river.bbox;
    try {
      bbox = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;
    } catch {
      bbox = null;
    }
    if (!Array.isArray(bbox) || bbox.length !== 4) {
      bbox = [
        Number(river.longitude) - 0.3,
        Number(river.latitude) - 0.3,
        Number(river.longitude) + 0.3,
        Number(river.latitude) + 0.3
      ];
    }
    bbox = clampBbox(bbox, Number(river.latitude), Number(river.longitude));

    const end = req.body?.end || new Date().toISOString().split('T')[0];
    const start = req.body?.start || new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const fetchChunk = async (chunkStart, chunkEnd) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 230000);
      try {
        const chunkRes = await fetch(`${config.ml.url}/satellite/backfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bbox,
            lat: Number(river.latitude),
            lng: Number(river.longitude),
            max_cloud: 60,
            start: chunkStart,
            end: chunkEnd
          }),
          signal: controller.signal
        });
        return await chunkRes.json();
      } finally {
        clearTimeout(timer);
      }
    };

    const CHUNK_DAYS = 60;
    const chunkStartMs = new Date(start).getTime();
    const chunkEndMs = new Date(end).getTime();
    const chunks = [];
    for (let cursor = chunkStartMs; cursor <= chunkEndMs; cursor += CHUNK_DAYS * 24 * 60 * 60 * 1000) {
      const chunkEndDate = new Date(Math.min(cursor + CHUNK_DAYS * 24 * 60 * 60 * 1000 - 1, chunkEndMs)).toISOString().split('T')[0];
      chunks.push([new Date(cursor).toISOString().split('T')[0], chunkEndDate]);
    }

    let inserted = 0;
    let scenesFound = 0;
    let skipped = 0;
    let chunkErrors = [];
    for (const [chunkStart, chunkEnd] of chunks) {
      const payload = await fetchChunk(chunkStart, chunkEnd);
      if (payload.source !== 'real') {
        chunkErrors.push(`${chunkStart}: ${payload.error || 'chunk failed'}`);
        continue;
      }
      scenesFound += payload.count;
      for (const real of payload.observations) {
        await persistRealObservation(river, real, bbox, { enrichment: 'historical' });
        inserted += 1;
      }
      skipped += payload.errors;
    }

    res.json({
      success: true,
      message: `Ingested ${inserted} real historical satellite observations for ${river.name}`,
      start,
      end,
      count: inserted,
      scenes: scenesFound,
      skipped,
      chunkErrors
    });
  } catch (error) {
    console.error('Backfill satellite history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function mapRiverApi(river) {
  return {
    id: river.id,
    name: river.name,
    state: river.state,
    country: river.country,
    latitude: river.latitude,
    longitude: river.longitude,
    bbox: typeof river.bbox === 'string' ? JSON.parse(river.bbox) : river.bbox,
    geometry: typeof river.geometry === 'string' ? JSON.parse(river.geometry) : river.geometry,
    length_km: river.length_km,
    basin: river.basin
  };
}

function mapObservationApi(observation) {
  return {
    id: observation.id,
    satelliteName: observation.satellite_name,
    sensor: observation.sensor,
    imageDate: observation.image_date,
    imageTimestamp: observation.image_timestamp,
    cloudCover: observation.cloud_cover,
    resolution: observation.resolution,
    ndwi: observation.ndwi,
    ndvi: observation.ndvi,
    waterAreaSqKm: observation.water_area,
    riverWidthMeters: observation.river_width,
    surfaceTemperatureC: observation.temperature,
    turbidityNtu: observation.turbidity,
    floodStatus: observation.flood_status,
    floodRiskPct: observation.flood_risk_pct,
    waterLevelMeters: observation.water_level,
    healthScore: observation.health_score,
    waterAvailability: observation.water_availability,
    pollutionRisk: observation.pollution_risk,
    aiSummary: observation.ai_summary,
    aiRecommendation: observation.ai_recommendation,
    imageUrl: observation.image_url,
    ndwiImageUrl: observation.ndwi_image_url,
    falseColorImageUrl: observation.false_color_image_url,
    prevImageUrl: observation.prev_image_url,
    rawMetadata: observation.raw_metadata ? JSON.parse(observation.raw_metadata) : null
  };
}

/**
 * POST /api/satellite/scan
 * Process a real Sentinel-2 scene over an arbitrary user-drawn area.
 * Body: { bbox: [west, south, east, north], lat?, lng?, name?, start?, end? }
 * Creates a transient river record for the scanned box, runs the real ML
 * satellite processor over it, persists the observation, and returns both so
 * the whole satellite dashboard renders for the selected area.
 */
router.post('/scan', async (req, res) => {
  try {
    const { bbox, lat, lng, name, start, end } = req.body || {};
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) {
      return res.status(400).json({ success: false, error: 'Provide bbox as [west, south, east, north].' });
    }

    const SCAN_MAX_SPAN = 1.0;
    let [west, south, east, north] = bbox.map(Number);
    if (east - west > SCAN_MAX_SPAN) {
      const center = (west + east) / 2;
      west = center - SCAN_MAX_SPAN / 2;
      east = center + SCAN_MAX_SPAN / 2;
    }
    if (north - south > SCAN_MAX_SPAN) {
      const center = (south + north) / 2;
      south = center - SCAN_MAX_SPAN / 2;
      north = center + SCAN_MAX_SPAN / 2;
    }
    const scanBbox = [west, south, east, north];
    const centerLat = Number.isFinite(Number(lat)) ? Number(lat) : (south + north) / 2;
    const centerLng = Number.isFinite(Number(lng)) ? Number(lng) : (west + east) / 2;

    const scanId = `scan-${Date.now()}`;
    const scanName = String(name || 'Scanned Area').trim().slice(0, 120);
    const river = {
      id: scanId,
      name: scanName,
      alternate_names: scanName,
      state: '',
      country: '',
      latitude: centerLat,
      longitude: centerLng,
      bbox: JSON.stringify(scanBbox),
      length_km: null,
      basin: `${scanName} Basin`,
      geometry: JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [west, south], [east, south], [east, north], [west, north], [west, south]
        ]]
      }),
      description: `User-scanned area centred at ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`
    };
    await RiverDB.insertRiver(river);

    const endDate = end || new Date().toISOString().split('T')[0];
    const startDate = start || new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    let real;
    try {
      const response = await fetch(`${config.ml.url}/satellite/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: scanBbox,
          lat: centerLat,
          lng: centerLng,
          max_cloud: 60,
          start: startDate,
          end: endDate
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Satellite processor returned HTTP ${response.status}`);
      }
      real = await response.json();
    } catch (error) {
      throw new Error(`Real Sentinel-2 processing unavailable for this area: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (real.source !== 'real') {
      throw new Error(real.error || 'No real Sentinel-2 scene was available over this area.');
    }

    await persistRealObservation(river, real, scanBbox, { enrichment: 'live' });
    const observation = await RiverDB.getLatestObservation(river.id);

    res.json({ success: true, river: mapRiverApi(river), observation: observation ? mapObservationApi(observation) : null });
  } catch (error) {
    console.error('Scan area error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/satellite/image?river=&satellite=&type=&date=
 * High-performance vector SVG satellite remote sensing rendering engine
 */
router.get('/image', (req, res) => {
  const type = (req.query.type || 'rgb').toLowerCase();
  const riverQuery = req.query.river || 'cauvery';
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];

  const cachedFile = cachedImagePath(riverQuery, dateStr, type);
  if (fs.existsSync(cachedFile)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cachedFile);
  }

  const escapeXml = value => String(value).replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
  const riverLabel = escapeXml(riverQuery);
  const dateLabel = escapeXml(dateStr);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=600');

  const placeholder = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
    <rect width="800" height="500" fill="#0f172a"/>
    <circle cx="400" cy="190" r="60" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="6,6"/>
    <path d="M 370 190 a 30 30 0 1 1 60 0" fill="none" stroke="#38bdf8" stroke-width="3"/>
    <path d="M 400 160 l 0 -30 M 400 220 l 0 30 M 370 190 l -30 0 M 430 190 l 30 0" stroke="#38bdf8" stroke-width="3"/>
    <text x="400" y="290" fill="#e2e8f0" font-family="sans-serif" font-size="20" font-weight="700" text-anchor="middle">NO REAL IMAGERY AVAILABLE</text>
    <text x="400" y="316" fill="#94a3b8" font-family="monospace" font-size="13" text-anchor="middle">${riverLabel.toUpperCase()} — ${dateLabel} — ${type.toUpperCase()}</text>
    <text x="400" y="345" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">Awaiting a cloud-free Sentinel-2 pass over this water body.</text>
  </svg>
  `;

  res.send(placeholder.trim());
});

export default router;
