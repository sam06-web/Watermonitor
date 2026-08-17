/**
 * Abstract Satellite Data Provider Interface
 * All satellite providers (Sentinel-2, Landsat, SWOT, Sentinel Hub, CDSE, GEE) implement this interface.
 */
export class BaseSatelliteProvider {
  constructor(name, supportedSensors = []) {
    this.name = name;
    this.supportedSensors = supportedSensors;
  }

  /**
   * Search available satellite scenes for a given bounding box / coordinates and time range
   * @param {Object} params - { bbox, lat, lng, startDate, endDate, maxCloudCover }
   * @returns {Promise<Array>} List of scenes
   */
  async searchScenes(params) {
    throw new Error(`searchScenes() not implemented in ${this.name}`);
  }

  /**
   * Fetch the latest valid observation for the given river and area
   * @param {Object} river - { id, name, latitude, longitude, bbox }
   * @returns {Promise<Object|null>}
   */
  async getLatestObservation(river) {
    throw new Error(`getLatestObservation() not implemented in ${this.name}`);
  }

  /**
   * Compute standard remote sensing spectral indices:
   * NDWI = (Green - NIR) / (Green + NIR)
   * NDVI = (NIR - Red) / (NIR + Red)
   */
  computeSpectralIndices(bands) {
    const { green = 0.2, nir = 0.4, red = 0.15, swir = 0.1 } = bands;
    
    // Normalized Difference Water Index (Gao 1996 / McFeeters 1996)
    const ndwi = (green - nir) / (green + nir || 1e-6);
    
    // Normalized Difference Vegetation Index
    const ndvi = (nir - red) / (nir + red || 1e-6);
    
    // Normalized Difference Moisture Index (NDMI)
    const ndmi = (nir - swir) / (nir + swir || 1e-6);

    return {
      ndwi: Number(Math.max(-1, Math.min(1, ndwi)).toFixed(3)),
      ndvi: Number(Math.max(-1, Math.min(1, ndvi)).toFixed(3)),
      ndmi: Number(Math.max(-1, Math.min(1, ndmi)).toFixed(3))
    };
  }
}

export default BaseSatelliteProvider;
