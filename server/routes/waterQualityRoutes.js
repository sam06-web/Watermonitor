import express from 'express';
import config from '../config/config.js';

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${config.ml.url}/health`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ status: 'unavailable', model_loaded: false, error: 'Python model service is unavailable' });
  }
});

router.post('/predict', async (req, res) => {
  const { ph, tds, turbidity } = req.body || {};
  if (![ph, tds, turbidity].every(value => Number.isFinite(Number(value)))) {
    return res.status(400).json({ error: 'Provide numeric ph, tds, and turbidity values.' });
  }

  try {
    const response = await fetch(`${config.ml.url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph: Number(ph), tds: Number(tds), turbidity: Number(turbidity) })
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(503).json({ error: 'Python model service is unavailable', details: error.message });
  }
});

export default router;
