import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt'; // Import MQTT
import WaterQuality from './components/WaterQuality';
import UsageChart from './components/UsageChart';
import AIAssistant from './components/AIAssistant';
import PipeMap from './components/PipeMap';
import Settings from './components/Settings'; // Import Settings
import FlowMonitor from './components/FlowMonitor'; // Import FlowMonitor
import SatelliteMonitoring from './components/SatelliteMonitoring'; // Satellite River Monitoring
import EcoDashboard from './components/EcoDashboard'; // EcoSync Main Dashboard
import UsageInsights from './components/UsageInsights'; // EcoSync Usage & Insights
import Automations from './components/Automations'; // EcoSync Automations
import Toast from './components/Toast'; // Import Toast
import { DEFAULT_LEAKAGE_POINTS, DEFAULT_PIPES, DEFAULT_MQTT } from './constants'; // Import Constants

function App() {
  const [activeView, setActiveView] = useState('dashboard');

  // Lifted state for pipes
  const [pipes, setPipes] = useState(() => {
    const savedPipes = localStorage.getItem('water-app-pipes');
    if (savedPipes) return JSON.parse(savedPipes);
    return DEFAULT_PIPES;
  });

  // State for Leakage Points (simulated or real)
  // We lift this up so MQTT can update it
  const [leakagePoints, setLeakagePoints] = useState(DEFAULT_LEAKAGE_POINTS);

  // State for Real-time Water Quality Metrics
  const [realTimeMetrics, setRealTimeMetrics] = useState({ flow1: 0, flow2: 0, leak: 0, tds: 0 });
  const [waterQualityMetrics, setWaterQualityMetrics] = useState({
    ph: 0,
    turbidity: 0
  });

  // MQTT Connection Status
  const [mqttStatus, setMqttStatus] = useState('connecting');

  // Notifications & Dark Mode State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  const lastLeakNotificationRef = useRef(0);
  const clientRef = useRef(null);

  // Persistence for pipes
  useEffect(() => {
    localStorage.setItem('water-app-pipes', JSON.stringify(pipes));
  }, [pipes]);

  // State for Leak Threshold
  const [leakThreshold, setLeakThreshold] = useState(() => {
    return parseFloat(localStorage.getItem('leak-threshold')) || 0.1;
  });

  // Persistence for leak threshold
  useEffect(() => {
    localStorage.setItem('leak-threshold', leakThreshold);
  }, [leakThreshold]);

  // MQTT Connection Effect
  useEffect(() => {
    const brokerUrl = localStorage.getItem('mqtt-broker') || DEFAULT_MQTT.BROKER;
    const topic = localStorage.getItem('mqtt-topic') || DEFAULT_MQTT.TOPIC;
    const pipesTopic = `${topic}/pipes`;

    const isSecure = window.location.protocol === 'https:';
    let processedBrokerUrl = brokerUrl ? brokerUrl.trim() : '';

    // Fix missing or incorrect protocols
    if (!processedBrokerUrl.includes('://')) {
      processedBrokerUrl = 'ws://' + processedBrokerUrl;
    } else if (processedBrokerUrl.startsWith('mqtt://') || processedBrokerUrl.startsWith('tcp://')) {
      processedBrokerUrl = processedBrokerUrl.replace(/^(mqtt|tcp):\/\//, 'ws://');
    } else if (processedBrokerUrl.startsWith('http://')) {
      processedBrokerUrl = processedBrokerUrl.replace('http://', 'ws://');
    } else if (processedBrokerUrl.startsWith('https://')) {
      processedBrokerUrl = processedBrokerUrl.replace('https://', 'wss://');
    }

    // Automatically upgrade to wss if page is HTTPS
    if (isSecure && processedBrokerUrl.startsWith('ws://')) {
      processedBrokerUrl = processedBrokerUrl.replace('ws://', 'wss://');
    }

    try {
      // Validate url synchronously so it can be caught
      new URL(processedBrokerUrl);

      console.log(`Connecting to MQTT Broker: ${processedBrokerUrl} (Secure: ${isSecure})`);
      setMqttStatus('connecting');

      // Connect with WebSocket options
      const client = mqtt.connect(processedBrokerUrl, {
        connectTimeout: 4000,
        protocol: isSecure ? 'wss' : 'ws',
        reconnectPeriod: 5000,
      });
      clientRef.current = client;

      client.on('connect', () => {
        console.log('Successfully connected to MQTT Broker at', processedBrokerUrl);
        setMqttStatus('connected');

        // Subscribe to Topics
        client.subscribe(topic, (err) => {
          if (!err) console.log(`Subscribed to topic: ${topic}`);
        });
        client.subscribe('water/data');
        client.subscribe(pipesTopic, (err) => {
          if (!err) console.log(`Subscribed to pipes sync topic: ${pipesTopic}`);
        });
      });

      client.on('error', (err) => {
        console.error('MQTT Connection Error:', err);
        setMqttStatus('error');
      });

      client.on('close', () => {
        console.log('MQTT Connection Closed');
        setMqttStatus('disconnected');
      });

      client.on('reconnect', () => {
        console.log('MQTT Reconnecting...');
        setMqttStatus('connecting');
      });

      client.on('message', (receivedTopic, message) => {
        const msgString = message.toString();
        // console.log(`Received message on topic [${receivedTopic}]`);

        // Handle Pipe Sync
        if (receivedTopic === pipesTopic) {
          try {
            const receivedPipes = JSON.parse(msgString);
            setPipes(currentPipes => {
              // Simple check to avoid loops/unnecessary updates
              if (JSON.stringify(currentPipes) !== JSON.stringify(receivedPipes)) {
                console.log('Syncing pipes from MQTT');
                return receivedPipes;
              }
              return currentPipes;
            });
          } catch (e) {
            console.error('Failed to parse pipes sync message', e);
          }
          return;
        }

        if (receivedTopic === topic || receivedTopic === 'water/data') {
          try {
            const payload = JSON.parse(msgString);
            // console.log('Parsed MQTT Payload:', payload);

            // Expecting payload: { id, lat, lng, severity, flowRate, location }
            // Update leakage points if valid data
            if (payload.lat && payload.lng) {
              setLeakagePoints(prevLeaks => {
                // Avoid duplicates or update existing
                const exists = prevLeaks.find(l => l.id === payload.id);
                if (exists) {
                  return prevLeaks.map(l => l.id === payload.id ? { ...l, ...payload } : l);
                }
                return [...prevLeaks, { ...payload, id: payload.id || Date.now() }];
              });
            }

            // Handle TDS Data (expecting { tds_ppm: number })
            if (payload.tds_ppm !== undefined) {
              setRealTimeMetrics(prev => ({ ...prev, tds: payload.tds_ppm }));
            }

            // Handle PH Data
            if (payload.ph !== undefined) {
              setWaterQualityMetrics(prev => ({ ...prev, ph: payload.ph }));
            }

            // Handle Turbidity Data
            if (payload.turbidity !== undefined) {
              setWaterQualityMetrics(prev => ({ ...prev, turbidity: payload.turbidity }));
            }

            // Handle Dual Flow Sensor Data (Hardware Keys)
            if (payload.inlet_lpm !== undefined) {
              setRealTimeMetrics(prev => ({ ...prev, flow1: payload.inlet_lpm }));
            }
            if (payload.outlet_lpm !== undefined) {
              setRealTimeMetrics(prev => ({ ...prev, flow2: payload.outlet_lpm }));
            }
            if (payload.leak_lpm !== undefined) {
              setRealTimeMetrics(prev => ({ ...prev, leak: payload.leak_lpm }));

              // Trigger notification if leak is detected (> threshold) 
              // and it's been at least 1 minute since the last notification
              if (notificationsEnabled && payload.leak_lpm > leakThreshold) {
                const now = Date.now();
                if (now - lastLeakNotificationRef.current > 60000) {
                  const id = now;
                  setNotifications(prev => [...prev, {
                    id,
                    title: 'Leak Detected!',
                    message: `Leak of ${payload.leak_lpm} LPM detected (Threshold: ${leakThreshold})`,
                    type: 'danger'
                  }]);
                  lastLeakNotificationRef.current = now;
                }
              }
            }

          } catch (error) {
            console.error('Failed to parse MQTT message:', error);
          }
        }
      });
    } catch (err) {
      console.error('MQTT setup error:', err);
      setMqttStatus('error');
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, [DEFAULT_MQTT.BROKER, DEFAULT_MQTT.TOPIC, leakThreshold, notificationsEnabled]);

  // Effect to Publish Pipe Changes to MQTT
  useEffect(() => {
    if (clientRef.current && clientRef.current.connected) {
      const topic = localStorage.getItem('mqtt-topic') || DEFAULT_MQTT.TOPIC;
      const pipesTopic = `${topic}/pipes`;
      // Check if we need to publish (simple de-bounce or check could be added here if needed)
      // For now, any state change triggers a publish, but the receiver checks for equality.
      // We use retain: true so new devices get the map immediately.
      clientRef.current.publish(pipesTopic, JSON.stringify(pipes), { retain: true });
    }
  }, [pipes]);

  // Function to clear MQTT overrides (useful for troubleshooting)
  const resetMqttConfig = () => {
    localStorage.removeItem('mqtt-broker');
    localStorage.removeItem('mqtt-topic');
    window.location.reload();
  };

  return (
    <div className={`eco-mobile-frame ${darkMode ? 'dark-mode' : ''}`}>
      {/* Top Header Bar matching EcoSync reference */}
      <header className="eco-top-header">
        <div className="eco-brand">
          <div className="eco-brand-avatar">💧</div>
          <span className="eco-brand-title">AquaSense</span>
          <div className={`status-dot ${mqttStatus}`} title={`MQTT: ${mqttStatus}`}></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="eco-icon-btn"
            title="Notifications"
            onClick={() => setNotifications(prev => [...prev, {
              id: Date.now(),
              title: 'System Optimal',
              message: 'All sensor nodes & satellite feeds are streaming normally.',
              type: 'success'
            }])}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && <span className="eco-bell-badge"></span>}
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main style={{ flex: 1, paddingBottom: '1rem' }}>
        {activeView === 'dashboard' && (
          <EcoDashboard
            realTimeData={realTimeMetrics}
            waterQuality={waterQualityMetrics}
            onNavigate={setActiveView}
            onShowToast={(t) => setNotifications(p => [...p, { id: Date.now(), ...t }])}
          />
        )}

        {activeView === 'usage' && (
          <UsageInsights />
        )}

        {activeView === 'automations' && (
          <Automations
            onShowToast={(t) => setNotifications(p => [...p, { id: Date.now(), ...t }])}
          />
        )}

        {activeView === 'satellite' && (
          <SatelliteMonitoring
            onShowToast={(toast) => setNotifications(prev => [...prev, { id: Date.now(), ...toast }])}
          />
        )}

        {activeView === 'map' && (
          <div style={{ padding: '0 1rem 1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--eco-text-main)', margin: 0 }}>Infrastructure Map</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-sub)', margin: '0.2rem 0 0' }}>Pipeline network and leakage detection</p>
            </div>
            <PipeMap
              pipes={pipes}
              setPipes={setPipes}
              leakagePoints={leakagePoints}
              clearLeakagePoints={() => setLeakagePoints([])}
            />
          </div>
        )}

        {activeView === 'flow-monitor' && (
          <div style={{ padding: '0 1rem 1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--eco-text-main)', margin: 0 }}>Flow Monitor</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-sub)', margin: '0.2rem 0 0' }}>Real-time dual sensor & leakage tracking</p>
            </div>
            <FlowMonitor realTimeData={realTimeMetrics} leakThreshold={leakThreshold} />
          </div>
        )}

        {activeView === 'settings' && (
          <div style={{ padding: '0 1rem 1.5rem' }}>
            <Settings
              setPipes={setPipes}
              leakThreshold={leakThreshold}
              setLeakThreshold={setLeakThreshold}
              notifications={notificationsEnabled}
              setNotifications={setNotificationsEnabled}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              testNotification={() => setNotifications(prev => [...prev, {
                id: Date.now(),
                title: 'Leak Detected!',
                message: 'Abnormal flow detected in main line.',
                type: 'danger'
              }])}
            />
          </div>
        )}
      </main>

      {/* EcoSync Bottom Navigation Bar */}
      <nav className="eco-bottom-nav">
        <button
          className={`eco-nav-tab ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          className={`eco-nav-tab ${activeView === 'usage' ? 'active' : ''}`}
          onClick={() => setActiveView('usage')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Usage</span>
        </button>

        <button
          className={`eco-nav-tab ${activeView === 'automations' ? 'active' : ''}`}
          onClick={() => setActiveView('automations')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <circle cx="4" cy="12" r="2" />
            <circle cx="12" cy="10" r="2" />
            <circle cx="20" cy="14" r="2" />
          </svg>
          <span>Flows</span>
        </button>

        <button
          className={`eco-nav-tab ${activeView === 'satellite' ? 'active' : ''}`}
          onClick={() => setActiveView('satellite')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8" />
            <path d="M3.6 15h16.8" />
            <path d="M11.5 3a17 17 0 0 0 0 18" />
            <path d="M12.5 3a17 17 0 0 1 0 18" />
          </svg>
          <span>Satellite</span>
        </button>

        <button
          className={`eco-nav-tab ${activeView === 'map' ? 'active' : ''}`}
          onClick={() => setActiveView('map')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          <span>Map</span>
        </button>

        <button
          className={`eco-nav-tab ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      {/* Notifications Container */}
      <div className="toast-container">
        {notifications.map(toast => (
          <Toast
            key={toast.id}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onClose={() => setNotifications(prev => prev.filter(n => n.id !== toast.id))}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
