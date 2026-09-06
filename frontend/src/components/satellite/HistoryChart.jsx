const PERIODS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' }
];

const METRICS = [
  { id: 'waterArea', label: '🌊 Water Area (km²)', color: '#06b6d4' },
  { id: 'temperature', label: '🌡️ Temperature (°C)', color: '#f59e0b' },
  { id: 'turbidity', label: '🧪 Turbidity (NTU)', color: '#ef4444' },
  { id: 'ndwi', label: '💧 NDWI (Water Index)', color: '#00f0ff' }
];

export default function HistoryChart({ riverData, historyData, statistics, historyPeriod, onPeriodChange, activeChartMetric, onMetricChange }) {
  return (
    <div className="glass-card" style={{ marginBottom: '2rem' }}>
      <div className="chart-header">
        <div>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📈</span> Remote Sensing Historical Trend Analysis
          </h2>
          <p className="chart-subtitle">
            Multi-epoch time-series for {riverData?.name || 'the selected water body'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`sat-chip ${historyPeriod === p.id ? 'active' : ''}`}
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: '700' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1.25rem', marginBottom: '1.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {METRICS.map(metric => (
          <button
            key={metric.id}
            onClick={() => onMetricChange(metric.id)}
            className={`sat-metric-tab ${activeChartMetric === metric.id ? 'active' : ''}`}
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {historyData.length > 0 ? (
        <div className="sat-chart-wrapper">
          <svg viewBox="0 0 800 240" className="sat-chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1="40" y1="30" x2="780" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
            <line x1="40" y1="90" x2="780" y2="90" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
            <line x1="40" y1="150" x2="780" y2="150" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
            <line x1="40" y1="210" x2="780" y2="210" stroke="rgba(255,255,255,0.15)" />

            {(() => {
              const values = historyData.map(d => d[activeChartMetric] || 0);
              const minVal = Math.min(...values);
              const maxVal = Math.max(...values);
              const range = (maxVal - minVal) || 1;

              const points = historyData.map((d, index) => {
                const x = 40 + (index / (historyData.length - 1 || 1)) * 740;
                const val = d[activeChartMetric] || 0;
                const y = 200 - ((val - minVal) / range) * 160;
                return { x, y, val, date: d.date, sat: d.satelliteName };
              });

              const pathString = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`, '');
              const areaString = `${pathString} L ${points[points.length - 1].x},210 L 40,210 Z`;

              return (
                <>
                  <path d={areaString} fill="url(#chartGradient)" />

                  <path
                    d={pathString}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {points.map((pt, i) => (
                    <g key={i} className="sat-chart-point-group">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5"
                        fill="#00f0ff"
                        stroke="#09090b"
                        strokeWidth="2"
                      />
                      <title>{`${pt.date} (${pt.sat}): ${pt.val}`}</title>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{historyData[0]?.date}</span>
            <span>{historyData[Math.floor(historyData.length / 2)]?.date}</span>
            <span>{historyData[historyData.length - 1]?.date}</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading historical observation series...
        </div>
      )}

      {statistics && (
        <div className="sat-stats-bar">
          <div>
            <div className="sat-stat-title">Period Average</div>
            <div className="sat-stat-num" style={{ color: 'var(--accent-cyan)' }}>
              {activeChartMetric === 'waterArea' ? `${statistics.avg_water_area?.toFixed(1)} km²` :
               activeChartMetric === 'temperature' ? `${statistics.avg_temp?.toFixed(1)} °C` :
               activeChartMetric === 'turbidity' ? `${statistics.avg_turbidity?.toFixed(1)} NTU` :
               `+${statistics.avg_ndwi?.toFixed(3)}`}
            </div>
          </div>

          <div>
            <div className="sat-stat-title">Peak Recorded</div>
            <div className="sat-stat-num" style={{ color: 'var(--accent-teal)' }}>
              {activeChartMetric === 'waterArea' ? `${statistics.max_water_area?.toFixed(1)} km²` :
               activeChartMetric === 'temperature' ? `${statistics.max_temp?.toFixed(1)} °C` :
               activeChartMetric === 'turbidity' ? `${statistics.max_turbidity?.toFixed(1)} NTU` :
               `+${statistics.max_ndwi?.toFixed(3)}`}
            </div>
          </div>

          <div>
            <div className="sat-stat-title">Minimum Baseline</div>
            <div className="sat-stat-num" style={{ color: 'var(--primary-blue-light)' }}>
              {activeChartMetric === 'waterArea' ? `${statistics.min_water_area?.toFixed(1)} km²` :
               activeChartMetric === 'temperature' ? `${statistics.min_temp?.toFixed(1)} °C` :
               activeChartMetric === 'turbidity' ? `${statistics.min_turbidity?.toFixed(1)} NTU` :
               `+${statistics.min_ndwi?.toFixed(3)}`}
            </div>
          </div>

          <div>
            <div className="sat-stat-title">Total Satellite Passes</div>
            <div className="sat-stat-num" style={{ color: 'var(--text-primary)' }}>
              {statistics.total_observations || historyData.length} Scenes
            </div>
          </div>
        </div>
      )}
    </div>
  );
}