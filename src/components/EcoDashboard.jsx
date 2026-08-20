import { useMemo } from 'react';
import { analyzeContamination } from '../utils/waterQuality';

const formatDate = value => value ? new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available';

function Status({ status }) {
  const label = status === 'critical' ? 'Critical' : status === 'warning' ? 'Needs attention' : status === 'pending' ? 'Waiting for data' : 'Normal';
  return <span className={`quality-status ${status}`}><span />{label}</span>;
}

export default function EcoDashboard({ realTimeData = {}, waterQuality = {}, satelliteObservation, satelliteRiver, contaminationPoints = [], modelPrediction, modelStatus = 'idle', onNavigate }) {
  const { values, hasLiveSensorData, analysis } = useMemo(() => {
    const getSensorValue = value => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
    };
    const values = {
      ph: getSensorValue(waterQuality.ph),
      turbidity: getSensorValue(waterQuality.turbidity),
      tds: getSensorValue(realTimeData.tds)
    };
    const hasLiveSensorData = Object.values(values).every(value => value !== null);
    const analysis = hasLiveSensorData
      ? analyzeContamination({ ...values, satellite: satelliteObservation })
      : {
        score: null,
        status: 'pending',
        components: { ph: 0, tds: 0, turbidity: 0 },
        type: 'Sensor data unavailable',
        cause: 'Connect the pH, TDS, and turbidity sensors to calculate the live water-quality index and contamination summary.',
        abnormal: []
      };
    return { values, hasLiveSensorData, analysis };
  }, [waterQuality.ph, waterQuality.turbidity, realTimeData.tds, satelliteObservation]);
  const latestEvent = contaminationPoints[contaminationPoints.length - 1];
  const satelliteRisk = satelliteObservation?.pollutionRisk || 'Not evaluated';

  return (
    <div className="quality-dashboard">
      <header className="quality-page-header">
        <div><span className="quality-kicker">Public water intelligence</span><h1>Water Quality Overview</h1><p>Continuous sensor readings with periodic satellite validation for {satelliteRiver?.name || 'your monitored water body'}.</p></div>
        <div className={`quality-live ${hasLiveSensorData ? '' : 'offline'}`}><span /> {hasLiveSensorData ? 'Sensors live' : 'Sensors awaiting connection'}<br /><small>Satellite pass every ~4 days</small></div>
      </header>

      <section className="quality-metric-grid">
        <article className="quality-card quality-score-card"><div className="quality-card-heading"><div><span className="quality-kicker">Combined screening index</span><h2>Water Quality Index</h2></div><Status status={analysis.status} /></div><div className="quality-score-row"><strong>{analysis.score === null ? '—' : `${analysis.score}%`}</strong><div className="quality-score-track"><span style={{ width: `${analysis.score || 0}%` }} /></div></div><p>{hasLiveSensorData ? 'Calculated from pH, TDS, and turbidity. This is a transparent screening indicator, not a laboratory certification.' : 'Connect all three sensor readings to calculate a live water-quality index.'}</p></article>
        <article className="quality-card"><div className="quality-card-heading"><div><span className="quality-kicker">Remote sensing</span><h2>Satellite validation</h2></div><span className="quality-source-icon">◉</span></div><div className="quality-satellite-value">{satelliteObservation?.healthScore ?? '—'}<small>/100</small></div><p>{satelliteObservation ? `Latest ${satelliteObservation.satelliteName || 'satellite'} pass: ${formatDate(satelliteObservation.imageDate)}.` : 'Waiting for the latest satellite observation.'}</p><div className="quality-source-row"><span>Pollution signal</span><strong>{satelliteRisk}</strong></div></article>
      </section>

      <section><div className="quality-section-title"><div><span className="quality-kicker">Continuous sensor stream</span><h2>What sensors see now</h2></div><button className="quality-link" onClick={() => onNavigate?.('flow-monitor')}>View sensor history →</button></div><div className="quality-sensor-grid">
        <article className="quality-card"><span className="quality-kicker">pH</span><strong className="quality-reading">{values.ph === null ? '—' : values.ph.toFixed(2)}</strong><span className="quality-unit">Acidity / alkalinity</span><Status status={values.ph === null ? 'pending' : analysis.components.ph >= 80 ? 'normal' : 'warning'} /></article>
        <article className="quality-card"><span className="quality-kicker">TDS</span><strong className="quality-reading">{values.tds === null ? '—' : <>{Math.round(values.tds)} <small>ppm</small></>}</strong><span className="quality-unit">Dissolved solids</span><Status status={values.tds === null ? 'pending' : analysis.components.tds >= 80 ? 'normal' : analysis.components.tds >= 60 ? 'warning' : 'critical'} /></article>
        <article className="quality-card"><span className="quality-kicker">Turbidity</span><strong className="quality-reading">{values.turbidity === null ? '—' : <>{values.turbidity.toFixed(1)} <small>NTU</small></>}</strong><span className="quality-unit">Water clarity</span><Status status={values.turbidity === null ? 'pending' : analysis.components.turbidity >= 80 ? 'normal' : analysis.components.turbidity >= 60 ? 'warning' : 'critical'} /></article>
      </div></section>

      <section className="quality-analysis-grid">
        <article className={`quality-card quality-alert-card ${analysis.status}`}>
          <div className="quality-card-heading">
            <div><span className="quality-kicker">Explainable analysis</span><h2>Contamination summary</h2></div>
            <Status status={analysis.status} />
          </div>
          <h3>{analysis.type}</h3>
          <p>{analysis.cause}</p>
          <div className="quality-abnormal-list">
            {analysis.abnormal.length ? analysis.abnormal.map(item => <span key={item}>{item}</span>) : <span>{hasLiveSensorData ? 'No abnormal indicators' : 'No sensor assessment yet'}</span>}
          </div>
          <button className="quality-link" onClick={() => onNavigate?.('map')}>{latestEvent ? 'Open affected location →' : 'Open monitoring map →'}</button>
        </article>
      </section>

      
      <section className="quality-model-card"><div><span className="quality-kicker"></span><h2>ML water-quality prediction</h2><p>Raw classifier output for the current pH, TDS, and turbidity sample. Class meanings follow the model training labels and are intentionally not inferred here.</p></div><div className="quality-model-result"><strong>{modelStatus === 'ready' ? modelPrediction?.predicted_water_quality ?? '—' : modelStatus === 'loading' ? '…' : '—'}</strong><span>{modelStatus === 'ready' ? `${Math.round((modelPrediction?.confidence || 0) * 100)}% confidence` : modelStatus === 'unavailable' ? 'Python service unavailable' : 'Waiting for sensor sample'}</span></div></section>
    </div>
  );
}
