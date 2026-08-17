import { useState, useEffect } from 'react';

const WaterQuality = ({ detailed = false, realTimeData = {}, waterQualityMetrics = {}, leakThreshold = 0.5 }) => {
    const [metrics, setMetrics] = useState({
        ph: { value: 0, status: 'good', unit: 'pH' },
        turbidity: { value: 0, status: 'good', unit: 'NTU' },
        tds: { value: 145, status: 'good', unit: 'ppm' },
        flow1: { value: 12.5, status: 'good', unit: 'L/min' },
        flow2: { value: 11.8, status: 'good', unit: 'L/min' }
    });

    // Update from centralized water quality metrics (Lifting state up)
    useEffect(() => {
        if (waterQualityMetrics.ph) {
            setMetrics(prev => ({
                ...prev,
                ph: { ...prev.ph, value: waterQualityMetrics.ph },
                turbidity: { ...prev.turbidity, value: waterQualityMetrics.turbidity }
            }));
        }
    }, [waterQualityMetrics]);

    // Sync real-time data from MQTT
    useEffect(() => {
        setMetrics(prev => {
            let updated = { ...prev };
            let hasChanges = false;

            if (realTimeData.tds !== undefined) {
                updated.tds = { ...prev.tds, value: realTimeData.tds };
                hasChanges = true;
            }
            if (realTimeData.flow1 !== undefined) {
                updated.flow1 = { ...prev.flow1, value: realTimeData.flow1 };
                hasChanges = true;
            }
            if (realTimeData.flow2 !== undefined) {
                updated.flow2 = { ...prev.flow2, value: realTimeData.flow2 };
                hasChanges = true;
            }
            if (realTimeData.leak !== undefined) {
                updated.leak = { value: realTimeData.leak, status: Math.abs(realTimeData.leak) > leakThreshold ? 'warning' : 'good', unit: 'L/min' };
                hasChanges = true;
            }

            return hasChanges ? updated : prev;
        });
    }, [realTimeData]);

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
                <div className="metric-value">{metrics.ph.value}</div>
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
                <div className="metric-value">{metrics.turbidity.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>NTU</span></div>
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
                <div className="metric-value">{metrics.tds.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ppm</span></div>
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

            {/* Flow Rate 1 (Inlet) */}
            <div className="metric-card">
                <div className="metric-header">
                    <span className="metric-label">Inlet Flow</span>
                    <div className="metric-icon" style={{ background: 'rgba(20, 184, 166, 0.15)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(20, 184, 166)" strokeWidth="2">
                            <path d="M3 7v4a1 1 0 0 0 1 1h3M3 7l3-3m0 0l3 3m-3-3v9m15-2v-4a1 1 0 0 0-1-1h-3m4 0l-3 3m0 0l-3-3m3 3V3" />
                        </svg>
                    </div>
                </div>
                <div className="metric-value">{metrics.flow1.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>L/min</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="metric-status good">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Normal
                    </span>
                    {detailed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sensor A</span>}
                </div>
            </div>

            {/* Flow Rate 2 (Outlet) */}
            <div className="metric-card">
                <div className="metric-header">
                    <span className="metric-label">Outlet Flow</span>
                    <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2">
                            <path d="M3 7v4a1 1 0 0 0 1 1h3M3 7l3-3m0 0l3 3m-3-3v9m15-2v-4a1 1 0 0 0-1-1h-3m4 0l-3 3m0 0l-3-3m3 3V3" />
                        </svg>
                    </div>
                </div>
                <div className="metric-value">{metrics.flow2.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>L/min</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="metric-status good">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Normal
                    </span>
                    {detailed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sensor B</span>}
                </div>
            </div>

            {/* Leakage Rate (If data exists) */}
            {metrics.leak && (
                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-label">Leakage Rate</span>
                        <div className="metric-icon" style={{ background: metrics.leak.status === 'warning' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke={metrics.leak.status === 'warning' ? 'rgb(239, 68, 68)' : 'rgb(16, 185, 129)'} strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                    </div>
                    <div className="metric-value" style={{ color: metrics.leak.value > leakThreshold ? 'var(--danger-red)' : 'inherit' }}>
                        {metrics.leak.value} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>L/min</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`metric-status ${metrics.leak.status}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {metrics.leak.status === 'warning' ? <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3z" /> : <polyline points="20 6 9 17 4 12" />}
                            </svg>
                            {metrics.leak.status === 'warning' ? 'Leak Detected' : 'No Leak'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaterQuality;
