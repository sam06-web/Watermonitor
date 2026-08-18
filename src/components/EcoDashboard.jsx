import { useState } from 'react';

export default function EcoDashboard({ realTimeData, waterQuality, onNavigate, onShowToast }) {
  // Active Appliances & Valves state
  const [appliances, setAppliances] = useState([
    {
      id: 'hvac',
      name: 'HVAC Cooling & Feed',
      type: 'green',
      icon: '❄️',
      currentDraw: '1.2 kW',
      flowRate: '18 L/min',
      status: true,
      loadPct: 65
    },
    {
      id: 'ev_pump',
      name: 'Booster Pump Station',
      type: 'cyan',
      icon: '⚡',
      currentDraw: '2.4 kW',
      flowRate: '45 L/min',
      status: true,
      loadPct: 80
    },
    {
      id: 'irrigation',
      name: 'Smart Drip Zone #2',
      type: 'green',
      icon: '🌱',
      currentDraw: '0.4 kW',
      flowRate: '12 L/min',
      status: false,
      loadPct: 30
    },
    {
      id: 'filtration',
      name: 'RO Multi-Stage Purifier',
      type: 'blue',
      icon: '💧',
      currentDraw: '0.8 kW',
      flowRate: '25 L/min',
      status: true,
      loadPct: 55
    }
  ]);

  const toggleAppliance = (id) => {
    setAppliances(prev => prev.map(app => {
      if (app.id === id) {
        const nextStatus = !app.status;
        if (onShowToast) {
          onShowToast({
            title: `${app.name}`,
            message: `Switched ${nextStatus ? 'ON' : 'OFF'} successfully.`,
            type: nextStatus ? 'success' : 'info'
          });
        }
        return { ...app, status: nextStatus };
      }
      return app;
    }));
  };

  // Concentric SVG progress parameters
  const energyKwh = 12.4;
  const waterLiters = realTimeData?.flow1 ? Math.round(realTimeData.flow1 * 40) : 240;
  const efficiencyPct = 88;

  // Outer ring (Neon Green) - Energy Efficiency
  const outerRadius = 88;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const outerStrokeDash = outerCircumference * 0.75;
  const outerOffset = outerStrokeDash - (outerStrokeDash * efficiencyPct) / 100;

  // Inner ring (Cyan) - Water Flow / Target
  const innerRadius = 72;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const innerStrokeDash = innerCircumference * 0.75;
  const innerOffset = innerStrokeDash - (innerStrokeDash * 0.72);

  return (
    <div style={{ padding: '0 1rem 1.5rem' }}>
      {/* 1. Hero Concentric Progress Gauge Card */}
      <div className="eco-gauge-container">
        <div className="eco-gauge-svg-wrap">
          <svg viewBox="0 0 220 220" width="220" height="220" style={{ transform: 'rotate(135deg)' }}>
            {/* Outer Track (Energy) */}
            <circle
              cx="110"
              cy="110"
              r={outerRadius}
              fill="none"
              stroke="var(--eco-card-border)"
              strokeWidth="10"
              strokeDasharray={outerStrokeDash}
              strokeLinecap="round"
            />
            {/* Outer Neon Green Glowing Bar */}
            <circle
              cx="110"
              cy="110"
              r={outerRadius}
              fill="none"
              stroke="#00e676"
              strokeWidth="10"
              strokeDasharray={outerStrokeDash}
              strokeDashoffset={outerOffset}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 8px rgba(0, 230, 118, 0.6))', transition: 'stroke-dashoffset 1s ease' }}
            />

            {/* Inner Track (Water) */}
            <circle
              cx="110"
              cy="110"
              r={innerRadius}
              fill="none"
              stroke="var(--eco-card-border)"
              strokeWidth="10"
              strokeDasharray={innerStrokeDash}
              strokeLinecap="round"
            />
            {/* Inner Cyan Glowing Bar */}
            <circle
              cx="110"
              cy="110"
              r={innerRadius}
              fill="none"
              stroke="#00f0ff"
              strokeWidth="10"
              strokeDasharray={innerStrokeDash}
              strokeDashoffset={innerOffset}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6))', transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>

          {/* Center Metrics */}
          <div className="eco-gauge-inner-content">
            <div className="eco-gauge-big-val">{energyKwh}</div>
            <div className="eco-gauge-unit-label">KWH TODAY</div>
            <div className="eco-gauge-sub-badge">
              <span>💧</span> {waterLiters}L
            </div>
          </div>
        </div>

        {/* Bottom Sub-Stats Row */}
        <div className="eco-sub-stats-row">
          <div className="eco-sub-stat-col">
            <div className="eco-sub-stat-label">ENERGY EFFICIENCY</div>
            <div className="eco-sub-stat-val" style={{ color: 'var(--eco-green-neon)' }}>
              {efficiencyPct}% <span style={{ fontSize: '0.9rem' }}>↗</span>
            </div>
          </div>

          <div className="eco-sub-stat-col" style={{ alignItems: 'flex-end' }}>
            <div className="eco-sub-stat-label">RESOURCE HEALTH</div>
            <div className="eco-sub-stat-val" style={{ color: 'var(--eco-text-main)' }}>
              Optimal
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active Appliances & Valve Systems */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="eco-section-header">
          <div>
            <h3 className="eco-section-title">Active Systems</h3>
            <div className="eco-section-sub">
              {appliances.filter(a => a.status).length} systems drawing power & flow
            </div>
          </div>
          <span className="eco-view-all-link" onClick={() => onNavigate && onNavigate('flow-monitor')}>
            View All
          </span>
        </div>

        <div className="eco-appliances-grid">
          {appliances.map(app => (
            <div key={app.id} className="eco-appliance-card">
              <div className="eco-appliance-top">
                <div className={`eco-appliance-icon ${app.type}`}>
                  {app.icon}
                </div>
                {/* iOS Switch */}
                <label className="eco-switch">
                  <input
                    type="checkbox"
                    checked={app.status}
                    onChange={() => toggleAppliance(app.id)}
                  />
                  <span className="eco-switch-track"></span>
                </label>
              </div>

              <div>
                <div className="eco-appliance-name">{app.name}</div>
                <div className="eco-appliance-draw-row">
                  <span>Current Draw</span>
                  <strong style={{ color: app.status ? 'var(--eco-text-main)' : 'var(--eco-text-sub)' }}>
                    {app.status ? app.currentDraw : '0.0 kW'}
                  </strong>
                </div>
                <div className="eco-appliance-progress">
                  <div
                    className="eco-appliance-progress-bar"
                    style={{
                      width: app.status ? `${app.loadPct}%` : '0%',
                      background: app.type === 'green' ? 'var(--eco-green-neon)' : app.type === 'cyan' ? '#00f0ff' : '#38bdf8'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Peak Saving Window Callout */}
      <div className="eco-callout-card">
        <div className="eco-callout-watermark">⚡</div>
        <div className="eco-callout-title">Peak Saving Window</div>
        <div className="eco-callout-desc">
          Lower utility rates available between 11 PM and 5 AM. Schedule your heavy water filtration and pumping now.
        </div>
        <button
          className="eco-callout-btn"
          onClick={() => {
            if (onShowToast) {
              onShowToast({
                title: 'Schedule Confirmed',
                message: 'Auto-fill cycle deferred to 11:00 PM peak saving window.',
                type: 'success'
              });
            }
          }}
        >
          Schedule Now
        </button>
      </div>

      {/* 4. Water Leak Alert Banner */}
      <div className="eco-alert-card">
        <div className="eco-alert-icon-box">💧</div>
        <div>
          <div className="eco-alert-title">Water Leak Alert</div>
          <div className="eco-alert-desc">
            {realTimeData?.leak > 0
              ? `⚠️ Abnormal differential detected: ${realTimeData.leak} L/min pressure drop!`
              : 'No abnormal flow detected in the main pipeline network today.'}
          </div>
        </div>
      </div>
    </div>
  );
}
