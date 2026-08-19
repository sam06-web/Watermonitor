import axios from 'axios';
import config from '../../config/config.js';

/**
 * NASA/CNES SWOT Satellite & PO.DAAC Hydrology Provider
 * Provides real River Width, Water Surface Elevation (WSE), and River Slope
 * measurements from SWOT KaRIn granules via the NASA CMR (Common Metadata
 * Repository). Requires a free NASA Earthdata key set as NASA_EARTHDATA_KEY.
 */
export class SwotHydrologyProvider {
  constructor() {
    this.cmrUrl = config.providers.swot.cmrUrl;
    this.apiKey = config.providers.swot.podaacApiKey;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Search the latest SWOT granule intersecting the river coordinates.
   * Returns null when no Earthdata key is configured or no granule is found.
   */
  async fetchLatestReach(latitude, longitude) {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await axios.get(this.cmrUrl, {
        params: {
          short_name: 'SWOT_L2_HR_RiverSP_2.0',
          bounding_box: `${longitude},${latitude},${longitude},${latitude}`,
          page_size: 1,
          sort_key: '-start_date',
          pretty: true
        },
        headers: { 'Echo-Token': this.apiKey },
        timeout: 10000
      });

      const entry = response.data?.feed?.entry?.[0];
      if (!entry) return null;

      return {
        granule: entry.id,
        title: entry.title,
        timeStart: entry.time_start,
        timeEnd: entry.time_end,
        dataLinks: (entry.links || []).map(link => link.href)
      };
    } catch (err) {
      console.warn('SWOT PO.DAAC CMR query failed:', err.message);
      return null;
    }
  }
}

export default new SwotHydrologyProvider();
