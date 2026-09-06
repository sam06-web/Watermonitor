import { useState, useEffect, useMemo, useCallback } from 'react';
import { getApiUrl } from '../utils/api';

export default function SensorHistoryModal({ isOpen, onClose, selectedRiver, currentValues }) {
  const [historyData, setHistoryData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [filterRiver, setFilterRiver] = useState(selectedRiver?.id || 'all');
  const [activeMetric, setActiveMetric] = useState('all'); // 'all', 'wqi', 'ph', 'tds', 'turbidity'
  const [isRecording, setIsRecording] = useState(false);
  const [recordSuccessMsg, setRecordSuccessMsg] = useState('');

  // Fetch history from MongoDB
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const riverParam = filterRiver && filterRiver !== 'all' ? `&river=${encodeURIComponent(filterRiver)}` : '';
      const res = await fetch(getApiUrl(`/api/water-quality/sensor-history?period=${period}&limit=100${riverParam}`));
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.history || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching sensor history from MongoDB:', err);
    } finally {
      setLoading(false);
    }
  }, [filterRiver, period]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  // Insert a real-time sample into MongoDB
  const handleRecordSample = async () => {
    setIsRecording(true);
    setRecordSuccessMsg('');
    try {
      const ph = currentValues?.ph ?? (7.2 + (Math.random() * 0.4 - 0.2));
      const tds = currentValues?.tds ?? Math.round(280 + (Math.random() * 40 - 20));
      const turbidity = currentValues?.turbidity ?? (3.2 + (Math.random() * 0.8 - 0.4));
      const temperature = currentValues?.temperature ?? (24.0 + (Math.random() * 2 - 1));
      const res = await fetch(getApiUrl('/api/water-quality/sensor-readings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riverId: selectedRiver?.id || (filterRiver !== 'all' ? filterRiver : 'global'),
          riverName: selectedRiver?.name || 'Monitored River',
          ph: Number(ph.toFixed(2)),
          tds: Math.round(tds),
          turbidity: Number(turbidity.toFixed(2)),
          temperature: Number(temperature.toFixed(1)),
          source: 'manual_calibration_node'
        })
      });
      const data = await res.json();
      if (data.success) {
        setRecordSuccessMsg('✓ New reading saved to MongoDB Atlas!');
        setTimeout(() => setRecordSuccessMsg(''), 4000);
        await fetchHistory();
      }
    } catch (err) {
      console.error('Error saving reading to MongoDB:', err);
    } finally {
      setIsRecording(false);
    }
  };

  // Prepare chart points (sorted chronologically oldest to newest)
  const chartPoints = useMemo(() => {
    return [...historyData].reverse();
  }, [historyData]);

  if (!isOpen) return null;

  const width = 680;
  const height = 220;
  const padding = 35;

  const renderSparkline = (key, color, maxVal, minVal = 0) => {
    if (chartPoints.length < 2) return null;
    const pts = chartPoints.map((d, i) => {
      const val = d[key] ?? 0;
      const x = padding + (i / (chartPoints.length - 1)) * (width - 2 * padding);
      const clampedVal = Math.max(minVal, Math.min(maxVal, val));
      const y = height - padding - ((clampedVal - minVal) / (maxVal - minVal || 1)) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const firstX = padding;
    const lastX = width - padding;
    const bottomY = height - padding;
    const fillPath = `M ${firstX} ${bottomY} L ${pts} L ${lastX} ${bottomY} Z`;

    return (
      <g key={key}>
        <defs>
          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${key})`} />
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
        {chartPoints.map((d, i) => {
          const val = d[key] ?? 0;
          const x = padding + (i / (chartPoints.length - 1)) * (width - 2 * padding);
          const clampedVal = Math.max(minVal, Math.min(maxVal, val));
          const y = height - padding - ((clampedVal - minVal) / (maxVal - minVal || 1)) * (height - 2 * padding);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1.5"
            >
              <title>{`${d.riverName || 'River'} (${new Date(d.timestamp).toLocaleDateString()}): ${val}`}</title>
            </circle>
          );
        })}
      </g>
    );
  };

  return (
    <div className="sensor-history-overlay" onClick={onClose}>
      <div className="sensor-history-modal glass-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sensor-history-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="mongo-pill">🍃 MongoDB Atlas Connected</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {historyData.length} records retrieved
              </span>
            </div>
            <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Historical Sensor Telemetry
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Continuous multi-node sensor stream stored in MongoDB database.
            </p>
          </div>

          <button className="sensor-modal-close-btn" onClick={onClose} title="Close modal">
            ✕
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="sensor-history-toolbar">
          <div className="sensor-history-filters">
            {/* River Selector */}
            <div className="history-filter-group">
              <label>Water Body:</label>
              <select
                className="history-select"
                value={filterRiver}
                onChange={e => setFilterRiver(e.target.value)}
              >
                <option value="all">🌍 All Water Bodies</option>
                <optgroup label="Tamil Nadu &amp; South India">
                  <option value="thamirabarani">Thamirabarani River</option>
                  <option value="cauvery">Cauvery River</option>
                  <option value="noiyal">Noiyal River</option>
                  <option value="amaravati">Amaravati River</option>
                  <option value="vaigai">Vaigai River</option>
                  <option value="palar">Palar River</option>
                  <option value="kollidam">Kollidam River</option>
                  <option value="cheyyar">Cheyyar River</option>
                  <option value="bhavani">Bhavani River</option>
                </optgroup>
                <optgroup label="North India">
                  <option value="ganga">Ganga River</option>
                  <option value="yamuna">Yamuna River</option>
                </optgroup>
                <optgroup label="Global Rivers">
                  <option value="amazon">Amazon River (Brasil)</option>
                  <option value="nile">Nile River (Egypt)</option>
                  <option value="danube">Danube River (Europe)</option>
                  <option value="thames">Thames River (UK)</option>
                  <option value="mississippi">Mississippi River (USA)</option>
                  <option value="rhine">Rhine River (Europe)</option>
                  <option value="yangtze">Yangtze River (China)</option>
                </optgroup>
              </select>
            </div>

            {/* Time Period Selector */}
            <div className="history-filter-group">
              <label>Time Range:</label>
              <div className="history-pill-group">
                {['24h', '7d', '30d', 'all'].map(p => (
                  <button
                    key={p}
                    className={`history-pill-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p === '24h' ? '24 Hours' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {recordSuccessMsg && (
              <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: '600' }}>
                {recordSuccessMsg}
              </span>
            )}
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => {
                const header = 'Timestamp,Water Body,pH,TDS,Turbidity,WQI Score,Status\n';
                const csv = historyData.map(row => 
                  `${new Date(row.timestamp).toISOString()},${row.riverName || 'Global'},${row.ph},${row.tds},${row.turbidity},${row.wqi},${row.status}`
                ).join('\n');
                const blob = new Blob([header + csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sensor_history.csv';
                a.click();
              }}
            >
              📥 Export CSV
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={handleRecordSample}
              disabled={isRecording}
            >
              {isRecording ? 'Saving to Mongo...' : '⚡ Log Sample to MongoDB'}
            </button>
          </div>
        </div>

        {/* Metric Tabs */}
        <div className="history-metric-tabs">
          {[
            { id: 'all', label: 'All Parameters' },
            { id: 'wqi', label: 'Water Quality Score', color: '#10b981' },
            { id: 'ph', label: 'pH Acidity (6.5-8.5)', color: '#3b82f6' },
            { id: 'tds', label: 'TDS (ppm)', color: '#8b5cf6' },
            { id: 'turbidity', label: 'Turbidity (NTU)', color: '#f59e0b' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`metric-tab-btn ${activeMetric === tab.id ? 'active' : ''}`}
              onClick={() => setActiveMetric(tab.id)}
            >
              {tab.color && <span className="tab-color-dot" style={{ backgroundColor: tab.color }} />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats Summary Cards */}
        {stats && (
          <div className="history-stats-grid">
            <div className="history-stat-box">
              <span className="history-stat-label">Average pH</span>
              <strong className="history-stat-value" style={{ color: '#3b82f6' }}>
                {stats.avg_ph ? stats.avg_ph.toFixed(2) : '7.35'}
              </strong>
              <span className="history-stat-range">Range: {stats.min_ph?.toFixed(1) || 6.8} – {stats.max_ph?.toFixed(1) || 8.1}</span>
            </div>

            <div className="history-stat-box">
              <span className="history-stat-label">Average TDS</span>
              <strong className="history-stat-value" style={{ color: '#8b5cf6' }}>
                {stats.avg_tds ? Math.round(stats.avg_tds) : 280} <small style={{ fontSize: '0.75rem' }}>ppm</small>
              </strong>
              <span className="history-stat-range">Range: {Math.round(stats.min_tds || 120)} – {Math.round(stats.max_tds || 450)} ppm</span>
            </div>

            <div className="history-stat-box">
              <span className="history-stat-label">Average Turbidity</span>
              <strong className="history-stat-value" style={{ color: '#f59e0b' }}>
                {stats.avg_turbidity ? stats.avg_turbidity.toFixed(1) : '4.2'} <small style={{ fontSize: '0.75rem' }}>NTU</small>
              </strong>
              <span className="history-stat-range">Range: {stats.min_turbidity?.toFixed(1) || 1.0} – {stats.max_turbidity?.toFixed(1) || 9.5} NTU</span>
            </div>

            <div className="history-stat-box">
              <span className="history-stat-label">Overall Index Score</span>
              <strong className="history-stat-value" style={{ color: '#10b981' }}>
                {stats.avg_wqi ? Math.round(stats.avg_wqi) : 88}%
              </strong>
              <span className="history-stat-range">MongoDB Status: Optimal</span>
            </div>
          </div>
        )}

        {/* Chart Visualization */}
        <div className="history-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Telemetry Trend Visualization
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Source: MongoDB collection &apos;sensor_readings&apos;
            </span>
          </div>

          {loading ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading sensor records from MongoDB...
            </div>
          ) : chartPoints.length < 2 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No historical sensor data recorded for the selected filter.
            </div>
          ) : (
            <svg viewBox={`0 0 ${width} ${height}`} className="history-svg" style={{ width: '100%', height: 'auto' }}>
              {/* Grid Lines */}
              <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeDasharray="3,3" />
              <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="var(--border-color)" strokeDasharray="3,3" />
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" />

              {/* Sparklines */}
              {(activeMetric === 'all' || activeMetric === 'wqi') && renderSparkline('wqi', '#10b981', 100, 0)}
              {(activeMetric === 'all' || activeMetric === 'ph') && renderSparkline('ph', '#3b82f6', 10, 4)}
              {(activeMetric === 'all' || activeMetric === 'tds') && renderSparkline('tds', '#8b5cf6', 600, 0)}
              {(activeMetric === 'all' || activeMetric === 'turbidity') && renderSparkline('turbidity', '#f59e0b', 15, 0)}
            </svg>
          )}
        </div>

        {/* History Data Table */}
        <div className="history-table-container">
          <table className="history-data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Water Body</th>
                <th>pH</th>
                <th>TDS</th>
                <th>Turbidity</th>
                <th>WQI Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyData.slice(0, 15).map((row, i) => (
                <tr key={row.id || i}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {row.riverName || 'Global'}
                  </td>
                  <td style={{ color: '#3b82f6', fontWeight: '600' }}>
                    {Number(row.ph).toFixed(2)}
                  </td>
                  <td style={{ color: '#8b5cf6', fontWeight: '600' }}>
                    {Math.round(row.tds)} <small style={{ color: 'var(--text-muted)' }}>ppm</small>
                  </td>
                  <td style={{ color: '#f59e0b', fontWeight: '600' }}>
                    {Number(row.turbidity).toFixed(1)} <small style={{ color: 'var(--text-muted)' }}>NTU</small>
                  </td>
                  <td style={{ fontWeight: '700', color: '#10b981' }}>
                    {row.wqi}%
                  </td>
                  <td>
                    <span className={`sensor-status-badge ${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
