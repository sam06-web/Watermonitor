import axios from 'axios';
import RiverDB from '../../db/database.js';

/**
 * River Geospatial Service
 * Provides water-body geometries and global river/lake search via OSM Nominatim.
 */
export class RiverGeoService {
  /**
   * Search cached records and query OpenStreetMap Nominatim for global rivers and lakes.
   */
  async searchRivers(query) {
    if (!query || query.trim().length === 0) {
      return RiverDB.getAllRivers();
    }

    const trimmed = query.trim();
    // 1. Check local indexed database first, but continue to the global provider so
    //    cached seed data never hides similarly named lakes or rivers elsewhere.
    const localMatches = RiverDB.searchRivers(trimmed);

    // 2. Query generic, river, and lake forms because Nominatim's free-text
    //    ranking can otherwise favor nearby places over named water bodies.
    try {
      const queries = [...new Set([trimmed, `${trimmed} river`, `${trimmed} lake`])];
      const responses = await Promise.all(queries.map(queryText => axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: queryText,
          format: 'jsonv2',
          addressdetails: 1,
          namedetails: 1,
          extratags: 1,
          polygon_geojson: 1,
          dedupe: 1,
          limit: 10
        },
        headers: { 'User-Agent': 'AquaSentinel-Water-Monitor/1.0 (water-quality-project)' },
        timeout: 8000
      })));

      const results = [];
      const seen = new Set();
      for (const response of responses) {
        for (const item of response.data || []) {
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

          const newRiver = {
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
            geometry: JSON.stringify(item.geojson || (waterType === 'lake'
              ? { type: 'Point', coordinates: [lon, lat] }
              : { type: 'LineString', coordinates: [[lon - 0.1, lat - 0.05], [lon, lat], [lon + 0.1, lat + 0.05]] })),
            description: item.display_name
          };

          // Save to local cache
          RiverDB.insertRiver(newRiver);
          results.push(newRiver);
        }
      }
      return [...localMatches, ...results].slice(0, 20);
    } catch (err) {
      console.warn('OSM Nominatim search fallback error:', err.message);
    }

    return localMatches;
  }

  getRiverById(id) {
    return RiverDB.getRiverById(id);
  }

  getRiverByName(name) {
    return RiverDB.getRiverByName(name);
  }
}

export default new RiverGeoService();
