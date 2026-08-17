import axios from 'axios';
import RiverDB from '../../db/database.js';

/**
 * River Geospatial Service
 * Provides centerline geometries, reach boundaries, and global river search fallback via OSM Nominatim.
 */
export class RiverGeoService {
  /**
   * Search for a river in SQLite DB or query OpenStreetMap Nominatim for new rivers
   */
  async searchRivers(query) {
    if (!query || query.trim().length === 0) {
      return RiverDB.getAllRivers();
    }

    const trimmed = query.trim();
    // 1. Check local indexed database first
    const localMatches = RiverDB.searchRivers(trimmed);
    if (localMatches.length > 0) {
      return localMatches;
    }

    // 2. Fallback to OpenStreetMap Nominatim to support ANY global river
    try {
      const osmRes = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${trimmed} River`,
          format: 'json',
          polygon_geojson: 1,
          limit: 5
        },
        headers: {
          'User-Agent': 'AquaSense-Satellite-River-Monitor/1.0'
        },
        timeout: 5000
      });

      if (osmRes.data && osmRes.data.length > 0) {
        const results = [];
        for (const item of osmRes.data) {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const bbox = item.boundingbox 
            ? [parseFloat(item.boundingbox[2]), parseFloat(item.boundingbox[0]), parseFloat(item.boundingbox[3]), parseFloat(item.boundingbox[1])]
            : [lon - 0.2, lat - 0.2, lon + 0.2, lat + 0.2];

          const riverId = item.display_name.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
          
          const newRiver = {
            id: riverId,
            name: item.display_name.split(',')[0],
            alternate_names: item.display_name,
            state: item.display_name.split(',').slice(1, 3).join(',').trim(),
            country: item.display_name.split(',').pop().trim(),
            latitude: lat,
            longitude: lon,
            bbox: JSON.stringify(bbox),
            length_km: 120,
            basin: `${item.display_name.split(',')[0]} Basin`,
            geometry: JSON.stringify(item.geojson || {
              type: 'LineString',
              coordinates: [[lon - 0.1, lat - 0.05], [lon, lat], [lon + 0.1, lat + 0.05]]
            }),
            description: item.display_name
          };

          // Save to local cache
          RiverDB.insertRiver(newRiver);
          results.push(newRiver);
        }
        return results;
      }
    } catch (err) {
      console.warn('OSM Nominatim search fallback error:', err.message);
    }

    return [];
  }

  getRiverById(id) {
    return RiverDB.getRiverById(id);
  }

  getRiverByName(name) {
    return RiverDB.getRiverByName(name);
  }
}

export default new RiverGeoService();
