import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: process.env.PORT || 5050,
  nodeEnv: process.env.NODE_ENV || 'development',
  ml: {
    url: process.env.WATER_QUALITY_MODEL_URL || 'http://127.0.0.1:5001'
  },
  
  // Database Configuration
  dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../db/satellite.db'),

  // Real satellite imagery cache (PNG files rendered from Sentinel-2 COGs)
  satellite: {
    imageCacheDir: process.env.SATELLITE_IMAGE_CACHE_DIR || path.resolve(__dirname, '../cache/satellite')
  },

  // Satellite Provider Credentials (Flexible & Modular - None hardcoded)
  providers: {
    // Copernicus Data Space Ecosystem (CDSE)
    copernicus: {
      clientId: process.env.CDSE_CLIENT_ID || '',
      clientSecret: process.env.CDSE_CLIENT_SECRET || '',
      tokenUrl: 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
      odataUrl: 'https://catalogue.dataspace.copernicus.eu/odata/v1/Products',
      stacUrl: 'https://catalogue.dataspace.copernicus.eu/stac'
    },
    
    // Sentinel Hub API
    sentinelHub: {
      instanceId: process.env.SENTINEL_HUB_INSTANCE_ID || '',
      clientId: process.env.SENTINEL_HUB_CLIENT_ID || '',
      clientSecret: process.env.SENTINEL_HUB_CLIENT_SECRET || '',
      processUrl: 'https://services.sentinel-hub.com/api/v1/process'
    },

    // Open STAC Catalogs (Real public endpoints, zero key required by default)
    earthSearchStac: {
      url: process.env.EARTH_SEARCH_STAC_URL || 'https://earth-search.aws.element84.com/v1',
      collections: ['sentinel-2-l2a', 'landsat-c2-l2']
    },

    planetaryComputer: {
      url: process.env.PLANETARY_COMPUTER_STAC_URL || 'https://planetarycomputer.microsoft.com/api/stac/v1',
      subscriptionKey: process.env.PC_SUBSCRIPTION_KEY || ''
    },

    // SWOT Hydrology & NASA PO.DAAC
    swot: {
      podaacApiKey: process.env.NASA_EARTHDATA_KEY || '',
      token: process.env.NASA_EARTHDATA_TOKEN || '',
      cmrUrl: 'https://cmr.earthdata.nasa.gov/search/granules.json'
    },

    // Google Earth Engine (Interface Stub / Service Account)
    googleEarthEngine: {
      serviceAccountEmail: process.env.GEE_SERVICE_ACCOUNT || '',
      privateKey: process.env.GEE_PRIVATE_KEY || '',
      projectId: process.env.GEE_PROJECT_ID || ''
    },

    // Open-Meteo & ERA5 Land Surface Hydrology (Real Land Surface Temperature & Runoff)
    hydrology: {
      openMeteoUrl: 'https://api.open-meteo.com/v1/forecast',
      historicalUrl: 'https://archive-api.open-meteo.com/v1/archive',
      floodUrl: 'https://flood-api.open-meteo.com/v1/flood'
    }
  },

  // OpenRouter / AI Assistant integration for remote sensing synthesis
  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || ''
  }
};

export default config;
