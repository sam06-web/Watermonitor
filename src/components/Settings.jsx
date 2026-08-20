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
                    <h2 style={{ marginBottom: '1rem', color: 'var(--primary-blue-light)' }}>Connection Settings</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Broker URL (WebSocket)</label>
                            <input
                                type="text"
                                value={brokerUrl}
                                onChange={(e) => setBrokerUrl(e.target.value)}
                                placeholder="ws://broker.hivemq.com:8000/mqtt"
                                style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>MQTT Topic</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="water/meter/data"
                                style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Gemini API Key</label>
                            <input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="Enter your Gemini API Key"
                                style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Leave empty to use the default environment key if available.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveConfig}
                            className="btn btn-primary"
                            style={{ justifyContent: 'center', marginTop: '0.5rem' }}
                        >
                            💾 Save & Connect
                        </button>
                    </div>
                </div>

                {/* Mock Data Control Card */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1rem', color: 'var(--primary-blue-light)' }}>Mock Data Controls</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={resetPipes}
                            className="btn btn-primary"
                            style={{ justifyContent: 'center' }}
                        >
                            🔄 Reset Pipe Network
                        </button>
                        <button
                            onClick={clearPipes}
                            className="btn"
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', justifyContent: 'center', border: '1px solid #ef4444' }}
                        >
                            🗑️ Clear All Pipes
                        </button>
                        <button
                            onClick={simulateLeak}
                            className="btn"
                            style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', justifyContent: 'center', border: '1px solid #f59e0b' }}
                        >
                            ⚠️ Simulate Leakage Event
                        </button>
                    </div>
                </div>

                {/* General Settings Card */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1rem', color: 'var(--primary-blue-light)' }}>General Preferences</h2>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>High Severity Alerts</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Receive notifications for critical leaks</p>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                            <input
                                type="checkbox"
                                checked={notifications}
                                onChange={() => setNotifications(!notifications)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: notifications ? 'var(--primary-blue)' : '#4b5563',
                                transition: '.4s', borderRadius: '34px'
                            }}></span>
                            <span style={{
                                position: 'absolute', content: '""', height: '20px', width: '20px', left: '3px', bottom: '3px',
                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                transform: notifications ? 'translateX(24px)' : 'translateX(0)'
                            }}></span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Dark Mode</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Toggle application theme</p>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                            <input
                                type="checkbox"
                                checked={darkMode}
                                onChange={() => setDarkMode(!darkMode)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: darkMode ? 'var(--primary-blue)' : '#4b5563',
                                transition: '.4s', borderRadius: '34px'
                            }}></span>
                            <span style={{
                                position: 'absolute', content: '""', height: '20px', width: '20px', left: '3px', bottom: '3px',
                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                transform: darkMode ? 'translateX(24px)' : 'translateX(0)'
                            }}></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
