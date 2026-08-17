import { useState } from 'react';

export default function UsageInsights() {
  const [selectedDay, setSelectedDay] = useState('THU');

  const daysData = [
    { day: 'MON', greenH: 55, blueH: 70, energy: '13.8 kWh', water: '410 L' },
    { day: 'TUE', greenH: 75, blueH: 60, energy: '15.2 kWh', water: '380 L' },
    { day: 'WED', greenH: 90, blueH: 80, energy: '16.8 kWh', water: '450 L' },
    { day: 'THU', greenH: 100, blueH: 65, energy: '17.4 kWh', water: '390 L' },
    { day: 'FRI', greenH: 45, blueH: 50, energy: '11.2 kWh', water: '320 L' },
    { day: 'SAT', greenH: 65, blueH: 85, energy: '14.0 kWh', water: '470 L' },
    { day: 'SUN', greenH: 70, blueH: 95, energy: '14.5 kWh', water: '510 L' }
  ];

  const topConsumers = [
    { name: 'HVAC System', val: '84.2 kWh', flow: '680 L', change: '+4% vs LW', isIncrease: true, icon: '❄️' },
    { name: 'Smart Irrigation Drip', val: '42.5 kWh', flow: '420 L', change: '-8% vs LW', isIncrease: false, icon: '🌱' },
    { name: 'Booster Pump Station', val: '28.0 kWh', flow: '310 L', change: '-2% vs LW', isIncrease: false, icon: '⚡' },
    { name: 'Domestic Water Filter', val: '19.4 kWh', flow: '180 L', change: '-5% vs LW', isIncrease: false, icon: '💧' }
  ];

  return (
    <div style={{ padding: '0 1rem 1.5rem' }}>
      {/* 1. Weekly Insight Banner */}
      <div className="eco-insight-hero-banner">
        <span className="eco-pill-badge green">WEEKLY INSIGHT</span>
        <div className="eco-insight-headline">
          Your efficiency <br />
          rose by <span style={{ color: 'var(--eco-green-neon)' }}>12%</span> <br />
          since last Monday.
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-sub)' }}>Avg. Daily Energy</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff', marginTop: '0.15rem' }}>
              14.2 kWh
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-sub)' }}>Avg. Daily Water</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--eco-cyan-bright)', marginTop: '0.15rem' }}>
              420 L
            </div>
          </div>
        </div>
      </div>

      {/* 2. Emerald Green Hero Savings Card */}
      <div className="eco-savings-card-green">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⚡</span>
            <div className="eco-savings-amount">-$42.00</div>
          </div>
          <div className="eco-savings-sub">Estimated Savings this month</div>
        </div>

        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem'
        }}>
          ↗
        </div>
      </div>

      {/* 3. Usage Trends 7-Day Bar Chart */}
      <div className="eco-bar-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff' }}>Usage Trends</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-sub)' }}>7-Day Resource Comparison</div>
          </div>

          {/* Chart Legend */}
          <div style={{ display: 'flex', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--eco-text-sub)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--eco-green-neon)' }}></div>
              Energy (kWh)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--eco-text-sub)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#38bdf8' }}></div>
              Water (L)
            </div>
          </div>
        </div>

        {/* Vertical Bars */}
        <div className="eco-bar-chart-bars">
          {daysData.map(item => (
            <div
              key={item.day}
              className="eco-bar-col"
              onClick={() => setSelectedDay(item.day)}
              style={{ cursor: 'pointer' }}
            >
              <div className="eco-bar-duo">
                <div
                  className="eco-bar-elem green"
                  style={{
                    height: `${item.greenH}px`,
                    boxShadow: selectedDay === item.day ? '0 0 10px rgba(0, 230, 118, 0.8)' : 'none'
                  }}
                ></div>
                <div
                  className="eco-bar-elem blue"
                  style={{
                    height: `${item.blueH}px`,
                    boxShadow: selectedDay === item.day ? '0 0 10px rgba(56, 189, 248, 0.8)' : 'none'
                  }}
                ></div>
              </div>
              <div
                className="eco-bar-day-label"
                style={{ color: selectedDay === item.day ? 'var(--eco-green-neon)' : 'var(--eco-text-sub)' }}
              >
                {item.day}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Top Consumers Breakdown List */}
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.85rem' }}>
          Top Consumers
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {topConsumers.map(item => (
            <div
              key={item.name}
              style={{
                background: 'var(--eco-card-bg)',
                border: '1px solid var(--eco-card-border)',
                borderRadius: 'var(--eco-radius)',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem'
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-sub)' }}>{item.val} • {item.flow}</div>
                </div>
              </div>

              <div style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.3rem 0.65rem',
                borderRadius: '20px',
                background: item.isIncrease ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                color: item.isIncrease ? '#f87171' : 'var(--eco-green-neon)'
              }}>
                {item.change}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
