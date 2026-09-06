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
  // When MONGODB_URI is set the server uses MongoDB Atlas; otherwise it falls
  // back to the local SQLite database.
  dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../db/satellite.db'),
  mongodb: {
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || 'aquasense'
  },

  // Real satellite imagery cache (PNG files rendered from Sentinel-2 COGs)
  satellite: {
    imageCacheDir: process.env.SATELLITE_IMAGE_CACHE_DIR || path.resolve(__dirname, '../cache/satellite')
  },

  // Satellite Provider Credentials (Flexible & Modular - None hardcoded)
  providers: {
    // SWOT Hydrology & NASA PO.DAAC
    swot: {
      podaacApiKey: process.env.NASA_EARTHDATA_KEY || '',
      token: process.env.NASA_EARTHDATA_TOKEN || '',
      cmrUrl: 'https://cmr.earthdata.nasa.gov/search/granules.json'
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
