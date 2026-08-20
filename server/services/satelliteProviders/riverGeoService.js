import axios from 'axios';
import RiverDB from '../../db/database.js';

/**
 * River Geospatial Service
 * Provides water-body geometries and global river/lake search via OSM Nominatim.
 */
export class RiverGeoService {
  async searchRivers(query) {
    if (!query || query.trim().length === 0) {
      return RiverDB.getAllRivers();
    }

    const trimmed = query.trim();

    // 1. Return cached DB results immediately — already fast.
    const localMatches = await RiverDB.searchRivers(trimmed);
    if (localMatches.length >= 5) {
      // Enough local results — skip the Nominatim round-trip entirely.
      return localMatches.slice(0, 20);
    }

    // 2. Query Nominatim — plain query only first, fall back to "<query> river"
    //    only if the plain query returns no water features. This avoids the
    //    original 3-request × 1.2s sequential delay (was ~3.6s minimum).
    //    polygon_geojson, addressdetails, extratags are dropped — they add
    //    significant response size and we don't use them.
    const nominatimParams = (q) => ({
      q,
      format: 'jsonv2',
      namedetails: 1,
      dedupe: 1,
      limit: 15
    });

    const fetchNominatim = async (q) => {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: nominatimParams(q),
        headers: { 'User-Agent': 'AquaSentinel-Water-Monitor/1.0 (water-quality-project)' },
        timeout: 8000
      });
      return response.data || [];
    };

    const parseItems = (items) => {
      const results = [];
      const seen = new Set();
      for (const item of items) {
        const itemType = item.type || item.addresstype || '';
        const isWaterFeature = item.class === 'waterway'
          || (item.class === 'natural' && ['water', 'lake', 'reservoir', 'river', 'riverbank'].includes(itemType))
          || ['river', 'lake', 'reservoir', 'stream', 'canal', 'riverbank'].includes(itemType)
          || /\b(river|lake|reservoir|canal|stream)\b/i.test(item.display_name || '');
        if (!isWaterFeature) continue;

        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const name = item.namedetails?.name || item.display_name.split(',')[0];
        const waterType = ['lake', 'reservoir', 'riverbank', 'water'].includes(itemType) || item.class === 'natural' ? 'lake' : 'river';
        const riverId = `${item.osm_type || 'osm'}-${item.osm_id || `${lat}-${lon}`}`.toLowerCase().replace(/[^a-z0-9-]/g, '_');
        if (seen.has(riverId)) continue;
        seen.add(riverId);

        const bbox = item.boundingbox
          ? [parseFloat(item.boundingbox[2]), parseFloat(item.boundingbox[0]), parseFloat(item.boundingbox[3]), parseFloat(item.boundingbox[1])]
          : [lon - 0.2, lat - 0.2, lon + 0.2, lat + 0.2];

        results.push({
          id: riverId,
          name,
          alternate_names: item.display_name,
          state: item.display_name.split(',').slice(1, 3).join(',').trim(),
          country: item.display_name.split(',').pop().trim(),
          latitude: lat,
          longitude: lon,
          bbox: JSON.stringify(bbox),
          length_km: waterType === 'lake' ? 0 : 120,
          basin: `${name} Basin`,
          water_type: waterType,
          geometry: JSON.stringify({
            type: 'LineString',
            coordinates: [[lon - 0.1, lat - 0.05], [lon, lat], [lon + 0.1, lat + 0.05]]
          }),
          description: item.display_name
        });
      }
      return results;
    };

    try {
      // First attempt: plain query
      let items = await fetchNominatim(trimmed);
      let results = parseItems(items);

      // Second attempt only if plain query found nothing — no delay needed
      // since we're not hitting the 1 req/s limit on a single sequential call.
      if (results.length === 0) {
        items = await fetchNominatim(`${trimmed} river`);
        results = parseItems(items);
      }

      // Batch-insert new results into the DB cache (fire-and-forget, non-blocking)
      if (results.length > 0) {
        Promise.allSettled(results.map(r => RiverDB.insertRiver(r))).catch(() => {});
      }

      return [...localMatches, ...results].slice(0, 20);
    } catch (err) {
      console.warn('OSM Nominatim search error:', err.message);
    }

    return localMatches;
  }

  async getRiverById(id) {
    return RiverDB.getRiverById(id);
  }

  async getRiverByName(name) {
    return RiverDB.getRiverByName(name);
  }
}

export default new RiverGeoService();
