import RiverSearch from './RiverSearch';

export default function SatelliteHeader({ onSelectRiver }) {
  return (
    <div className="sat-header-section glass-card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="sat-live-indicator pulse"></span>
        <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem' }}>
          Satellite Water-body Monitoring
        </h1>
      </div>

      <RiverSearch onSelectRiver={onSelectRiver} />
    </div>
  );
}