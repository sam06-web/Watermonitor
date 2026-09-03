import { useState } from 'react';

export default function Automations({ onShowToast }) {
  const [flows, setFlows] = useState([
    {
      id: 'peak_eco',
      title: 'Peak Hours Eco Mode',
      desc: 'Automatically dims lights and adjusts HVAC and water pumps when grid energy demand is highest.',
      icon: '🌿',
      iconType: 'green',
      status: true,
      subLeft: '💡 Influences 12 devices',
      subRight: '-15% kWh'
    },
    {
      id: 'smart_sprinkler',
      title: 'Smart Sprinkler & Drip',
      desc: 'Based on local rain forecast. Skips irrigation cycles when precipitation is predicted in catchment.',
      icon: '💧',
      iconType: 'blue',
      status: true,
      subLeft: '☁️ 80% Rain Chance',
      subRight: 'IDLE'
    },
    {
      id: 'leak_isolation',
      title: 'Auto Leak Isolation Flow',
      desc: 'Real-time AI pressure sensor monitor. Instantly triggers emergency shutoff valve if rupture occurs.',
      icon: '🛡️',
      iconType: 'green',
      status: true,
      subLeft: '⚡ Reaction: < 50ms',
      subRight: 'ACTIVE'
    },
    {
      id: 'night_tank_fill',
      title: 'Night Tank Refill Flow',
      desc: 'Schedules bulk reservoir refilling during off-peak night hours to minimize line friction loss.',
      icon: '🌙',
      iconType: 'cyan',
      status: false,
      subLeft: '⏰ Window: 11 PM - 5 AM',
      subRight: 'PAUSED'
    }
  ]);

  const toggleFlow = (id) => {
    setFlows(prev => prev.map(flow => {
      if (flow.id === id) {
        const nextStatus = !flow.status;
        if (onShowToast) {
          onShowToast({
            title: flow.title,
            message: `Automation flow is now ${nextStatus ? 'ACTIVE' : 'PAUSED'}.`,
            type: nextStatus ? 'success' : 'info'
          });
        }
        return { ...flow, status: nextStatus };
      }
      return flow;
    }));
  };

  return (
    <div style={{ padding: '0 1rem 1.5rem' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span className="eco-pill-badge green">OPTIMIZED</span>
        <h1 style={{ fontSize: '1.85rem', fontWeight: '900', color: 'var(--eco-text-main)', margin: '0.25rem 0 0.5rem', letterSpacing: '-0.03em' }}>
          Automations
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--eco-text-sub)', lineHeight: '1.5', margin: 0 }}>
          The AquaSense Engine is currently managing{' '}
          <strong style={{ color: 'var(--eco-green-neon)' }}>
            {flows.filter(f => f.status).length} active flows
          </strong>{' '}
          to reduce your water footprint while maximizing grid efficiency.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--eco-card-border)',
              color: 'var(--eco-text-main)',
              borderRadius: '12px',
              padding: '0.6rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <span>⚞</span> Filter
          </button>

          <button
            className="eco-callout-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => {
              if (onShowToast) {
                onShowToast({
                  title: 'New Automation Flow',
                  message: 'Flow creation wizard opened.',
                  type: 'info'
                });
              }
            }}
          >
            <span>+</span> New Flow
          </button>
        </div>
      </div>

      {/* 2. Flow Automation Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {flows.map(flow => (
          <div key={flow.id} className="eco-automation-card">
            <div className="eco-auto-header">
              <div className={`eco-appliance-icon ${flow.iconType}`}>
                {flow.icon}
              </div>

              {/* iOS Switch */}
              <label className="eco-switch">
                <input
                  type="checkbox"
                  checked={flow.status}
                  onChange={() => toggleFlow(flow.id)}
                />
                <span className="eco-switch-track"></span>
              </label>
            </div>

            <div>
              <div className="eco-auto-title">{flow.title}</div>
              <div className="eco-auto-desc">{flow.desc}</div>
            </div>

            <div className="eco-auto-footer">
              <div>{flow.subLeft}</div>
              <div style={{
                color: flow.subRight.includes('-') || flow.subRight === 'ACTIVE'
                  ? 'var(--eco-green-neon)'
                  : 'var(--eco-text-sub)',
                fontWeight: '700'
              }}>
                {flow.subRight}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Bottom Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <div style={{
          background: 'var(--eco-card-bg)',
          border: '1px solid var(--eco-card-border)',
          borderRadius: 'var(--eco-radius)',
          padding: '1rem 0.85rem'
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--eco-text-sub)', textTransform: 'uppercase', fontWeight: '700' }}>
            DAILY SAVINGS
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--eco-text-main)', marginTop: '0.2rem' }}>
            $4.20
          </div>
        </div>

        <div style={{
          background: 'var(--eco-card-bg)',
          border: '1px solid var(--eco-card-border)',
          borderRadius: 'var(--eco-radius)',
          padding: '1rem 0.85rem'
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--eco-text-sub)', textTransform: 'uppercase', fontWeight: '700' }}>
            CARBON OFFSET
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--eco-green-neon)', marginTop: '0.2rem' }}>
            12.4kg
          </div>
        </div>

        <div style={{
          background: 'var(--eco-card-bg)',
          border: '1px solid var(--eco-card-border)',
          borderRadius: 'var(--eco-radius)',
          padding: '1rem 0.85rem'
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--eco-text-sub)', textTransform: 'uppercase', fontWeight: '700' }}>
            WATER SAVED
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--eco-cyan-bright)', marginTop: '0.2rem' }}>
            320L
          </div>
        </div>
      </div>
    </div>
  );
}
