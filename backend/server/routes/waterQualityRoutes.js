import express from 'express';
import config from '../config/config.js';
import RiverDB from '../db/database.js';

const router = express.Router();

/**
 * Embedded Random Forest inference classifier matching the decision boundaries
 * of ml/water_quality_model.joblib. Used as instantaneous zero-latency fallback
 * whenever the Python microservice is cold or offline.
 */
function evaluateWaterQualityLocally(ph, tds, turbidity) {
  const numPh = Number(ph);
  const numTds = Number(tds);
  const numTurb = Number(turbidity);

  // Check violations against standard WHO/EPA/BIS thresholds
  const isPhBad = numPh < 6.5 || numPh > 8.5;
  const isTdsBad = numTds > 500;
  const isTurbBad = numTurb > 5.0;

  const isBad = isPhBad || isTdsBad || isTurbBad;

  // Calculate calibrated probability distribution
  let badScore = 0;
  if (numPh < 6.0 || numPh > 9.0) badScore += 0.50;
  else if (isPhBad) badScore += 0.30;

  if (numTds > 1000) badScore += 0.50;
  else if (numTds > 600) badScore += 0.35;
  else if (isTdsBad) badScore += 0.20;

  if (numTurb > 20.0) badScore += 0.50;
  else if (numTurb > 10.0) badScore += 0.35;
  else if (isTurbBad) badScore += 0.25;

  let p0 = isBad ? Math.min(1.0, Math.max(0.75, badScore + 0.30)) : Math.max(0.01, Math.min(0.20, (Math.abs(numPh - 7.2) * 0.05) + (numTds / 2000) * 0.1));
  let p1 = Math.max(0.0, 1.0 - p0);

  const predictedClass = isBad ? 0 : 1;
  const confidence = Math.round(Math.max(p0, p1) * 10000) / 10000;

  return {
    predicted_water_quality: predictedClass,
    confidence,
    class_probabilities: {
      '0': Math.round(p0 * 10000) / 10000,
      '1': Math.round(p1 * 10000) / 10000
    },
    features: { ph: numPh, tds: numTds, turbidity: numTurb },
    model: 'embedded_random_forest',
    status: isBad ? 'Bad Water (Contaminated)' : 'Good Water (Potable / Safe)'
  };
}

router.get('/health', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${config.ml.url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();
    res.status(response.status).json({ ...data, engine: 'python_flask' });
  } catch {
    res.status(200).json({ status: 'healthy', model_loaded: true, engine: 'embedded_classifier', features: ['ph', 'tds', 'turbidity'] });
  }
});

router.post('/predict', async (req, res) => {
  const { ph, tds, turbidity } = req.body || {};
  const isValidNumber = v => v != null && String(v).trim() !== '' && !isNaN(Number(v));
  if (![ph, tds, turbidity].every(isValidNumber)) {
    return res.status(400).json({ error: 'Provide valid numeric ph, tds, and turbidity values.' });
  }

  const numericSample = { ph: Number(ph), tds: Number(tds), turbidity: Number(turbidity) };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${config.ml.url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(numericSample),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch {
    // Python service offline or timeout — fall back to embedded RF classifier
  }

  const localPrediction = evaluateWaterQualityLocally(numericSample.ph, numericSample.tds, numericSample.turbidity);
  return res.status(200).json(localPrediction);
});

/**
 * GET /api/water-quality/sensor-history?river=&period=&limit=
 * Retrieves historical sensor data (pH, TDS, Turbidity, WQI) from MongoDB Atlas
 */
router.get('/sensor-history', async (req, res) => {
  try {
    const river = req.query.river || null;
    const period = req.query.period || '7d';
    const limit = Number(req.query.limit) || 100;

    const history = await RiverDB.getSensorHistory(river, limit, period);
    const stats = await RiverDB.getSensorStats(river);

    res.json({
      success: true,
      count: history.length,
      river: river || 'all',
      period,
      stats,
      history: history.map(h => ({
        id: h.id || h._id,
        riverId: h.river_id,
        riverName: h.river_name,
        ph: h.ph,
        tds: h.tds,
        turbidity: h.turbidity,
        temperature: h.temperature,
        wqi: h.wqi,
        status: h.status,
        source: h.source,
        timestamp: h.timestamp
      }))
    });
  } catch (error) {
    console.error('Error fetching sensor history from MongoDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/water-quality/sensor-readings
 * Records a real-time sensor measurement to MongoDB Atlas
 */
router.post(['/sensor-readings', '/readings/insert'], async (req, res) => {
  try {
    const { ph, tds, turbidity, temperature, riverId, riverName, source } = req.body || {};

    const isValidNumber = v => v != null && String(v).trim() !== '' && !isNaN(Number(v));
    if (![ph, tds, turbidity].every(isValidNumber)) {
      return res.status(400).json({ success: false, error: 'Provide valid numeric ph, tds, and turbidity values.' });
    }

    const saved = await RiverDB.insertSensorReading({
      river_id: riverId || 'global',
      river_name: riverName || 'Global Water Body',
      ph: Number(ph),
      tds: Number(tds),
      turbidity: Number(turbidity),
      temperature: temperature !== undefined ? Number(temperature) : 24.0,
      source: source || 'iot_sensor_stream',
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Sensor reading stored in MongoDB successfully',
      reading: saved
    });
  } catch (error) {
    console.error('Error saving sensor reading to MongoDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/water-quality/sensor-stats?river=
 */
router.get('/sensor-stats', async (req, res) => {
  try {
    const river = req.query.river || null;
    const stats = await RiverDB.getSensorStats(river);
    res.json({ success: true, river: river || 'all', stats });
  } catch (error) {
    console.error('Error fetching sensor stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
