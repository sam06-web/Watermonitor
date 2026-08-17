import { useState, useEffect } from 'react';

const FlowMonitor = ({ realTimeData = {}, leakThreshold = 0.5 }) => {
    // Initialize with some mock data so the user sees something immediately
    const [history, setHistory] = useState(() => {
        const initialData = [];
        const now = new Date();
        for (let i = 20; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 5000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            initialData.push({ time, value: 0 });
        }
        return {
            flow1: [...initialData],
            flow2: [...initialData],
            leak: [...initialData]
        };
    });

    const maxDataPoints = 50;

    useEffect(() => {
        // Only update if we have actual data or to keep the "pulse" alive
        setHistory(prev => {
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const newFlow1 = [...prev.flow1, { time: now, value: realTimeData.flow1 ?? 0 }];
            const newFlow2 = [...prev.flow2, { time: now, value: realTimeData.flow2 ?? 0 }];
            const newLeak = [...prev.leak, { time: now, value: realTimeData.leak ?? 0 }];

            return {
                flow1: newFlow1.slice(-maxDataPoints),
                flow2: newFlow2.slice(-maxDataPoints),
                leak: newLeak.slice(-maxDataPoints)
            };
        });
    }, [realTimeData]);

    const renderLineChart = (data, color, label) => {
        const height = 150;
        const width = 500;
        const padding = 20;

        if (data.length < 2) return (
            <div className="flow-chart-wrapper glass-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <p style={{ color: 'var(--text-muted)' }}>Waiting for sensor data...</p>
            </div>
        );

        const maxVal = Math.max(...data.map(d => d.value), 2); // At least 2 for scaling

        // Scale x based on current data length to fill the chart
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
            const y = height - padding - (d.value / maxVal) * (height - 2 * padding);
            return `${x},${y}`;
        }).join(' ');

        // Create the fill path (Move to start, then all points, then back to bottom)
        const firstPointX = padding;
        const lastPointX = width - padding;
        const bottomY = height - padding;
        const fillPath = `M ${firstPointX} ${bottomY} L ${points} L ${lastPointX} ${bottomY} Z`;

        return (
            <div className="flow-chart-wrapper glass-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="chart-title" style={{ color: color, fontSize: '1rem', margin: 0 }}>{label}</h3>
                    <div className="pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                </div>

                <svg viewBox={`0 0 ${width} ${height}`} className="flow-svg" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    {/* Grid lines */}
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

                    {/* Fill Area */}
                    <path
                        d={fillPath}
                        fill={color}
                        fillOpacity="0.1"
                    />

                    {/* Data Line */}
                    <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={points}
                        style={{ filter: 'drop-shadow(0 0 5px ' + color + ')' }}
                    />
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Flow</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '700', color: color }}>
                            {data[data.length - 1]?.value.toFixed(2)} <small style={{ fontSize: '0.75rem' }}>L/min</small>
                        </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TIME: {data[data.length - 1]?.time}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flow-monitor-container animate-fade-in">
            <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                <div className="metric-card">
                    <span className="metric-label">Avg Inlet</span>
                    <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
                        {(history.flow1.reduce((a, b) => a + b.value, 0) / (history.flow1.length || 1)).toFixed(2)}
                    </div>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Avg Outlet</span>
                    <div className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                        {(history.flow2.reduce((a, b) => a + b.value, 0) / (history.flow2.length || 1)).toFixed(2)}
                    </div>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Leak Status</span>
                    <div className="metric-value" style={{ color: (Math.abs(realTimeData.leak) > leakThreshold) ? 'var(--danger-red)' : 'var(--success-green)' }}>
                        {Math.abs(realTimeData.leak) > leakThreshold ? 'CRITICAL' : 'STABLE'}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                {renderLineChart(history.flow1, 'var(--accent-cyan)', 'Flow Meter 1 (Inlet)')}
                {renderLineChart(history.flow2, 'var(--accent-teal)', 'Flow Meter 2 (Outlet)')}
                {renderLineChart(history.leak, 'var(--danger-red)', 'Leakage Detection Rate')}
            </div>
        </div>
    );
};

export default FlowMonitor;
