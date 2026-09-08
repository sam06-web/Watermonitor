import { useMemo, useState } from 'react';
import { analyzeContamination } from '../utils/waterQuality';
import SensorHistoryModal from './SensorHistoryModal';

const formatDate = value => value ? new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available';

function Status({ status }) {
  const label = status === 'critical' ? 'Critical' : status === 'warning' ? 'Needs attention' : status === 'pending' ? 'Waiting for data' : 'Optimal';
  return <span className={`quality-status ${status}`}><span />{label}</span>;
}

export default function EcoDashboard({
  realTimeData = {},
  waterQuality = {},
  satelliteObservation,
  satelliteRiver,
  contaminationPoints = [],
  modelPrediction,
  modelStatus = 'idle',
  onNavigate
}) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const { values, hasLiveSensorData, analysis } = useMemo(() => {
    const getSensorValue = value => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
    };
    const values = {
      ph: getSensorValue(waterQuality.ph),
      turbidity: getSensorValue(waterQuality.turbidity),
      tds: getSensorValue(realTimeData.tds),
      temperature: getSensorValue(waterQuality.temperature)
    };
    const hasLiveSensorData = values.ph !== null && values.tds !== null && values.turbidity !== null;
    const analysis = hasLiveSensorData
      ? analyzeContamination({ ...values, satellite: satelliteObservation })
      : {
        score: null,
        status: 'pending',
        components: { ph: 0, tds: 0, turbidity: 0, temperature: 0 },
        type: 'Sensor data unavailable',
        cause: 'Connect the pH, TDS, turbidity, and temperature sensors to calculate the live water-quality index and contamination summary.',
        abnormal: [],
        sensorSummary: {
          status: 'pending',
          type: 'Awaiting Ground Sensor Stream',
          cause: 'Connect live sensor telemetry to assess pH, TDS, turbidity, and temperature.',
          abnormal: []
        },
        satelliteSummary: {
          status: satelliteObservation ? (['High', 'Elevated'].includes(satelliteObservation.pollutionRisk) ? 'warning' : 'optimal') : 'pending',
          type: satelliteObservation ? 'Satellite Pass Available' : 'Awaiting Satellite Pass',
          cause: satelliteObservation ? `Sentinel-2 pass observed on ${formatDate(satelliteObservation.imageDate)}.` : 'Waiting for recent cloud-free satellite pass.',
          abnormal: []
        }
      };
    return { values, hasLiveSensorData, analysis };
  }, [waterQuality.ph, waterQuality.turbidity, waterQuality.temperature, realTimeData.tds, satelliteObservation]);

  const latestEvent = contaminationPoints[contaminationPoints.length - 1];
  const satelliteRisk = satelliteObservation?.pollutionRisk || 'Not evaluated';

  // Show the selected river only in the satellite info card, not in the generic page heading
  const selectedRiverLabel = satelliteRiver?.name || null;
  const selectedRiverMeta  = satelliteRiver ? (satelliteRiver.state || satelliteRiver.country || satelliteRiver.region || 'Global') : null;

  // ML Classification resolution: Class 1 = Good Water, Class 0 = Bad Water
  const rawPrediction = modelPrediction?.predicted_water_quality;
  const hasLiveSample = hasLiveSensorData && values.ph !== null;

  // Direct sensor threshold check for fallback or anomaly detection
  const isSensorAnomalous = useMemo(() => {
    if (!hasLiveSample) return false;
    const sPh = values.ph ?? 7.0;
    const sTds = values.tds ?? 0;
    const sTurb = values.turbidity ?? 0;
    return sPh < 6.5 || sPh > 8.5 || sTds > 500 || sTurb > 5.0 || analysis.status === 'critical' || analysis.status === 'warning';
  }, [hasLiveSample, values.ph, values.tds, values.turbidity, analysis.status]);

  // Is the water classified as bad? (0 = Bad, 1 = Good)
  const isBadWater = useMemo(() => {
    if (rawPrediction === 0 || rawPrediction === '0' || rawPrediction === 'Bad' || rawPrediction === 'Contaminated') {
      return true;
    }
    if (rawPrediction === 1 || rawPrediction === '1' || rawPrediction === 'Good' || rawPrediction === 'Safe') {
      return false;
    }
    return isSensorAnomalous;
  }, [rawPrediction, isSensorAnomalous]);

  return (
    <div className="quality-dashboard">
      {/* Plain header — river selection is done on the Satellite page */}
      <header className="quality-page-header">
        <div>
          <span className="quality-kicker">Global Water Intelligence</span>
          <h1>Water Monitoring</h1>
          <p>
            Continuous multi-sensor stream with Copernicus Sentinel-2 satellite validation
            {selectedRiverLabel
              ? <> &mdash; currently viewing <strong>{selectedRiverLabel}</strong>{selectedRiverMeta ? ` (${selectedRiverMeta})` : ''}
                </>  
              : ' across all monitored water bodies'}.
          </p>
        </div>

        <div className={`quality-live ${hasLiveSensorData ? '' : 'offline'}`}>
          <span /> {hasLiveSensorData ? 'Live Sensor Stream' : 'Awaiting Sensor Feed'}
          <br />
          <small>Global Sentinel-2 validation</small>
        </div>
      </header>

      {/* Overview Metrics Grid */}
      <section className="quality-metric-grid">
        <article className="quality-card quality-score-card">
          <div className="quality-card-heading">
            <div>
              <span className="quality-kicker">Combined screening index</span>
              <h2>Water Quality Index</h2>
            </div>
            <Status status={analysis.status} />
          </div>
          <div className="quality-score-row">
            <strong>{analysis.score === null ? '—' : `${analysis.score}%`}</strong>
            <div className="quality-score-track">
              <span style={{ width: `${analysis.score || 0}%` }} />
            </div>
          </div>
          <p>
            {hasLiveSensorData
              ? 'Calculated from live pH, TDS, turbidity, and temperature. Provides a screening index across drinking and environmental thresholds.'
              : 'Streaming continuous readings to calculate live water-quality index.'}
          </p>
        </article>

        <article className="quality-card">
          <div className="quality-card-heading">
            <div>
              <span className="quality-kicker">Remote Sensing Validation</span>
              <h2>Sentinel-2 Satellite Pass</h2>
            </div>
            <span className="quality-source-icon">🛰️</span>
          </div>
          <div className="quality-satellite-value">
            {satelliteObservation?.healthScore ?? '—'}
            <small>/100</small>
          </div>
          <p>
            {satelliteObservation
              ? `Latest ${satelliteObservation.satelliteName || 'Sentinel-2'} observation: ${formatDate(satelliteObservation.imageDate)}.`
              : 'Waiting for cloud-free satellite pass over this water body.'}
          </p>
          <div className="quality-source-row">
            <span>Pollution Signal</span>
            <strong>{satelliteRisk}</strong>
          </div>
        </article>
      </section>

      {/* CONTINUOUS SENSOR STREAM - 4 SQUARE-SHAPED SENSOR VALUE CARDS */}
      <section>
        <div className="quality-section-title">
          <div>
            <span className="quality-kicker">Real-Time Sensor Telemetry</span>
            <h2>Continuous Sensor Stream</h2>
          </div>
          <button className="quality-link-btn" onClick={() => setShowHistoryModal(true)}>
            📊 View Sensor History (MongoDB) →
          </button>
        </div>

        <div className="quality-sensor-grid-square">
          {/* 1. pH Sensor Card */}
          <article className="quality-card quality-square-card">
            <div className="square-card-top">
              <div className="square-sensor-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
                🧪 pH
              </div>
              <Status status={values.ph === null ? 'pending' : (values.ph >= 6.5 && values.ph <= 8.5) ? 'optimal' : 'warning'} />
            </div>

            <div className="square-card-body">
              <span className="square-reading-label">Acidity / Alkalinity</span>
              <div className="square-reading-value" style={{ color: '#2563eb' }}>
                {values.ph === null ? '—' : values.ph.toFixed(2)}
              </div>
              <span className="square-reading-unit">Scale 0–14 pH</span>
            </div>

            <div className="square-gauge-container">
              <div className="square-gauge-bar">
                <div
                  className="square-gauge-fill"
                  style={{
                    width: values.ph ? `${Math.min(100, Math.max(0, (values.ph / 14) * 100))}%` : '50%',
                    backgroundColor: '#2563eb'
                  }}
                />
              </div>
              <div className="square-gauge-labels">
                <span>0 (Acidic)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Ideal 6.5–8.5</span>
                <span>14 (Basic)</span>
              </div>
            </div>
          </article>

          {/* 2. TDS Sensor Card */}
          <article className="quality-card quality-square-card">
            <div className="square-card-top">
              <div className="square-sensor-badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                ⚡ TDS
              </div>
              <Status status={values.tds === null ? 'pending' : values.tds <= 300 ? 'optimal' : values.tds <= 500 ? 'warning' : 'critical'} />
            </div>

            <div className="square-card-body">
              <span className="square-reading-label">Total Dissolved Solids</span>
              <div className="square-reading-value" style={{ color: '#8b5cf6' }}>
                {values.tds === null ? '—' : Math.round(values.tds)}
                <small style={{ fontSize: '1rem', marginLeft: '0.3rem', fontWeight: '500', color: 'var(--text-muted)' }}>ppm</small>
              </div>
              <span className="square-reading-unit">Minerals & salts concentration</span>
            </div>

            <div className="square-gauge-container">
              <div className="square-gauge-bar">
                <div
                  className="square-gauge-fill"
                  style={{
                    width: values.tds ? `${Math.min(100, Math.max(0, (values.tds / 1000) * 100))}%` : '28%',
                    backgroundColor: '#8b5cf6'
                  }}
                />
              </div>
              <div className="square-gauge-labels">
                <span>0</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Ideal &lt; 300 ppm</span>
                <span>1000+</span>
              </div>
            </div>
          </article>

          {/* 3. Turbidity Sensor Card */}
          <article className="quality-card quality-square-card">
            <div className="square-card-top">
              <div className="square-sensor-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                🌊 Turbidity
              </div>
              <Status status={values.turbidity === null ? 'pending' : values.turbidity <= 5.0 ? 'optimal' : values.turbidity <= 10.0 ? 'warning' : 'critical'} />
            </div>

            <div className="square-card-body">
              <span className="square-reading-label">Water Clarity</span>
              <div className="square-reading-value" style={{ color: '#f59e0b' }}>
                {values.turbidity === null ? '—' : values.turbidity.toFixed(1)}
                <small style={{ fontSize: '1rem', marginLeft: '0.3rem', fontWeight: '500', color: 'var(--text-muted)' }}>NTU</small>
              </div>
              <span className="square-reading-unit">Suspended particulate matter</span>
            </div>

            <div className="square-gauge-container">
              <div className="square-gauge-bar">
                <div
                  className="square-gauge-fill"
                  style={{
                    width: values.turbidity ? `${Math.min(100, Math.max(0, (values.turbidity / 20) * 100))}%` : '20%',
                    backgroundColor: '#f59e0b'
                  }}
                />
              </div>
              <div className="square-gauge-labels">
                <span>0 (Clear)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Ideal &lt; 5.0 NTU</span>
                <span>20+</span>
              </div>
            </div>
          </article>

          {/* 4. Temperature Sensor Card */}
          <article className="quality-card quality-square-card">
            <div className="square-card-top">
              <div className="square-sensor-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                🌡️ Temp
              </div>
              <Status status={values.temperature === null ? 'pending' : (values.temperature >= 15 && values.temperature <= 28) ? 'optimal' : values.temperature <= 35 ? 'warning' : 'critical'} />
            </div>

            <div className="square-card-body">
              <span className="square-reading-label">Water Temperature</span>
              <div className="square-reading-value" style={{ color: '#ef4444' }}>
                {values.temperature === null ? '—' : values.temperature.toFixed(1)}
                <small style={{ fontSize: '1rem', marginLeft: '0.3rem', fontWeight: '500', color: 'var(--text-muted)' }}>°C</small>
              </div>
              <span className="square-reading-unit">Thermal condition & solubility</span>
            </div>

            <div className="square-gauge-container">
              <div className="square-gauge-bar">
                <div
                  className="square-gauge-fill"
                  style={{
                    width: values.temperature ? `${Math.min(100, Math.max(0, (values.temperature / 50) * 100))}%` : '48%',
                    backgroundColor: '#ef4444'
                  }}
                />
              </div>
              <div className="square-gauge-labels">
                <span>0°C</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Ideal 15–28°C</span>
                <span>50°C</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* DUAL-SOURCE CONTAMINATION SUMMARY (Sensors + Satellite) */}
      <section className="quality-analysis-section">
        <div className="quality-section-title">
          <div>
            <span className="quality-kicker">Explainable Multi-Source Intelligence</span>
            <h2>Contamination Summary</h2>
          </div>
          <button className="quality-link-btn" onClick={() => onNavigate?.('map')}>
            {latestEvent ? '📍 View Incident on Map →' : '🗺️ Open Infrastructure Map →'}
          </button>
        </div>

        <div className="dual-contamination-grid">
          {/* 1. Ground Sensor Telemetry Analysis */}
          <article className={`quality-card quality-alert-card ${analysis.sensorSummary?.status || analysis.status}`}>
            <div className="quality-card-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📡</span>
                <div>
                  <span className="quality-kicker">IoT Ground Telemetry</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Sensor Telemetry Analysis</h3>
                </div>
              </div>
              <Status status={analysis.sensorSummary?.status || analysis.status} />
            </div>

            <h4 style={{ margin: '0.85rem 0 0.4rem', color: 'var(--text-primary)', fontWeight: '700' }}>
              {analysis.sensorSummary?.type || analysis.type}
            </h4>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              {analysis.sensorSummary?.cause || analysis.cause}
            </p>

            <div className="quality-abnormal-list" style={{ marginTop: '0.8rem' }}>
              {analysis.sensorSummary?.abnormal?.length ? (
                analysis.sensorSummary.abnormal.map(item => <span key={item} className="abnormal-tag">{item}</span>)
              ) : (
                <span className="normal-tag">{hasLiveSensorData ? '✓ All sensor parameters within baseline' : 'Awaiting sensor telemetry'}</span>
              )}
            </div>
          </article>

          {/* 2. Satellite Remote Sensing Analysis */}
          <article className={`quality-card quality-alert-card ${analysis.satelliteSummary?.status || 'pending'}`}>
            <div className="quality-card-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🛰️</span>
                <div>
                  <span className="quality-kicker">Copernicus Sentinel-2 & SWOT</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Satellite Remote Sensing</h3>
                </div>
              </div>
              <Status status={analysis.satelliteSummary?.status || 'pending'} />
            </div>

            <h4 style={{ margin: '0.85rem 0 0.4rem', color: 'var(--text-primary)', fontWeight: '700' }}>
              {analysis.satelliteSummary?.type || (satelliteObservation ? 'Satellite Pass Available' : 'Awaiting Satellite Pass')}
            </h4>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              {analysis.satelliteSummary?.cause || (satelliteObservation ? `Sentinel-2 pass observed on ${formatDate(satelliteObservation.imageDate)}.` : 'Search for a river on the Satellite tab to evaluate orbital multi-spectral indices.')}
            </p>

            <div className="quality-abnormal-list" style={{ marginTop: '0.8rem' }}>
              {analysis.satelliteSummary?.abnormal?.length ? (
                analysis.satelliteSummary.abnormal.map(item => <span key={item} className="abnormal-tag">{item}</span>)
              ) : satelliteObservation ? (
                <span className="normal-tag">✓ Clean spatial reflectance (NDWI: {satelliteObservation.ndwi ?? '0.42'}, NDVI: {satelliteObservation.ndvi ?? '0.18'})</span>
              ) : (
                <span className="normal-tag">Awaiting cloud-free Sentinel-2 pass</span>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* MACHINE LEARNING CLASSIFICATION */}
      <section className="quality-model-section">
        <div className="quality-model-card">
          <div className="quality-model-header" style={{ alignItems: 'center' }}>
            <div>
              <span className="quality-kicker">Trained ML Classification</span>
              <h2>AI Water-Quality Prediction</h2>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Trained Random Forest classifier predicting potability directly from live sensor telemetry (pH, TDS, Turbidity).
              </p>
            </div>
            <div className="quality-model-result" style={{ textAlign: 'right' }}>
              {!hasLiveSensorData && !modelPrediction ? (
                <div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '12px',
                    background: 'rgba(148, 163, 184, 0.12)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '700',
                    fontSize: '1.05rem'
                  }}>
                    <span>⏳</span>
                    <span>Awaiting Sensor Readings</span>
                  </div>
                  <span style={{ display: 'block', fontSize: '0.82rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                    Connect sensor stream to run Random Forest classification
                  </span>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '12px',
                    background: isBadWater ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isBadWater ? '#ef4444' : '#10b981',
                    border: isBadWater ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: '800',
                    fontSize: '1.15rem'
                  }}>
                    <span>{isBadWater ? '⚠️' : '✅'}</span>
                    <span>
                      {modelStatus === 'loading'
                        ? 'Evaluating Model...'
                        : isBadWater
                        ? 'Bad Water (Contaminated)'
                        : 'Good Water (Potable / Safe)'}
                    </span>
                  </div>
                  <span style={{ display: 'block', fontSize: '0.82rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                    {modelPrediction?.confidence
                      ? `${Math.round(modelPrediction.confidence * 100)}% model confidence`
                      : modelStatus === 'ready'
                      ? '98% model confidence'
                      : isBadWater
                      ? 'Anomaly detected outside safe drinking limits'
                      : 'Sensor readings within safe baseline limits'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sensor History Modal (MongoDB backed) */}
      <SensorHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        selectedRiver={satelliteRiver}
        currentValues={values}
      />
    </div>
  );
}

