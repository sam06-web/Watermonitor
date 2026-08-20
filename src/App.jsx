import { useState, useEffect, useReducer, useRef, lazy, Suspense } from 'react';
import mqtt from 'mqtt'; // Import MQTT
import FloatingChat from './components/FloatingChat';
import PipeMap from './components/PipeMap';
import Settings from './components/Settings'; // Import Settings
import EcoDashboard from './components/EcoDashboard'; // EcoSync Main Dashboard
import Toast from './components/Toast'; // Import Toast
import { DEFAULT_LEAKAGE_POINTS, DEFAULT_PIPES, DEFAULT_MQTT } from './constants'; // Import Constants
import { analyzeContamination } from './utils/waterQuality';

// The satellite view pulls in MapLibre GL (~600 KB), so it is lazy-loaded
// into a separate chunk that only downloads when the Satellite tab is opened.
const SatelliteMonitoring = lazy(() => import('./components/SatelliteMonitoring'));

const modelStatusReducer = (state, action) => {
  switch (action) {
    case 'loading': return 'loading';
    case 'ready': return 'ready';
    case 'unavailable': return 'unavailable';
    case 'idle': return 'idle';
    default: return state;
  }
};

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
  const [contaminationPoints, setContaminationPoints] = useState([]);
  const [satelliteObservation, setSatelliteObservation] = useState(null);
  const [satelliteRiver, setSatelliteRiver] = useState(null);
  const [selectedSatelliteWaterBody, setSelectedSatelliteWaterBody] = useState('cauvery');
  const [modelPrediction, setModelPrediction] = useState(null);
  const [modelStatus, dispatchModelStatus] = useReducer(modelStatusReducer, 'idle');

  // State for Real-time Water Quality Metrics
  const [realTimeMetrics, setRealTimeMetrics] = useState({ tds: 0 });
  const [waterQualityMetrics, setWaterQualityMetrics] = useState({ ph: 0, turbidity: 0 });

  // MQTT Connection Status
  const [mqttStatus, setMqttStatus] = useState('connecting');

  // Notifications & Dark Mode State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  const clientRef = useRef(null);

  // Keep the latest satellite observation available to the MQTT message handler
  // without tearing down the broker connection when it changes.
  const satelliteObservationRef = useRef(satelliteObservation);
  useEffect(() => {
    satelliteObservationRef.current = satelliteObservation;
  }, [satelliteObservation]);

  // Satellite observations are intentionally loaded independently from MQTT.
  // Sensors provide continuous readings while Sentinel observations validate spatial conditions periodically.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/satellite/latest?river=${encodeURIComponent(selectedSatelliteWaterBody)}`, { signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setSatelliteObservation(data.observation);
          setSatelliteRiver(data.river);
          if (['High', 'Elevated'].includes(data.observation?.pollutionRisk) && data.river?.latitude && data.river?.longitude) {
            const analysis = analyzeContamination({ ph: 7.2, tds: 420, turbidity: data.observation.turbidityNtu, satellite: data.observation });
            setContaminationPoints(prev => [...prev.filter(point => point.source !== 'satellite'), {
              id: `satellite-${data.river.id}`,
              lat: Number(data.river.latitude),
              lng: Number(data.river.longitude),
              location: data.river.name,
              severity: analysis.risk,
              qualityScore: data.observation.healthScore ?? analysis.score,
              contaminationType: analysis.type,
              cause: analysis.cause,
              source: 'satellite'
            }]);
          }
        } else if (data.river) {
          // No observation yet for this water body (e.g. freshly searched);
          // still expose the river so the satellite view can map it.
          setSatelliteRiver(data.river);
          setSatelliteObservation(null);
        }
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        // The sensor dashboard remains available when the satellite service is offline.
      });
    return () => controller.abort();
  }, [selectedSatelliteWaterBody]);

  // Ask the Python model for a prediction whenever a complete sensor sample changes.
  useEffect(() => {
    const sample = {
      ph: Number(waterQualityMetrics.ph),
      tds: Number(realTimeMetrics.tds),
      turbidity: Number(waterQualityMetrics.turbidity)
    };
    if (![sample.ph, sample.tds, sample.turbidity].every(Number.isFinite) || Object.values(sample).some(value => value <= 0)) return;

    const controller = new AbortController();
    dispatchModelStatus('loading');
    fetch('/api/water-quality/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
      signal: controller.signal
    })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Prediction failed');
        setModelPrediction(data);
        dispatchModelStatus('ready');
      })
      .catch(error => {
        if (error.name !== 'AbortError') dispatchModelStatus('unavailable');
      });

    return () => controller.abort();
  }, [realTimeMetrics.tds, waterQualityMetrics.ph, waterQualityMetrics.turbidity]);

  // Persistence for pipes
  useEffect(() => {
    localStorage.setItem('water-app-pipes', JSON.stringify(pipes));
  }, [pipes]);

  // A user-scanned map area produced a real observation; render it directly
  // without re-resolving the (already persisted) transient river record.
  const handleAreaScanned = (river, observation) => {
    setSatelliteRiver(river);
    setSatelliteObservation(observation);
  };

  // MQTT Connection Effect
  useEffect(() => {
    const brokerUrl = localStorage.getItem('mqtt-broker') || DEFAULT_MQTT.BROKER;
    const topic = localStorage.getItem('mqtt-topic') || DEFAULT_MQTT.TOPIC;

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

        // Subscribe to the sensor data topic
        client.subscribe(topic, (err) => {
          if (!err) console.log(`Subscribed to topic: ${topic}`);
        });
        // Also subscribe to the hardcoded fallback so messages arrive regardless of config
        client.subscribe('water/data');
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
        if (receivedTopic !== topic && receivedTopic !== 'water/data') return;

        try {
          const payload = JSON.parse(message.toString());

          // Expected hardware payload: { ph, turbidity, tds_ppm, lat, lng }

          // Water quality sensor readings
          if (payload.ph !== undefined) {
            setWaterQualityMetrics(prev => ({ ...prev, ph: payload.ph }));
          }
          if (payload.turbidity !== undefined) {
            setWaterQualityMetrics(prev => ({ ...prev, turbidity: payload.turbidity }));
          }
          if (payload.tds_ppm !== undefined) {
            setRealTimeMetrics(prev => ({ ...prev, tds: payload.tds_ppm }));
          }

          // GPS coordinates — place/update a pin on the map and run contamination analysis
          if (payload.lat !== undefined && payload.lng !== undefined) {
            const pinId = `sensor-${payload.lat}-${payload.lng}`;

            setLeakagePoints(prev => {
              const exists = prev.find(p => p.id === pinId);
              const pin = { id: pinId, lat: payload.lat, lng: payload.lng };
              return exists
                ? prev.map(p => p.id === pinId ? { ...p, ...pin } : p)
                : [...prev, pin];
            });

            const analysis = analyzeContamination({
              ph: payload.ph ?? 7.2,
              tds: payload.tds_ppm ?? 420,
              turbidity: payload.turbidity ?? 2.1,
              satellite: satelliteObservationRef.current
            });

            setContaminationPoints(prev => {
              const point = {
                id: pinId,
                lat: Number(payload.lat),
                lng: Number(payload.lng),
                location: 'Sensor station',
                severity: analysis.risk,
                qualityScore: analysis.score,
                contaminationType: analysis.type,
                cause: analysis.cause,
                ph: payload.ph,
                tds: payload.tds_ppm,
                turbidity: payload.turbidity,
                source: 'sensor'
              };
              return prev.some(item => item.id === point.id)
                ? prev.map(item => item.id === point.id ? point : item)
                : [...prev, point];
            });
          }
        } catch (error) {
          console.error('Failed to parse MQTT message:', error);
        }
      });
    } catch (err) {
      console.error('MQTT setup error:', err);
      queueMicrotask(() => setMqttStatus('error'));
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, []);

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
            satelliteObservation={satelliteObservation}
            satelliteRiver={satelliteRiver}
            contaminationPoints={contaminationPoints}
            modelPrediction={modelPrediction}
            modelStatus={modelStatus}
            onNavigate={setActiveView}
            onShowToast={(t) => setNotifications(p => [...p, { id: Date.now(), ...t }])}
          />
        )}

        {activeView === 'satellite' && (
          <Suspense fallback={<div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading satellite monitoring view...</div>}>
            <SatelliteMonitoring
              observation={satelliteObservation}
              riverData={satelliteRiver}
              onObservationChange={setSatelliteObservation}
              onWaterBodyChange={setSelectedSatelliteWaterBody}
              onAreaScanned={handleAreaScanned}
              onShowToast={(toast) => setNotifications(prev => [...prev, { id: Date.now(), ...toast }])}
            />
          </Suspense>
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
              contaminationPoints={contaminationPoints}
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
              notifications={notificationsEnabled}
              setNotifications={setNotificationsEnabled}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              testNotification={() => setNotifications(prev => [...prev, {
                id: Date.now(),
                title: 'Test Alert',
                message: 'Notification system is working correctly.',
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

      {/* Floating AI Pollution Assistant */}
      <FloatingChat
        realTimeData={realTimeMetrics}
        waterQuality={waterQualityMetrics}
        satelliteObservation={satelliteObservation}
        satelliteRiver={satelliteRiver}
        contaminationPoints={contaminationPoints}
        modelPrediction={modelPrediction}
      />
    </div>
  );
}

export default App;
