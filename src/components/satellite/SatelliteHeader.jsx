import RiverSearch from './RiverSearch';

export default function SatelliteHeader({ isRefreshing, isLoading, hasRiver, onRefresh, onSelectRiver }) {
  return (
    <div className="sat-header-section glass-card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="sat-live-indicator pulse"></span>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem' }}>
              Satellite Water-body Monitoring
            </h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
            High-resolution remote sensing, spectral indices, and hydrological AI analysis
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="sat-latest-badge">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>OBSERVATION MODE:</span>
            <strong style={{ color: 'var(--accent-cyan)', marginLeft: '0.4rem', fontSize: '0.85rem' }}>
              Latest Satellite Pass
            </strong>
          </div>

          <button
            className={`btn btn-primary ${isRefreshing ? 'sat-btn-spinning' : ''}`}
            onClick={onRefresh}
            disabled={isRefreshing || isLoading || !hasRiver}
            title={!hasRiver ? 'Search for a water body first' : 'Fetch the latest satellite pass'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              fontSize: '0.9rem',
              opacity: !hasRiver ? 0.45 : 1
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {isRefreshing ? 'Fetching New Pass...' : 'Refresh Observation'}
          </button>
        </div>
      </div>

      <RiverSearch onSelectRiver={onSelectRiver} />
    </div>
  );
}