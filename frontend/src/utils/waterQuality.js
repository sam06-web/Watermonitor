const LIMITS = {
  ph: { min: 6.5, max: 8.5 },
  tds: { max: 500 },
  turbidity: { max: 5 },
  temperature: { min: 10, max: 30 }
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateWaterQuality({ ph, tds, turbidity, temperature }) {
  const safePh = Number(ph);
  const safeTds = Number(tds);
  const safeTurbidity = Number(turbidity);
  const safeTemp = Number(temperature);

  const phScore = Number.isFinite(safePh) ? clamp(100 - Math.max(0, LIMITS.ph.min - safePh, safePh - LIMITS.ph.max) * 25) : 0;
  const tdsScore = Number.isFinite(safeTds) ? clamp(100 - Math.max(0, safeTds - LIMITS.tds.max) / 5) : 0;
  const turbidityScore = Number.isFinite(safeTurbidity) ? clamp(100 - Math.max(0, safeTurbidity - LIMITS.turbidity.max) * 4) : 0;

  let score;
  if (Number.isFinite(safeTemp) && safeTemp > 0) {
    const tempScore = clamp(100 - Math.max(0, LIMITS.temperature.min - safeTemp, safeTemp - LIMITS.temperature.max) * 5);
    score = Math.round(phScore * 0.3 + tdsScore * 0.3 + turbidityScore * 0.25 + tempScore * 0.15);
  } else {
    score = Math.round(phScore * 0.35 + tdsScore * 0.35 + turbidityScore * 0.3);
  }

  return {
    score,
    status: score >= 80 ? 'normal' : score >= 60 ? 'warning' : 'critical',
    components: {
      ph: Math.round(phScore),
      tds: Math.round(tdsScore),
      turbidity: Math.round(turbidityScore),
      temperature: Number.isFinite(safeTemp) ? Math.round(clamp(100 - Math.max(0, LIMITS.temperature.min - safeTemp, safeTemp - LIMITS.temperature.max) * 5)) : null
    },
    limits: LIMITS
  };
}

export function analyzeContamination({ ph, tds, turbidity, temperature, satellite }) {
  const quality = calculateWaterQuality({ ph, tds, turbidity, temperature });
  const abnormal = [];
  const sensorAbnormal = [];
  const satelliteAbnormal = [];

  const numPh = Number(ph);
  const numTds = Number(tds);
  const numTurb = Number(turbidity);
  const numTemp = Number(temperature);

  // Ground Sensor Assessment
  if (Number.isFinite(numPh) && (numPh < LIMITS.ph.min || numPh > LIMITS.ph.max)) {
    const note = numPh < LIMITS.ph.min ? `Acidic pH (${numPh.toFixed(2)})` : `Alkaline pH (${numPh.toFixed(2)})`;
    abnormal.push(note);
    sensorAbnormal.push(note);
  }
  if (Number.isFinite(numTds) && numTds > LIMITS.tds.max) {
    const note = `Elevated TDS (${Math.round(numTds)} ppm)`;
    abnormal.push(note);
    sensorAbnormal.push(note);
  }
  if (Number.isFinite(numTurb) && numTurb > LIMITS.turbidity.max) {
    const note = `High turbidity (${numTurb.toFixed(1)} NTU)`;
    abnormal.push(note);
    sensorAbnormal.push(note);
  }
  if (Number.isFinite(numTemp) && numTemp > 0 && (numTemp < LIMITS.temperature.min || numTemp > LIMITS.temperature.max)) {
    const note = numTemp > LIMITS.temperature.max ? `Thermal elevation (${numTemp.toFixed(1)}°C)` : `Thermal drop (${numTemp.toFixed(1)}°C)`;
    abnormal.push(note);
    sensorAbnormal.push(note);
  }

  // Sensor Summary
  let sensorType = 'Sensors Normal';
  let sensorCause = 'All measured ground telemetry (pH, TDS, Turbidity, Temperature) are within standard baseline thresholds.';
  let sensorStatus = sensorAbnormal.length === 0 ? 'optimal' : sensorAbnormal.length >= 2 ? 'critical' : 'warning';

  if (sensorAbnormal.length) {
    const chemical = (numPh < LIMITS.ph.min || numPh > LIMITS.ph.max) || numTds > LIMITS.tds.max;
    const particulate = numTurb > LIMITS.turbidity.max;
    const thermal = Number.isFinite(numTemp) && numTemp > LIMITS.temperature.max;

    sensorType = chemical && particulate
      ? 'Mixed Chemical & Particulate Intrusion'
      : chemical
      ? 'Potential Chemical / Mineral Contamination'
      : particulate
      ? 'Elevated Suspended Solids / Turbidity'
      : thermal
      ? 'Thermal Anomaly Detected'
      : 'Sensor Threshold Anomaly';

    sensorCause = chemical && particulate
      ? 'Elevated dissolved solids/pH imbalance co-occurring with particulate turbidity. Check for industrial discharge or heavy agricultural runoff.'
      : chemical
      ? 'Dissolved chemistry is outside safe potable range. Possible causes include agricultural mineral runoff, industrial effluent, or salinity intrusion.'
      : particulate
      ? 'Suspended particulates exceed clarity standard. Likely caused by soil erosion, storm runoff, or sediment agitation.'
      : thermal
      ? 'Water temperature exceeds standard environmental baseline, which can accelerate microbial growth and reduce dissolved oxygen.'
      : 'Telemetry indicates anomalous readings requiring inspection.';
  }

  // Satellite Remote Sensing Assessment
  let satelliteStatus = 'pending';
  let satelliteType = 'Awaiting Satellite Pass';
  let satelliteCause = 'Waiting for recent Copernicus Sentinel-2 / NASA SWOT overpass validation.';
  let satelliteDetails = null;

  if (satellite) {
    const risk = satellite.pollutionRisk || 'Low';
    const ndwi = satellite.ndwi !== undefined && satellite.ndwi !== null ? Number(satellite.ndwi) : null;
    const ndvi = satellite.ndvi !== undefined && satellite.ndvi !== null ? Number(satellite.ndvi) : null;
    const turbNtu = satellite.turbidityNtu !== undefined && satellite.turbidityNtu !== null ? Number(satellite.turbidityNtu) : null;

    if (['High', 'Elevated'].includes(risk)) {
      satelliteAbnormal.push(`Satellite ${risk} pollution signal`);
      abnormal.push(`Satellite ${risk} pollution signal`);
    }
    if (ndvi !== null && ndvi > 0.35) {
      satelliteAbnormal.push(`High algal proxy / vegetative index (NDVI: ${ndvi.toFixed(2)})`);
    }
    if (turbNtu !== null && turbNtu > 15) {
      satelliteAbnormal.push(`Optical reflectance turbidity plume (~${turbNtu.toFixed(1)} NTU)`);
    }

    satelliteStatus = ['High', 'Critical'].includes(risk) ? 'critical' : ['Elevated', 'Moderate'].includes(risk) ? 'warning' : 'optimal';

    if (satelliteStatus === 'critical' || satelliteStatus === 'warning') {
      satelliteType = ndvi && ndvi > 0.35 ? 'Algal Bloom / Eutrophication Signal' : 'Spatial Reflectance Pollution Signal';
      satelliteCause = `Orbital pass on ${satellite.imageDate ? new Date(satellite.imageDate).toLocaleDateString() : 'recent pass'} detected ${risk.toLowerCase()} surface reflectance risk across the water basin.` +
        (ndvi && ndvi > 0.35 ? ' Elevated chlorophyll/vegetation index indicates potential algal proliferation.' : '') +
        (satellite.waterAreaSqKm ? ` Water area observed at ${satellite.waterAreaSqKm.toFixed(1)} km².` : '');
    } else {
      satelliteType = 'Clear Spatial Reflectance';
      satelliteCause = `Sentinel-2 multi-spectral scan (${satellite.imageDate ? new Date(satellite.imageDate).toLocaleDateString() : 'recent pass'}) confirms clean water spectral signature (NDWI: ${ndwi !== null ? ndwi.toFixed(2) : '—'}, NDVI: ${ndvi !== null ? ndvi.toFixed(2) : '—'}) with no widespread surface plumes.`;
    }

    satelliteDetails = {
      healthScore: satellite.healthScore,
      pollutionRisk: risk,
      ndwi: ndwi !== null ? ndwi.toFixed(2) : '—',
      ndvi: ndvi !== null ? ndvi.toFixed(2) : '—',
      waterAreaSqKm: satellite.waterAreaSqKm ? satellite.waterAreaSqKm.toFixed(1) : null,
      waterLevel: satellite.waterLevel ? satellite.waterLevel.toFixed(2) : null,
      imageDate: satellite.imageDate
    };
  }

  // Unified summary
  let type = sensorAbnormal.length && satelliteAbnormal.length
    ? 'Dual-Validated Contamination Signal'
    : sensorAbnormal.length
    ? sensorType
    : satelliteAbnormal.length
    ? satelliteType
    : 'No Contamination Detected';

  let cause = sensorAbnormal.length && satelliteAbnormal.length
    ? `Both IoT ground sensors and orbital Sentinel-2 remote sensing independently confirm water contamination: ${sensorCause} ${satelliteCause}`
    : sensorAbnormal.length
    ? sensorCause
    : satelliteAbnormal.length
    ? satelliteCause
    : 'All observed telemetry and satellite spectral indices remain within nominal safety bounds.';

  return {
    ...quality,
    detected: abnormal.length > 0,
    risk: quality.status,
    type,
    cause,
    abnormal,
    sensorSummary: {
      status: sensorStatus,
      type: sensorType,
      cause: sensorCause,
      abnormal: sensorAbnormal
    },
    satelliteSummary: {
      status: satelliteStatus,
      type: satelliteType,
      cause: satelliteCause,
      abnormal: satelliteAbnormal,
      details: satelliteDetails
    },
    sourceNote: satellite ? 'Continuous IoT telemetry cross-verified with Copernicus Sentinel-2 spatial reflectance.' : 'Awaiting latest cloud-free satellite pass for basin cross-verification.'
  };
}

export { LIMITS };

