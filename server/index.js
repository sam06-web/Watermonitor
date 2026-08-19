import express from 'express';
import cors from 'cors';
import config from './config/config.js';
import { initDatabase } from './db/database.js';
import satelliteRouter from './routes/satelliteRoutes.js';
import waterQualityRouter from './routes/waterQualityRoutes.js';

const app = express();

// Initialize SQLite database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in dev
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Mount Routes
app.use('/api/satellite', satelliteRouter);
app.use('/api/water-quality', waterQualityRouter);

// System Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'AquaSense Satellite Monitoring Engine',
    timestamp: new Date().toISOString(),
    version: '1.2.0'
  });
});

// Start Server
app.listen(config.port, () => {
  console.log(`🚀 AquaSense Satellite Backend running at http://localhost:${config.port}`);
  console.log(`📡 Ready for Sentinel-2, Landsat, SWOT, and CDSE remote sensing telemetry.`);
});
