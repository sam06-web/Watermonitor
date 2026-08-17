import axios from 'axios';
import BaseSatelliteProvider from './baseProvider.js';
import config from '../../config/config.js';

/**
 * Open STAC Catalog Provider (AWS Earth Search & Microsoft Planetary Computer)
 * Queries real Sentinel-2 Level-2A BOA and Landsat-8/9 scenes without requiring proprietary keys.
 */
export class StacSatelliteProvider extends BaseSatelliteProvider {
  constructor() {
    super('Earth Search & Planetary Computer STAC', ['Sentinel-2 L2A', 'Landsat-8/9 C2 L2', 'Sentinel-3 OLCI']);
    this.earthSearchUrl = config.providers.earthSearchStac.url;
    this.planetaryComputerUrl = config.providers.planetaryComputer.url;
  }

  /**
   * Search real satellite scenes over the river's bounding box
   */
  async searchScenes({ bbox, lat, lng, limit = 10, maxCloudCover = 40, collections = ['sentinel-2-l2a'] }) {
    // Generate bounding box around coordinate if bbox not provided
    const searchBbox = bbox ? (typeof bbox === 'string' ? JSON.parse(bbox) : bbox) : [lng - 0.2, lat - 0.2, lng + 0.2, lat + 0.2];

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 60);

    const datetime = `${pastDate.toISOString().split('T')[0]}T00:00:00Z/${today.toISOString().split('T')[0]}T23:59:59Z`;

    try {
      // 1. Try Element 84 AWS Earth Search STAC API
      const response = await axios.post(`${this.earthSearchUrl}/search`, {
        collections: collections,
        bbox: searchBbox,
        datetime: datetime,
        query: {
          'eo:cloud_cover': { lte: maxCloudCover }
        },
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        limit: limit
      }, { timeout: 8000 });

      if (response.data && response.data.features && response.data.features.length > 0) {
        return response.data.features.map(f => this.formatStacFeature(f, 'Earth Search (AWS Open Data)'));
      }
    } catch (err) {
      console.warn('STAC Earth Search query failed, trying Planetary Computer fallback:', err.message);
    }

    // 2. Planetary Computer Fallback
    try {
      const pcResponse = await axios.post(`${this.planetaryComputerUrl}/search`, {
        collections: ['sentinel-2-l2a', 'landsat-c2-l2'],
        bbox: searchBbox,
        datetime: datetime,
        query: {
          'eo:cloud_cover': { lte: maxCloudCover }
        },
        limit: limit
      }, { timeout: 8000 });

      if (pcResponse.data && pcResponse.data.features && pcResponse.data.features.length > 0) {
        return pcResponse.data.features.map(f => this.formatStacFeature(f, 'Microsoft Planetary Computer'));
      }
    } catch (err) {
      console.warn('Planetary Computer STAC query failed:', err.message);
    }

    return [];
  }

  formatStacFeature(feature, source) {
    const props = feature.properties || {};
    const assets = feature.assets || {};

    const cloudCover = props['eo:cloud_cover'] ?? props['cloud_cover'] ?? 0;
    const datetime = props.datetime || new Date().toISOString();
    const satellite = props['platform'] ? (props['platform'].toUpperCase().includes('SENTINEL-2') ? 'Sentinel-2' : props['platform']) : 'Sentinel-2B';
    const sensor = props['instruments'] ? props['instruments'].join(', ') : 'MSI Level-2A';

    // Extract visual RGB thumbnail / asset URL if available
    const visualAsset = assets.visual?.href || assets.rendered_preview?.href || assets.thumbnail?.href || null;

    return {
      id: feature.id,
      satellite: `${satellite} MSI`,
      sensor: `${sensor} (BOA Reflectance)`,
      source: source,
      datetime: datetime,
      date: datetime.split('T')[0],
      cloudCover: Number(cloudCover.toFixed(1)),
      resolution: props['gsd'] ? `${props['gsd']}m Multispectral` : '10m Multispectral',
      sunElevation: props['view:sun_elevation'] ?? 55.4,
      visualUrl: visualAsset,
      bbox: feature.bbox,
      assets: Object.keys(assets)
    };
  }

  async getLatestObservation(river) {
    const scenes = await this.searchScenes({
      bbox: river.bbox,
      lat: river.latitude,
      lng: river.longitude,
      limit: 1
    });

    if (scenes.length > 0) {
      const latest = scenes[0];
      return {
        satelliteName: latest.satellite,
        sensor: latest.sensor,
        imageDate: latest.date,
        imageTimestamp: latest.datetime,
        cloudCover: latest.cloudCover,
        resolution: latest.resolution,
        visualUrl: latest.visualUrl
      };
    }

    return null;
  }
}

export default new StacSatelliteProvider();
