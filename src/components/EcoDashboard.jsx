import { useMemo } from 'react';
import { analyzeContamination } from '../utils/waterQuality';

const formatDate = value => value ? new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available';

function Status({ status }) {
  const label = status === 'critical' ? 'Critical' : status === 'warning' ? 'Needs attention' : 'Normal';
  return <span className={`quality-status ${status}`}><span />{label}</span>;
}

export default function EcoDashboard({ realTimeData = {}, waterQuality = {}, satelliteObservation, satelliteRiver, contaminationPoints = [], onNavigate, onShowToast }) {
  const values = {
    ph: Number(waterQuality.ph) || 7.2,
    turbidity: Number(waterQuality.turbidity) || 2.1,
    tds: Number(realTimeData.tds) || 420
  };
  const analysis = useMemo(() => analyzeContamination({ ...values, satellite: satelliteObservation }), [values.ph, values.turbidity, values.tds, satelliteObservation]);
  const latestEvent = contaminationPoints[contaminationPoints.length - 1];
  const satelliteRisk = satelliteObservation?.pollutionRisk || 'Not evaluated';

  const handleDemoAlert = () => {
    onShowToast?.({ title: 'Use a sensor simulator', message: 'Publish a payload containing lat, lng, ph, tds_ppm, and turbidity to create a mapped quality event.', type: 'info' });
  };

  return (
    <div className="quality-dashboard">
      <header className="quality-page-header">
        <div><span className="quality-kicker">Public water intelligence</span><h1>Water Quality Overview</h1><p>Continuous sensor readings with periodic satellite validation for {satelliteRiver?.name || 'your monitored water body'}.</p></div>
        <div className="quality-live"><span /> Sensors live<br /><small>Satellite pass every ~4 days</small></div>
      </header>

      <section className="quality-metric-grid">
        <article className="quality-card quality-score-card"><div className="quality-card-heading"><div><span className="quality-kicker">Combined screening index</span><h2>Water Quality Index</h2></div><Status status={analysis.status} /></div><div className="quality-score-row"><strong>{analysis.score}%</strong><div className="quality-score-track"><span style={{ width: `${analysis.score}%` }} /></div></div><p>Calculated from pH, TDS, and turbidity. This is a transparent screening indicator, not a laboratory certification.</p></article>
        <article className="quality-card"><div className="quality-card-heading"><div><span className="quality-kicker">Remote sensing</span><h2>Satellite validation</h2></div><span className="quality-source-icon">◉</span></div><div className="quality-satellite-value">{satelliteObservation?.healthScore ?? '—'}<small>/100</small></div><p>{satelliteObservation ? `Latest ${satelliteObservation.satelliteName || 'satellite'} pass: ${formatDate(satelliteObservation.imageDate)}.` : 'Waiting for the latest satellite observation.'}</p><div className="quality-source-row"><span>Pollution signal</span><strong>{satelliteRisk}</strong></div></article>
      </section>

      <section><div className="quality-section-title"><div><span className="quality-kicker">Continuous sensor stream</span><h2>What sensors see now</h2></div><button className="quality-link" onClick={() => onNavigate?.('flow-monitor')}>View sensor history →</button></div><div className="quality-sensor-grid">
        <article className="quality-card"><span className="quality-kicker">pH</span><strong className="quality-reading">{values.ph.toFixed(2)}</strong><span className="quality-unit">Acidity / alkalinity</span><Status status={analysis.components.ph >= 80 ? 'normal' : 'warning'} /></article>
        <article className="quality-card"><span className="quality-kicker">TDS</span><strong className="quality-reading">{Math.round(values.tds)} <small>ppm</small></strong><span className="quality-unit">Dissolved solids</span><Status status={analysis.components.tds >= 80 ? 'normal' : analysis.components.tds >= 60 ? 'warning' : 'critical'} /></article>
        <article className="quality-card"><span className="quality-kicker">Turbidity</span><strong className="quality-reading">{values.turbidity.toFixed(1)} <small>NTU</small></strong><span className="quality-unit">Water clarity</span><Status status={analysis.components.turbidity >= 80 ? 'normal' : analysis.components.turbidity >= 60 ? 'warning' : 'critical'} /></article>
      </div></section>

      <section className="quality-analysis-grid"><article className={`quality-card quality-alert-card ${analysis.status}`}><div className="quality-card-heading"><div><span className="quality-kicker">Explainable analysis</span><h2>Contamination summary</h2></div><Status status={analysis.status} /></div><h3>{analysis.type}</h3><p>{analysis.cause}</p><div className="quality-abnormal-list">{analysis.abnormal.length ? analysis.abnormal.map(item => <span key={item}>{item}</span>) : <span>No abnormal indicators</span>}</div><button className="quality-link" onClick={() => onNavigate?.('map')}>{latestEvent ? 'Open affected location →' : 'Open monitoring map →'}</button></article><article className="quality-card"><div className="quality-card-heading"><div><span className="quality-kicker">Spatial context</span><h2>Where should people look?</h2></div><span className="quality-location-pin">⌖</span></div>{latestEvent ? <><div className="quality-location-name">{latestEvent.location || 'Sensor station'}</div><p>Quality event detected by continuous sensor data. The map will automatically focus on this location.</p><button className="quality-primary-button" onClick={() => onNavigate?.('map')}>View affected location</button></> : <><div className="quality-location-name">No active contamination point</div><p>When a sensor payload includes coordinates and abnormal values, the affected water body will be marked and focused automatically.</p><button className="quality-secondary-button" onClick={handleDemoAlert}>How to send a sensor event</button></>}</article></section>

      <section className="quality-transparency-note"><strong>Why combine both sources?</strong><span>Sensors provide continuous local measurements. Satellite imagery arrives less frequently, but validates wider spatial conditions with high-resolution remote sensing. Together they give communities both timely alerts and broader context.</span></section>
    </div>
  );
}
