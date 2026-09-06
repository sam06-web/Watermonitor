import { useState } from 'react';
import { DEFAULT_MQTT, DEFAULT_PIPES } from '../constants';

const Settings = ({ setPipes, testNotification, notifications, setNotifications, darkMode, setDarkMode }) => {

    // MQTT Settings State
    const [brokerUrl, setBrokerUrl] = useState(() => localStorage.getItem('mqtt-broker') || DEFAULT_MQTT.BROKER);
    const [topic, setTopic] = useState(() => localStorage.getItem('mqtt-topic') || DEFAULT_MQTT.TOPIC);

    // Gemini Settings State
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '');

    const handleSaveConfig = () => {
        localStorage.setItem('mqtt-broker', brokerUrl);
        localStorage.setItem('mqtt-topic', topic);
        if (geminiApiKey) {
            localStorage.setItem('gemini-api-key', geminiApiKey);
        } else {
            localStorage.removeItem('gemini-api-key');
        }
        alert('Configuration Saved! The app will now reload to apply changes.');
        window.location.reload();
    };

    const resetPipes = () => {
        setPipes(DEFAULT_PIPES);
        alert('Pipe network reset to default configuration.');
    };

    const clearPipes = () => {
        if (window.confirm('Are you sure you want to delete ALL pipes? This action cannot be undone.')) {
            setPipes([]);
        }
    };

    const simulateLeak = () => {
        if (testNotification) {
            testNotification();
        } else {
            alert('Leak simulation dispatched! Check the dashboard for new alerts.');
        }
    };

    return (
        <div className="settings-container">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Configure application preferences and mock data</p>
            </div>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                {/* MQTT Configuration Card */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1rem', color: 'var(--eco-text-main)', fontSize: '1.2rem', fontWeight: '800' }}>Connection Settings</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>Broker URL (WebSocket)</label>
                            <input
                                type="text"
                                value={brokerUrl}
                                onChange={(e) => setBrokerUrl(e.target.value)}
                                placeholder="ws://broker.hivemq.com:8000/mqtt"
                                className="settings-input"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    fontWeight: '500', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>MQTT Topic</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="water/meter/data"
                                className="settings-input"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    fontWeight: '500', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>Gemini API Key</label>
                            <input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="Enter your Gemini API Key"
                                className="settings-input"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    fontWeight: '500', outline: 'none'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                Leave empty to use default environment key if available.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveConfig}
                            className="btn btn-primary"
                            style={{ justifyContent: 'center', marginTop: '0.5rem', padding: '0.85rem 1.5rem', borderRadius: '12px' }}
                        >
                            💾 Save & Connect
                        </button>
                    </div>
                </div>

                {/* Mock Data Control Card */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1rem', color: 'var(--eco-text-main)', fontSize: '1.2rem', fontWeight: '800' }}>Mock Data Controls</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={resetPipes}
                            className="btn btn-primary"
                            style={{ justifyContent: 'center', padding: '0.85rem 1.5rem', borderRadius: '12px' }}
                        >
                            🔄 Reset Pipe Network
                        </button>
                        <button
                            onClick={clearPipes}
                            className="btn btn-danger-soft"
                            style={{ justifyContent: 'center', padding: '0.85rem 1.5rem', borderRadius: '12px' }}
                        >
                            🗑️ Clear All Pipes
                        </button>
                        <button
                            onClick={simulateLeak}
                            className="btn btn-warning-soft"
                            style={{ justifyContent: 'center', padding: '0.85rem 1.5rem', borderRadius: '12px' }}
                        >
                            ⚠️ Simulate Leakage Event
                        </button>
                    </div>
                </div>

                {/* General Preferences Card */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1rem', color: 'var(--eco-text-main)', fontSize: '1.2rem', fontWeight: '800' }}>General Preferences</h2>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '700' }}>High Severity Alerts</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>Receive notifications for critical leaks</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={notifications}
                                onChange={() => setNotifications(!notifications)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '700' }}>Dark Mode</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>Toggle application theme</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={darkMode}
                                onChange={() => setDarkMode(!darkMode)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
