const WaterQuality = ({ detailed = false, realTimeData = {}, waterQualityMetrics = {} }) => {
    const hasPh = Boolean(waterQualityMetrics.ph);

    // Derive the live metric values directly from props on every render instead of
    // syncing them through effects, keeping the component a pure projection of its input.
    const defaults = {
        ph: { value: 0, status: 'good', unit: 'pH' },
        turbidity: { value: 0, status: 'good', unit: 'NTU' },
        tds: { value: 145, status: 'good', unit: 'ppm' }
    };

    const liveMetrics = {
        ...defaults,
        ph: { ...defaults.ph, value: hasPh ? waterQualityMetrics.ph : defaults.ph.value },
        turbidity: { ...defaults.turbidity, value: hasPh ? (waterQualityMetrics.turbidity ?? 0) : defaults.turbidity.value },
        tds: { ...defaults.tds, value: realTimeData.tds ?? defaults.tds.value }
    };

    return (
        <div className={`metrics-grid ${detailed ? 'detailed-view' : ''}`} style={detailed ? { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' } : {}}>
            {/* pH Level */}
            <div className="metric-card">
                <div className="metric-header">
                    <span className="metric-label">pH Level</span>
                    <div className="metric-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2">
                            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                        </svg>
                    </div>
                </div>
                <div className="metric-value">{liveMetrics.ph.value}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="metric-status good">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Optimal
                    </span>
                    {detailed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Range: 6.5 - 8.5</span>}
                </div>
                {detailed && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Current pH levels are optimal for consumption and pipe longevity.
                        </p>
                        {/* Mock Trend Line */}
                        <div style={{ height: '4px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '60%', background: 'var(--success-green)' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>7 Day Trend: Stable</div>
                    </div>
                )}
            </div>

            {/* Turbidity */}
            <div className="metric-card">
                <div className="metric-header">
                    <span className="metric-label">Turbidity</span>
                    <div className="metric-icon" style={{ background: 'rgba(14, 165, 233, 0.15)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(14, 165, 233)" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                    </div>
                </div>
                <div className="metric-value">{liveMetrics.turbidity.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>NTU</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="metric-status good">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Clear
                    </span>
                    {detailed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max: 5.0 NTU</span>}
                </div>
                {detailed && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Water clarity is excellent. No suspended particles detected.
                        </p>
                        <div style={{ height: '4px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '40%', background: 'var(--success-green)' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>7 Day Trend: Improving</div>
                    </div>
                )}
            </div>

            {/* TDS */}
            <div className="metric-card">
                <div className="metric-header">
                    <span className="metric-label">Total Dissolved Solids</span>
                    <div className="metric-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(6, 182, 212)" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                    </div>
                </div>
                <div className="metric-value">{liveMetrics.tds.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ppm</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="metric-status good">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Safe
                    </span>
                    {detailed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max: 500 ppm</span>}
                </div>
                {detailed && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Mineral content is within safe drinking limits.
                        </p>
                        <div style={{ height: '4px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '75%', background: 'var(--warning-amber)' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>7 Day Trend: Fluctuating</div>
                    </div>
                )}
            </div>

        </div>
        </div>
    );
};

export default WaterQuality;
