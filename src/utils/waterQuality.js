const LIMITS = {
  ph: { min: 6.5, max: 8.5 },
  tds: { max: 500 },
  turbidity: { max: 5 }
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateWaterQuality({ ph, tds, turbidity }) {
  const safePh = Number(ph);
  const safeTds = Number(tds);
  const safeTurbidity = Number(turbidity);
  const phScore = Number.isFinite(safePh) ? clamp(100 - Math.max(0, LIMITS.ph.min - safePh, safePh - LIMITS.ph.max) * 25) : 0;
  const tdsScore = Number.isFinite(safeTds) ? clamp(100 - Math.max(0, safeTds - LIMITS.tds.max) / 5) : 0;
  const turbidityScore = Number.isFinite(safeTurbidity) ? clamp(100 - Math.max(0, safeTurbidity - LIMITS.turbidity.max) * 4) : 0;
  const score = Math.round(phScore * 0.35 + tdsScore * 0.35 + turbidityScore * 0.3);

  return {
    score,
    status: score >= 80 ? 'normal' : score >= 60 ? 'warning' : 'critical',
    components: { ph: Math.round(phScore), tds: Math.round(tdsScore), turbidity: Math.round(turbidityScore) },
    limits: LIMITS
  };
}

export function analyzeContamination({ ph, tds, turbidity, satellite }) {
  const quality = calculateWaterQuality({ ph, tds, turbidity });
  const abnormal = [];
  if (Number(ph) < LIMITS.ph.min || Number(ph) > LIMITS.ph.max) abnormal.push('pH imbalance');
  if (Number(tds) > LIMITS.tds.max) abnormal.push('elevated dissolved solids');
  if (Number(turbidity) > LIMITS.turbidity.max) abnormal.push('high turbidity');
  if (satellite?.pollutionRisk && ['High', 'Elevated'].includes(satellite.pollutionRisk)) abnormal.push('satellite pollution signal');

  let type = 'No contamination detected';
  let cause = 'All observed parameters are within the configured screening thresholds.';
  if (abnormal.length) {
    const chemical = Number(ph) < LIMITS.ph.min || Number(ph) > LIMITS.ph.max || Number(tds) > LIMITS.tds.max;
    const particulate = Number(turbidity) > LIMITS.turbidity.max;
    type = chemical && particulate ? 'Mixed chemical and particulate contamination' : chemical ? 'Potential chemical contamination' : particulate ? 'Potential particulate contamination' : 'Potential spatial pollution signal';
    cause = chemical && particulate
      ? 'Dissolved solids or pH changes are occurring together with suspended particles. Industrial discharge, agricultural runoff, or disturbed sediment should be investigated.'
      : chemical
        ? 'The dissolved chemistry is outside the expected baseline. Possible causes include industrial discharge, agricultural runoff, mineral intrusion, or a treatment failure.'
        : particulate
          ? 'Suspended particles are above the expected clarity threshold. Possible causes include erosion, stormwater runoff, sediment disturbance, or algal growth.'
          : 'Satellite reflectance indicates a wider-area pollution signal. Use continuous sensors and a physical sample to identify the material and source.';
  }

  return {
    ...quality,
    detected: abnormal.length > 0,
    risk: quality.status,
    type,
    cause,
    abnormal,
    sourceNote: satellite ? 'Sensor readings are continuous; satellite observations provide periodic spatial validation.' : 'Awaiting the latest satellite pass for spatial validation.'
  };
}

export { LIMITS };
