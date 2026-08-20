export default function AiInsights({ observation }) {
  const healthGrade = observation.healthScore >= 85 ? 'Excellent' : observation.healthScore >= 70 ? 'Good' : observation.healthScore >= 50 ? 'Fair' : 'Poor';
  const healthGradeColor = observation.healthScore >= 85 ? 'var(--success-green)' : observation.healthScore >= 70 ? 'var(--accent-cyan)' : observation.healthScore >= 50 ? 'var(--warning-amber)' : 'var(--danger-red)';
  const ndviValue = Number(observation.ndvi);
  const ndviLabel = !Number.isFinite(ndviValue)
    ? '—'
    : ndviValue < 0 ? 'Water / Barren'
    : ndviValue < 0.2 ? 'Sparse / Degraded'
    : ndviValue < 0.4 ? 'Moderate'
    : ndviValue < 0.6 ? 'Dense'
    : 'Very Dense';
  const ndviDisplay = Number.isFinite(ndviValue) ? `NDVI ${ndviValue >= 0 ? '+' : ''}${ndviValue.toFixed(3)}` : 'NDVI —';

  return (
    <div className="glass-card sat-ai-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="sat-ai-badge">🤖 AI Remote Sensing Engine</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Hydrological Health, Flood Dynamics & Environmental Risk Synthesis
        </div>
      </div>

      <div className="sat-ai-grid">
        <div className="sat-ai-score-box">
          <div className="sat-score-circle">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#dbe7ef" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#0891b2"
                strokeWidth="8"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * observation.healthScore) / 100}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="sat-score-value">
              {observation.healthScore}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/100</span>
            </div>
          </div>
          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            River Health: <span style={{ color: healthGradeColor }}>{observation.healthScore} ({healthGrade})</span>
          </div>
        </div>

        <div className="sat-ai-matrix">
          <div className="sat-matrix-item">
            <div className="sat-matrix-label">Water Availability</div>
            <div className="sat-matrix-val" style={{ color: 'var(--accent-teal)' }}>
              💧 {observation.waterAvailability || 'Stable'}
            </div>
          </div>

          <div className="sat-matrix-item">
            <div className="sat-matrix-label">Flood Warning</div>
            <div className="sat-matrix-val" style={{ color: observation.floodStatus === 'Low' ? 'var(--success-green)' : observation.floodStatus === 'Critical' ? 'var(--danger-red)' : 'var(--warning-amber)' }}>
              🛡️ {observation.floodStatus === 'Low' ? 'Low Risk (Normal)' : `${observation.floodStatus} Risk`}
            </div>
          </div>

          <div className="sat-matrix-item">
            <div className="sat-matrix-label">Pollution Risk</div>
            <div className="sat-matrix-val" style={{ color: observation.pollutionRisk === 'Low' ? 'var(--success-green)' : observation.pollutionRisk === 'High' ? 'var(--danger-red)' : 'var(--warning-amber)' }}>
              🌱 {observation.pollutionRisk || 'Low'}
            </div>
          </div>

          <div className="sat-matrix-item">
            <div className="sat-matrix-label">Vegetative Riparian Health</div>
            <div className="sat-matrix-val" style={{ color: ndviValue < 0.2 ? 'var(--warning-amber)' : '#22c55e' }}>
              🌿 {ndviDisplay} ({ndviLabel})
            </div>
          </div>
        </div>
      </div>

      <div className="sat-ai-text-box">
        <div style={{ marginBottom: '0.75rem' }}>
          <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>SATELLITE SYNTHESIS SUMMARY:</strong>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.925rem', marginTop: '0.25rem', lineHeight: '1.6' }}>
            {observation.aiSummary}
          </p>
        </div>

        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
          <strong style={{ color: 'var(--warning-amber)', fontSize: '0.9rem' }}>RECOMMENDATION:</strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {observation.aiRecommendation}
          </p>
        </div>
      </div>
    </div>
  );
}