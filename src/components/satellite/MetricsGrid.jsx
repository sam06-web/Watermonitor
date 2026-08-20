export default function MetricsGrid({ observation }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 className="chart-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>📊</span> River Biophysical & Remote Sensing Indices
      </h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">River Width</span>
            <div className="metric-icon" style={{ color: '#38bdf8' }}>📏</div>
          </div>
          <div className="metric-value">
            {observation.riverWidthMeters} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>m</span>
          </div>
          <div className="metric-status good">
            <span>SWOT Reach Calibrated</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Water Surface Area</span>
            <div className="metric-icon" style={{ color: '#06b6d4' }}>🌊</div>
          </div>
          <div className="metric-value">
            {observation.waterAreaSqKm} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>km²</span>
          </div>
          <div className="metric-status good">
            <span>{(observation.waterAreaSqKm * 100).toFixed(0)} Hectares</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Surface Temperature</span>
            <div className="metric-icon" style={{ color: '#f59e0b' }}>🌡️</div>
          </div>
          <div className="metric-value">
            {observation.surfaceTemperatureC} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>°C</span>
          </div>
          <div className="metric-status good">
            <span>ERA5 Land Thermal</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Estimated Turbidity</span>
            <div className="metric-icon" style={{ color: observation.turbidityNtu > 25 ? '#ef4444' : '#10b981' }}>🧪</div>
          </div>
          <div className="metric-value">
            {observation.turbidityNtu} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>NTU</span>
          </div>
          <div className={`metric-status ${observation.turbidityNtu < 15 ? 'good' : observation.turbidityNtu < 30 ? 'warning' : 'critical'}`}>
            <span>{observation.turbidityNtu < 15 ? 'Clear Water' : observation.turbidityNtu < 30 ? 'Moderate Turbidity' : 'High Turbidity'}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">NDWI (Water Index)</span>
            <div className="metric-icon" style={{ color: '#00f0ff' }}>💧</div>
          </div>
          <div className="metric-value" style={{ color: '#00f0ff' }}>
            {observation.ndwi > 0 ? `+${observation.ndwi}` : observation.ndwi}
          </div>
          <div className="metric-status good">
            <span>(B3 - B8) / (B3 + B8)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">NDVI (Riparian Buffer)</span>
            <div className="metric-icon" style={{ color: '#22c55e' }}>🌿</div>
          </div>
          <div className="metric-value" style={{ color: '#22c55e' }}>
            +{observation.ndvi}
          </div>
          <div className="metric-status good">
            <span>Dense Vegetative Buffer</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Flood Risk Status</span>
            <div className="metric-icon" style={{ color: observation.floodRiskPct > 50 ? '#ef4444' : '#3b82f6' }}>⚠️</div>
          </div>
          <div className="metric-value" style={{ color: observation.floodStatus === 'Low' ? 'var(--success-green)' : observation.floodStatus === 'Moderate' ? 'var(--warning-amber)' : 'var(--danger-red)' }}>
            {observation.floodStatus} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({observation.floodRiskPct}%)</span>
          </div>
          <div className={`metric-status ${observation.floodRiskPct < 30 ? 'good' : observation.floodRiskPct < 60 ? 'warning' : 'critical'}`}>
            <span>{observation.floodRiskPct < 30 ? 'Safe Margins' : 'Elevated Inflow'}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Water Level / Elevation</span>
            <div className="metric-icon" style={{ color: '#8b5cf6' }}>📈</div>
          </div>
          <div className="metric-value">
            {observation.waterLevelMeters ?? '—'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>m ASL</span>
          </div>
          <div className="metric-status good">
            <span>WSE Altimetry</span>
          </div>
        </div>
      </div>
    </div>
  );
}