import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_RIVERS = [
  { id: 'cauvery', name: 'Cauvery River', state: 'Tamil Nadu & Karnataka' },
  { id: 'bhavani', name: 'Bhavani River', state: 'Tamil Nadu & Kerala' },
  { id: 'noyyal', name: 'Noyyal River', state: 'Tamil Nadu' },
  { id: 'amaravathi', name: 'Amaravathi River', state: 'Tamil Nadu' },
  { id: 'ganga', name: 'Ganga River', state: 'Uttarakhand, UP, Bihar, WB' },
  { id: 'yamuna', name: 'Yamuna River', state: 'Delhi, UP, Haryana' },
  { id: 'godavari', name: 'Godavari River', state: 'Maharashtra, AP, Telangana' }
];

const SPECTRUM_MODES = [
  { id: 'rgb', label: 'True Color (RGB)', desc: 'Bands 4, 3, 2 - Natural View' },
  { id: 'false_color', label: 'False Color (NIR)', desc: 'Bands 8, 4, 3 - Vegetation Health' },
  { id: 'ndwi', label: 'NDWI Water Mask', desc: 'Bands 3, 8 - Water Delineation' },
  { id: 'moisture', label: 'Moisture Index (NDMI)', desc: 'Bands 8, 11 - Soil Wetness' }
];

export default function SatelliteMonitoring({ onShowToast }) {
  // River Search & Selection State
  const [selectedRiverId, setSelectedRiverId] = useState('cauvery');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // River & Observation Data
  const [riverData, setRiverData] = useState(null);
  const [observation, setObservation] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyPeriod, setHistoryPeriod] = useState('30d');
  const [activeChartMetric, setActiveChartMetric] = useState('waterArea');

  // Viewer Controls
  const [spectrumMode, setSpectrumMode] = useState('rgb');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [mapLayer, setMapLayer] = useState('satellite'); // 'satellite' | 'dark' | 'ndwi'

  // Loading & Refresh State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // References
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchInputRef = useRef(null);
  const compareContainerRef = useRef(null);

  // 1. Fetch River & Observation Data
  const loadRiverData = async (riverId, showToastMsg = false) => {
    setIsLoading(true);
    try {
      // Fetch latest observation
      const res = await fetch(`/api/satellite/latest?river=${riverId}`);
      const data = await res.json();

      if (data.success) {
        setRiverData(data.river);
        setObservation(data.observation);
        setSelectedRiverId(data.river.id);

        if (showToastMsg && onShowToast) {
          onShowToast({
            title: 'Satellite Scene Loaded',
            message: `Loaded latest ${data.observation.satelliteName} observation for ${data.river.name}`,
            type: 'info'
          });
        }
      }

      // Fetch statistics
      const statsRes = await fetch(`/api/satellite/statistics?river=${riverId}`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStatistics(statsData.statistics);
      }

      // Fetch history
      await loadHistory(riverId, historyPeriod);
    } catch (err) {
      console.error('Failed to load river data:', err);
      if (onShowToast) {
        onShowToast({
          title: 'Satellite API Error',
          message: 'Unable to connect to satellite backend. Retrying...',
          type: 'danger'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Historical Remote Sensing Telemetry
  const loadHistory = async (riverId, period) => {
    try {
      const res = await fetch(`/api/satellite/history?river=${riverId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    loadRiverData(selectedRiverId);
  }, []);

  // Update history when period changes
  useEffect(() => {
    if (selectedRiverId) {
      loadHistory(selectedRiverId, historyPeriod);
    }
  }, [historyPeriod, selectedRiverId]);

  // 3. Search River Autocomplete with Debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/satellite/search?river=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.rivers || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 4. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              ],
              tileSize: 256,
              attribution: 'Esri, Maxar, Earthstar Geographics'
            },
            'carto-dark': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© CARTO'
            }
          },
          layers: [
            {
              id: 'satellite-base',
              type: 'raster',
              source: 'esri-satellite',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: [78.583, 11.137], // Cauvery initial
        zoom: 7.5,
        pitch: 25,
        bearing: 0
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');

      mapInstanceRef.current = map;
    }
  }, []);

  // 5. Update Map Layers & GeoJSON Vector Highlights when River Changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !riverData) return;

    const onMapLoaded = () => {
      // Update River Vector Source
      const geojsonSource = map.getSource('river-vector');
      const riverGeojson = {
        type: 'Feature',
        geometry: riverData.geometry || {
          type: 'Point',
          coordinates: [riverData.longitude, riverData.latitude]
        },
        properties: {
          name: riverData.name,
          basin: riverData.basin
        }
      };

      if (geojsonSource) {
        geojsonSource.setData(riverGeojson);
      } else {
        map.addSource('river-vector', {
          type: 'geojson',
          data: riverGeojson
        });

        // Outer Cyan Glow
        map.addLayer({
          id: 'river-glow',
          type: 'line',
          source: 'river-vector',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#00f0ff',
            'line-width': 14,
            'line-opacity': 0.4,
            'line-blur': 4
          }
        });

        // Core Water Vector Stream
        map.addLayer({
          id: 'river-core',
          type: 'line',
          source: 'river-vector',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 6,
            'line-opacity': 0.95
          }
        });

        // River Centerline Pulse
        map.addLayer({
          id: 'river-pulse',
          type: 'line',
          source: 'river-vector',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-dasharray': [3, 3],
            'line-opacity': 0.8
          }
        });
      }

      // Fly and Fit to River Bounding Box
      if (riverData.bbox && Array.isArray(riverData.bbox) && riverData.bbox.length === 4) {
        map.fitBounds(
          [
            [riverData.bbox[0], riverData.bbox[1]],
            [riverData.bbox[2], riverData.bbox[3]]
          ],
          {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            duration: 1800,
            pitch: 35
          }
        );
      } else if (riverData.longitude && riverData.latitude) {
        map.flyTo({
          center: [riverData.longitude, riverData.latitude],
          zoom: 9.5,
          duration: 1800,
          pitch: 35
        });
      }
    };

    if (map.loaded()) {
      onMapLoaded();
    } else {
      map.once('load', onMapLoaded);
    }
  }, [riverData]);

  // 6. Handle Manual Refresh of Latest Satellite Pass
  const handleRefresh = async () => {
    if (isRefreshing || !riverData) return;
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/satellite/refresh?river=${riverData.id}`, { method: 'POST' });
      const data = await res.json();

      if (data.success && data.observation) {
        setObservation(data.observation);
        await loadHistory(riverData.id, historyPeriod);

        if (onShowToast) {
          onShowToast({
            title: 'Telemetry Refreshed',
            message: `Retrieved latest ${data.observation.satellite_name || data.observation.satelliteName} observation.`,
            type: 'success'
          });
        }
      }
    } catch (err) {
      console.error('Refresh error:', err);
      if (onShowToast) {
        onShowToast({
          title: 'Refresh Failed',
          message: 'Could not fetch new satellite pass. Using cached observation.',
          type: 'warning'
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // 7. Handle Image Comparison Slider Drag
  const handleSliderMove = (e) => {
    if (!compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (!clientX) return;

    const pos = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(pos);
  };

  // 8. Download Satellite Image & Telemetry Metadata Report
  const handleDownloadImage = () => {
    if (!riverData || !observation) return;
    const imageUrl = `/api/satellite/image?river=${riverData.id}&type=${spectrumMode}&date=${observation.imageDate}`;

    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AquaSense_${riverData.id}_${spectrumMode}_${observation.imageDate}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (onShowToast) {
          onShowToast({
            title: 'Image Downloaded',
            message: `Exported ${spectrumMode.toUpperCase()} satellite capture for ${riverData.name}.`,
            type: 'success'
          });
        }
      })
      .catch(err => {
        console.error('Download error:', err);
      });
  };

  return (
    <div className="satellite-monitoring-container">
      {/* 1. Header & River Search Box */}
      <div className="sat-header-section glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="sat-live-indicator pulse"></span>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem' }}>
                Satellite River Monitoring
              </h1>
            </div>
            <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
              High-resolution remote sensing, spectral indices, and hydrological AI analysis
            </p>
          </div>

          {/* Refresh Observation Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="sat-latest-badge">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>OBSERVATION MODE:</span>
              <strong style={{ color: 'var(--accent-cyan)', marginLeft: '0.4rem', fontSize: '0.85rem' }}>
                Latest Satellite Pass
              </strong>
            </div>

            <button
              className={`btn btn-primary ${isRefreshing ? 'sat-btn-spinning' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.2rem',
                fontSize: '0.9rem'
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {isRefreshing ? 'Fetching New Pass...' : 'Refresh Observation'}
            </button>
          </div>
        </div>

        {/* River Quick Selector Chips & Autocomplete Search */}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Quick River Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: '600' }}>MONITOR RIVER:</span>
            {DEFAULT_RIVERS.slice(0, 4).map(r => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedRiverId(r.id);
                  setSearchQuery('');
                  setShowDropdown(false);
                  loadRiverData(r.id, true);
                }}
                className={`sat-chip ${selectedRiverId === r.id ? 'active' : ''}`}
              >
                💧 {r.name}
              </button>
            ))}
          </div>

          {/* Search Box Input */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
            <div className="sat-search-input-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="sat-search-input"
                placeholder="Search any river (e.g., Cauvery, Bhavani, Ganga, Godavari, Amazon...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              />
              {isSearching && <span className="sat-search-spinner"></span>}
              {searchQuery && (
                <button
                  className="sat-search-clear"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="sat-search-dropdown glass">
                {searchResults.map(river => (
                  <div
                    key={river.id}
                    className="sat-search-dropdown-item"
                    onClick={() => {
                      setSelectedRiverId(river.id);
                      setSearchQuery(river.name);
                      setShowDropdown(false);
                      loadRiverData(river.id, true);
                    }}
                  >
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{river.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {river.state ? `${river.state} • ` : ''}{river.basin || 'River Basin'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Latest Satellite Observation Card */}
      {observation && (
        <div className="glass-card sat-observation-banner" style={{ marginBottom: '1.5rem' }}>
          <div className="sat-obs-grid">
            <div className="sat-obs-item">
              <div className="sat-obs-icon">🛰️</div>
              <div>
                <div className="sat-obs-label">Satellite Mission</div>
                <div className="sat-obs-value">{observation.satelliteName}</div>
                <div className="sat-obs-sub">{observation.sensor}</div>
              </div>
            </div>

            <div className="sat-obs-item">
              <div className="sat-obs-icon">📅</div>
              <div>
                <div className="sat-obs-label">Acquisition Date</div>
                <div className="sat-obs-value">{observation.imageDate}</div>
                <div className="sat-obs-sub">
                  {new Date(observation.imageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                </div>
              </div>
            </div>

            <div className="sat-obs-item">
              <div className="sat-obs-icon">☁️</div>
              <div>
                <div className="sat-obs-label">Cloud Cover</div>
                <div className="sat-obs-value" style={{ color: observation.cloudCover < 20 ? 'var(--success-green)' : 'var(--warning-amber)' }}>
                  {observation.cloudCover}%
                </div>
                <div className="sat-obs-sub">
                  {observation.cloudCover < 15 ? 'Optimal Visibility' : 'Partially Obscured'}
                </div>
              </div>
            </div>

            <div className="sat-obs-item">
              <div className="sat-obs-icon">🎯</div>
              <div>
                <div className="sat-obs-label">Spatial Resolution</div>
                <div className="sat-obs-value">{observation.resolution}</div>
                <div className="sat-obs-sub">Bottom-Of-Atmosphere (BOA)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Interactive Map & River Details (MapLibre GL) */}
      <div className="sat-map-container-card glass-card" style={{ marginBottom: '1.5rem', padding: '0', overflow: 'hidden' }}>
        <div className="sat-map-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🗺️</span>
            <div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                {riverData?.name || 'River'} Dynamic Satellite Map
              </strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                MapLibre GL • Vector Reach Highlighting • Multi-Layer Toggle
              </div>
            </div>
          </div>

          {/* Map Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`sat-map-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
              onClick={() => {
                setMapLayer('satellite');
                if (mapInstanceRef.current?.setLayoutProperty) {
                  mapInstanceRef.current.setLayoutProperty('satellite-base', 'visibility', 'visible');
                }
              }}
            >
              🛰️ High-Res Satellite
            </button>
            <button
              className={`sat-map-btn ${mapLayer === 'ndwi' ? 'active' : ''}`}
              onClick={() => {
                setMapLayer('ndwi');
                if (mapInstanceRef.current?.setPaintProperty) {
                  mapInstanceRef.current.setPaintProperty('river-glow', 'line-color', '#00f0ff');
                  mapInstanceRef.current.setPaintProperty('river-glow', 'line-width', 22);
                }
              }}
            >
              🌊 Water Mask (NDWI)
            </button>
          </div>
        </div>

        {/* Map Canvas */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '420px', background: '#0b1120' }} />

        {/* Map Legend Overlay */}
        <div className="sat-map-legend glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '16px', height: '4px', background: '#00f0ff', borderRadius: '2px', boxShadow: '0 0 8px #00f0ff' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Delineated River Reach</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '4px', background: '#38bdf8', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Primary Water Flow</span>
          </div>
        </div>
      </div>

      {/* 4. 8 River Information Cards */}
      {observation && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="chart-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊</span> River Biophysical & Remote Sensing Indices
          </h2>

          <div className="metrics-grid">
            {/* 1. River Width */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">River Width</span>
                <div className="metric-icon" style={{ color: '#38bdf8' }}>📏</div>
              </div>
              <div className="metric-value">
                {observation.riverWidthMeters} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>m</span>
              </div>
              <div className="metric-status good">
                <span>SWOT Reach Calibrated</span>
              </div>
            </div>

            {/* 2. Water Surface Area */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Water Surface Area</span>
                <div className="metric-icon" style={{ color: '#06b6d4' }}>🌊</div>
              </div>
              <div className="metric-value">
                {observation.waterAreaSqKm} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>km²</span>
              </div>
              <div className="metric-status good">
                <span>{(observation.waterAreaSqKm * 100).toFixed(0)} Hectares</span>
              </div>
            </div>

            {/* 3. Surface Temperature */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Surface Temperature</span>
                <div className="metric-icon" style={{ color: '#f59e0b' }}>🌡️</div>
              </div>
              <div className="metric-value">
                {observation.surfaceTemperatureC} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>°C</span>
              </div>
              <div className="metric-status good">
                <span>ERA5 Land Thermal</span>
              </div>
            </div>

            {/* 4. Estimated Turbidity */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Estimated Turbidity</span>
                <div className="metric-icon" style={{ color: observation.turbidityNtu > 25 ? '#ef4444' : '#10b981' }}>🧪</div>
              </div>
              <div className="metric-value">
                {observation.turbidityNtu} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>NTU</span>
              </div>
              <div className={`metric-status ${observation.turbidityNtu < 15 ? 'good' : observation.turbidityNtu < 30 ? 'warning' : 'critical'}`}>
                <span>{observation.turbidityNtu < 15 ? 'Clear Water' : observation.turbidityNtu < 30 ? 'Moderate Turbidity' : 'High Turbidity'}</span>
              </div>
            </div>

            {/* 5. NDWI */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">NDWI (Water Index)</span>
                <div className="metric-icon" style={{ color: '#00f0ff' }}>💧</div>
              </div>
              <div className="metric-value" style={{ color: '#00f0ff' }}>
                {observation.ndwi > 0 ? `+${observation.ndwi}` : observation.ndwi}
              </div>
              <div className="metric-status good">
                <span>(B3 - B8) / (B3 + B8)</span>
              </div>
            </div>

            {/* 6. NDVI around River */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">NDVI (Riparian Buffer)</span>
                <div className="metric-icon" style={{ color: '#22c55e' }}>🌿</div>
              </div>
              <div className="metric-value" style={{ color: '#22c55e' }}>
                +{observation.ndvi}
              </div>
              <div className="metric-status good">
                <span>Dense Vegetative Buffer</span>
              </div>
            </div>

            {/* 7. Flood Risk */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Flood Risk Status</span>
                <div className="metric-icon" style={{ color: observation.floodRiskPct > 50 ? '#ef4444' : '#3b82f6' }}>⚠️</div>
              </div>
              <div className="metric-value" style={{ color: observation.floodStatus === 'Low' ? 'var(--success-green)' : observation.floodStatus === 'Moderate' ? 'var(--warning-amber)' : 'var(--danger-red)' }}>
                {observation.floodStatus} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({observation.floodRiskPct}%)</span>
              </div>
              <div className={`metric-status ${observation.floodRiskPct < 30 ? 'good' : observation.floodRiskPct < 60 ? 'warning' : 'critical'}`}>
                <span>{observation.floodRiskPct < 30 ? 'Safe Margins' : 'Elevated Inflow'}</span>
              </div>
            </div>

            {/* 8. Water Level / Elevation */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Water Level / Elevation</span>
                <div className="metric-icon" style={{ color: '#8b5cf6' }}>📈</div>
              </div>
              <div className="metric-value">
                {observation.waterLevelMeters || '295.4'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>m ASL</span>
              </div>
              <div className="metric-status good">
                <span>WSE Altimetry</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Satellite Image Viewer & Before/After Comparison */}
      <div className="glass-card sat-viewer-card" style={{ marginBottom: '2rem' }}>
        <div className="sat-viewer-header">
          <div>
            <h2 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📷</span> Multispectral Satellite Image Viewer
            </h2>
            <p className="chart-subtitle" style={{ marginTop: '0.2rem' }}>
              Sentinel-2 & Landsat optical reflectance • Multi-band False Color & NDWI Composites
            </p>
          </div>

          {/* Viewer Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Compare Toggle */}
            <button
              className={`btn ${isComparing ? 'btn-primary' : ''}`}
              onClick={() => setIsComparing(!isComparing)}
              style={{
                background: isComparing ? undefined : 'var(--bg-tertiary)',
                color: isComparing ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem'
              }}
            >
              🔄 {isComparing ? 'Exit Comparison' : 'Compare Previous Pass'}
            </button>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                className="sat-tool-btn"
                onClick={() => setViewerZoom(z => Math.max(0.8, z - 0.2))}
                title="Zoom Out"
              >
                −
              </button>
              <span style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {Math.round(viewerZoom * 100)}%
              </span>
              <button
                className="sat-tool-btn"
                onClick={() => setViewerZoom(z => Math.min(2.5, z + 0.2))}
                title="Zoom In"
              >
                +
              </button>
              <button
                className="sat-tool-btn"
                onClick={() => setViewerZoom(1)}
                title="Reset Zoom"
              >
                ↺
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              className="sat-tool-btn"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title="Fullscreen View"
            >
              ⛶
            </button>

            {/* Download Image Button */}
            <button
              className="btn btn-primary"
              onClick={handleDownloadImage}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              ⬇ Download Image
            </button>
          </div>
        </div>

        {/* Spectrum Mode Tabs */}
        {!isComparing && (
          <div className="sat-spectrum-tabs">
            {SPECTRUM_MODES.map(mode => (
              <button
                key={mode.id}
                className={`sat-spectrum-pill ${spectrumMode === mode.id ? 'active' : ''}`}
                onClick={() => setSpectrumMode(mode.id)}
              >
                <div style={{ fontWeight: '600' }}>{mode.label}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{mode.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Image Viewport Container */}
        <div
          ref={compareContainerRef}
          className={`sat-viewport ${isFullScreen ? 'fullscreen-modal' : ''}`}
          onMouseMove={isComparing ? handleSliderMove : undefined}
          onTouchMove={isComparing ? handleSliderMove : undefined}
        >
          {isFullScreen && (
            <button className="sat-close-fullscreen-btn" onClick={() => setIsFullScreen(false)}>
              ✕ Exit Fullscreen
            </button>
          )}

          {!isComparing ? (
            /* Single Image View */
            <div className="sat-image-wrapper" style={{ transform: `scale(${viewerZoom})` }}>
              <img
                src={`/api/satellite/image?river=${riverData?.id || 'cauvery'}&type=${spectrumMode}&date=${observation?.imageDate || ''}`}
                alt={`${riverData?.name} Satellite Observation`}
                className="sat-image-render"
              />
            </div>
          ) : (
            /* Split Before / After Comparison Slider */
            <div className="sat-compare-viewport" style={{ transform: `scale(${viewerZoom})` }}>
              {/* After / Latest Image (Underneath) */}
              <img
                src={`/api/satellite/image?river=${riverData?.id || 'cauvery'}&type=rgb&date=${observation?.imageDate || ''}`}
                alt="Latest Satellite Observation"
                className="sat-compare-img sat-compare-after"
              />
              <div className="sat-compare-badge after">
                LATEST PASS ({observation?.imageDate})
              </div>

              {/* Before / Previous Image (Clipped overlay) */}
              <div className="sat-compare-overlay" style={{ width: `${sliderPosition}%` }}>
                <img
                  src={`/api/satellite/image?river=${riverData?.id || 'cauvery'}&type=rgb&date=${observation?.prevImageUrl ? '2026-07-28' : ''}`}
                  alt="Previous Satellite Observation"
                  className="sat-compare-img sat-compare-before"
                />
                <div className="sat-compare-badge before">
                  PREVIOUS PASS (15 Days Prior)
                </div>
              </div>

              {/* Draggable Divider Handle */}
              <div className="sat-compare-handle" style={{ left: `${sliderPosition}%` }}>
                <div className="sat-compare-handle-line"></div>
                <div className="sat-compare-handle-button">⇄</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Historical Analysis & Multi-Epoch Charts */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div className="chart-header">
          <div>
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📈</span> Remote Sensing Historical Trend Analysis
            </h2>
            <p className="chart-subtitle">
              Multi-epoch time-series of satellite-derived hydrological indices
            </p>
          </div>

          {/* Period Selector: 7D, 30D, 6M, 1Y */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '6m', label: '6 Months' },
              { id: '1y', label: '1 Year' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setHistoryPeriod(p.id)}
                className={`sat-chip ${historyPeriod === p.id ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'waterArea', label: '🌊 Water Area (km²)', color: '#06b6d4' },
            { id: 'temperature', label: '🌡️ Temperature (°C)', color: '#f59e0b' },
            { id: 'turbidity', label: '🧪 Turbidity (NTU)', color: '#ef4444' },
            { id: 'ndwi', label: '💧 NDWI (Water Index)', color: '#00f0ff' }
          ].map(metric => (
            <button
              key={metric.id}
              onClick={() => setActiveChartMetric(metric.id)}
              className={`sat-metric-tab ${activeChartMetric === metric.id ? 'active' : ''}`}
            >
              {metric.label}
            </button>
          ))}
        </div>

        {/* Custom Glassmorphism SVG Chart */}
        {historyData.length > 0 ? (
          <div className="sat-chart-wrapper">
            <svg viewBox="0 0 800 240" className="sat-chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="30" x2="780" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
              <line x1="40" y1="90" x2="780" y2="90" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
              <line x1="40" y1="150" x2="780" y2="150" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
              <line x1="40" y1="210" x2="780" y2="210" stroke="rgba(255,255,255,0.15)" />

              {/* Compute chart coordinates */}
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
                    {/* Fill Area */}
                    <path d={areaString} fill="url(#chartGradient)" />

                    {/* Stroke Line */}
                    <path
                      d={pathString}
                      fill="none"
                      stroke="#00f0ff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data Points */}
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

            {/* X-Axis Date Labels */}
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

        {/* Statistical Summary Bar */}
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

      {/* 7. AI Analysis & Health Score Assessment */}
      {observation && (
        <div className="glass-card sat-ai-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="sat-ai-badge">🤖 AI Remote Sensing Engine</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hydrological Health, Flood Dynamics & Environmental Risk Synthesis
            </div>
          </div>

          <div className="sat-ai-grid">
            {/* Health Score Gauge */}
            <div className="sat-ai-score-box">
              <div className="sat-score-circle">
                <svg viewBox="0 0 100 100" width="100" height="100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="8"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (264 * observation.healthScore) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="sat-score-value">
                  {observation.healthScore}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                River Health: <span style={{ color: 'var(--accent-cyan)' }}>{observation.healthScore > 80 ? 'Excellent' : observation.healthScore > 65 ? 'Good' : 'Fair'}</span>
              </div>
            </div>

            {/* AI Status Matrix */}
            <div className="sat-ai-matrix">
              <div className="sat-matrix-item">
                <div className="sat-matrix-label">Water Availability</div>
                <div className="sat-matrix-val" style={{ color: 'var(--accent-teal)' }}>
                  💧 {observation.waterAvailability || 'Stable'}
                </div>
              </div>

              <div className="sat-matrix-item">
                <div className="sat-matrix-label">Flood Warning</div>
                <div className="sat-matrix-val" style={{ color: observation.floodStatus === 'Low' ? 'var(--success-green)' : 'var(--warning-amber)' }}>
                  🛡️ {observation.floodStatus === 'Low' ? 'Low Risk (Normal)' : `${observation.floodStatus} Risk`}
                </div>
              </div>

              <div className="sat-matrix-item">
                <div className="sat-matrix-label">Pollution Risk</div>
                <div className="sat-matrix-val" style={{ color: observation.pollutionRisk === 'Low' ? 'var(--success-green)' : 'var(--warning-amber)' }}>
                  🌱 {observation.pollutionRisk || 'Low'}
                </div>
              </div>

              <div className="sat-matrix-item">
                <div className="sat-matrix-label">Vegetative Riparian Health</div>
                <div className="sat-matrix-val" style={{ color: '#22c55e' }}>
                  🌿 NDVI +{observation.ndvi} (Dense)
                </div>
              </div>
            </div>
          </div>

          {/* AI Synthesis Summary & Recommendation */}
          <div className="sat-ai-text-box">
            <div style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>SATELLITE SYNTHESIS SUMMARY:</strong>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.925rem', marginTop: '0.25rem', lineHeight: '1.6' }}>
                {observation.aiSummary}
              </p>
            </div>

            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <strong style={{ color: 'var(--warning-amber)', fontSize: '0.9rem' }}>RECOMMENDATION:</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {observation.aiRecommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
