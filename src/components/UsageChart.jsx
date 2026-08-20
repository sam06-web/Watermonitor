import { useMemo, useState } from 'react';

const generateData = (selectedPeriod) => {
    const data = [];

    if (selectedPeriod === '24h') {
        for (let i = 0; i < 24; i++) {
            let baseValue = 300;
            if ((i >= 6 && i <= 9) || (i >= 18 && i <= 20)) {
                baseValue += 500 + Math.random() * 200;
            } else if (i >= 1 && i <= 5) {
                baseValue = 100 + Math.random() * 50;
            } else {
                baseValue += 200 + Math.random() * 100;
            }
            data.push({
                label: i + ":00",
                value: Math.floor(baseValue)
            });
        }
    } else if (selectedPeriod === '7d') {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (let i = 0; i < 7; i++) {
            data.push({
                label: days[i],
                value: Math.floor(4500 + Math.random() * 500)
            });
        }
    } else {
        for (let i = 1; i <= 30; i++) {
            data.push({
                label: "Day " + i,
                value: Math.floor(4000 + Math.random() * 800)
            });
        }
    }
    return data;
};

const UsageChart = ({ fullView = false }) => {
    const [selectedPeriod, setSelectedPeriod] = useState('24h');

    // Regenerate the sample series only when the selected period changes.
    const chartData = useMemo(() => generateData(selectedPeriod), [selectedPeriod]);

    if (chartData.length === 0) return <div>Loading Chart...</div>;

    const maxValue = Math.max(...chartData.map(d => d.value));
    const totalUsage = chartData.reduce((sum, d) => sum + d.value, 0);
    const avgUsage = Math.floor(totalUsage / chartData.length);

    // Advanced Analytics for Full View
    const peakHour = chartData.reduce((max, obj) => obj.value > max.value ? obj : max, chartData[0]);
    const prevWeekUsage = Math.floor(totalUsage * 0.92); // Deterministic mock previous week
    const usageTrend = Math.floor(((totalUsage - prevWeekUsage) / prevWeekUsage) * 100);

    return (
        <div className="chart-container" style={fullView ? { gridColumn: '1 / -1' } : {}}>
            <div className="chart-header">
                <div>
                    <h2 className="chart-title">Water Usage Patterns</h2>
                    <p className="chart-subtitle">Consumption over time</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['24h', '7d', '30d'].map(period => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className="btn"
                            style={{
                                padding: '0.5rem 1rem',
                                background: selectedPeriod === period
                                    ? 'linear-gradient(135deg, var(--primary-blue-dark), var(--primary-blue))'
                                    : 'var(--bg-tertiary)',
                                color: selectedPeriod === period ? 'white' : 'var(--text-secondary)',
                                border: selectedPeriod === period ? 'none' : '1px solid var(--border-color)',
                                minWidth: '60px'
                            }}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            {/* Simple Bar Chart */}
            <div className="chart-scroll-area" style={{ overflowX: 'auto', paddingBottom: '0.5rem', width: '100%' }}>
                <div className="chart-bars-wrapper" style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: fullView ? '8px' : '4px',
                    height: fullView ? '300px' : '200px',
                    padding: '1rem 0',
                    minWidth: '600px'
                }}>
                    {chartData.map((item, index) => {
                        const heightPercent = (item.value / maxValue) * 100;
                        const isPeak = item.value === maxValue;

                        return (
                            <div
                                key={index}
                                style={{
                                    flex: 1,
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '0.5rem'
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: `${heightPercent}%`,
                                        background: isPeak
                                            ? `linear-gradient(180deg, var(--accent-teal), var(--primary-blue))`
                                            : `linear-gradient(180deg, var(--accent-cyan), var(--primary-blue))`,
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        opacity: 0.8
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.filter = 'brightness(1.2)';
                                        e.currentTarget.style.opacity = '1';
                                        e.currentTarget.style.transform = 'scaleY(1.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.filter = 'brightness(1)';
                                        e.currentTarget.style.opacity = '0.8';
                                        e.currentTarget.style.transform = 'scaleY(1)';
                                    }}
                                    title={`${item.label}: ${item.value}L`}
                                >
                                    {fullView && isPeak && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-1.5rem',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            fontSize: '0.75rem',
                                            color: 'var(--accent-teal)',
                                            fontWeight: 'bold',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Peak
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Statistics */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-md)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem'
            }}>
                <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Usage</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-blue-light)' }}>
                        {totalUsage.toLocaleString()}L
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Average</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {avgUsage}L
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Peak Usage</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-teal)' }}>
                        {maxValue}L
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                            ({peakHour?.label})
                        </span>
                    </div>
                </div>
                {fullView && (
                    <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Vs Last Period</div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: usageTrend > 0 ? 'var(--danger-red)' : 'var(--success-green)'
                        }}>
                            {usageTrend > 0 ? '+' : ''}{usageTrend}%
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UsageChart;
