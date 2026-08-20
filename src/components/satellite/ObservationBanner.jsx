const formatUtcDate = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-CA', { timeZone: 'UTC' });
};

const formatUtcTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return `${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC`;
};

export default function ObservationBanner({ observation }) {
  return (
    <div className="glass-card sat-observation-banner" style={{ marginBottom: '1.5rem' }}>
      <div className="sat-obs-grid">
        <div className="sat-obs-item">
          <div className="sat-obs-icon">🛰️</div>
          <div>
            <div className="sat-obs-label">Satellite Mission</div>
            <div className="sat-obs-value">{observation.satelliteName}</div>
            <div className="sat-obs-sub">{observation.sensor}</div>
          </div>
        </div>

        <div className="sat-obs-item">
          <div className="sat-obs-icon"></div>
          <div>
            <div className="sat-obs-label">Acquisition Date</div>
            <div className="sat-obs-value">{formatUtcDate(observation.imageTimestamp || observation.imageDate)}</div>
            <div className="sat-obs-sub">
              {formatUtcTime(observation.imageTimestamp || observation.imageDate)}
            </div>
          </div>
        </div>

        <div className="sat-obs-item">
          <div className="sat-obs-icon">☁️</div>
          <div>
            <div className="sat-obs-label">Cloud Cover</div>
            <div className="sat-obs-value" style={{ color: observation.cloudCover < 20 ? 'var(--success-green)' : 'var(--warning-amber)' }}>
              {observation.cloudCover}%
            </div>
            <div className="sat-obs-sub">
              {observation.cloudCover < 15 ? 'Optimal Visibility' : 'Partially Obscured'}
            </div>
          </div>
        </div>

        <div className="sat-obs-item">
          <div className="sat-obs-icon">🎯</div>
          <div>
            <div className="sat-obs-label">Spatial Resolution</div>
            <div className="sat-obs-value">{observation.resolution}</div>
            <div className="sat-obs-sub">Bottom-Of-Atmosphere (BOA)</div>
          </div>
        </div>
      </div>
    </div>
  );
}