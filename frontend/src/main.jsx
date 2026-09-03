import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles.css'

// Global error handler for catching non-React errors
window.onerror = function (message, source, lineno, colno, error) {
  const errorMsg = `Global Error: ${message} at ${source}:${lineno}:${colno}`;
  console.error(errorMsg);
  const errorDiv = document.createElement('div');
  errorDiv.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:red;color:white;padding:20px;z-index:9999;overflow:auto;";
  errorDiv.innerHTML = `<h1>System Error</h1><pre>${errorMsg}</pre><p>${error ? error.stack : ''}</p>`;
  document.body.appendChild(errorDiv);
  return false;
};

// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#7c3aed', color: 'white', height: '100vh' }}>
          <h1>App Crash</h1>
          <p>{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element not found");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
} catch (error) {
  console.error("Startup Error:", error);
  document.body.innerHTML = `<div style="padding: 20px; color: white; background: red;"><h1>Critical Error</h1><p>${error.message}</p></div>`;
}

// Register service worker for PWA functionality
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered:', registration);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}
*/
