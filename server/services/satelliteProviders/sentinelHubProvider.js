import axios from 'axios';
import BaseSatelliteProvider from './baseProvider.js';
import config from '../../config/config.js';

/**
 * Sentinel Hub API Connector
 * Provides Sentinel Hub Statistical and Process API evaluation scripts (Evalscript)
 * for on-the-fly NDWI, True Color, and Turbidity rendering.
 */
export class SentinelHubProvider extends BaseSatelliteProvider {
  constructor() {
    super('Sentinel Hub', ['Sentinel-2', 'Landsat-8', 'Sentinel-3']);
    this.instanceId = config.providers.sentinelHub.instanceId;
    this.clientId = config.providers.sentinelHub.clientId;
    this.clientSecret = config.providers.sentinelHub.clientSecret;
    this.processUrl = config.providers.sentinelHub.processUrl;
  }

  /**
   * Standard NDWI Evalscript for Sentinel Hub Process API
   * NDWI = (B03 - B08) / (B03 + B08)
   */
  getNdwiEvalscript() {
    return `//VERSION=3
function setup() {
  return {
    input: ["B03", "B08", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(samples) {
  let ndwi = (samples.B03 - samples.B08) / (samples.B03 + samples.B08 + 0.0001);
  if (samples.dataMask === 0) return [0, 0, 0, 0];
  
  if (ndwi > 0.2) {
    // Deep Water - Vibrant Cyan/Blue
    return [0.0, 0.5, 1.0, 1.0];
  } else if (ndwi > 0.0) {
    // Shallow / Turbid Water - Teal
    return [0.0, 0.8, 0.8, 1.0];
  } else {
    // Non-water / Soil / Vegetation - Transparent or muted
    return [0.2, 0.2, 0.2, 0.3];
  }
}`;
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret) || Boolean(this.instanceId);
  }
}

export default new SentinelHubProvider();
