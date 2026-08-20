import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function buildBoxGeoJSON(a, b) {
  const w = Math.min(a.lng, b.lng);
  const e = Math.max(a.lng, b.lng);
  const s = Math.min(a.lat, b.lat);
  const n = Math.max(a.lat, b.lat);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [w, s], [e, s], [e, n], [w, n], [w, s]
      ]]
    }
  };
}

export default function RiverMap({ riverData, onAreaScanned }) {
  const [mapLayer, setMapLayer] = useState('satellite');
  const [scanMode, setScanMode] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanName, setScanName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const scanModeRef = useRef(false);
  const drawRef = useRef(null);

  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

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
            maxzoom: 19,
            layout: { visibility: 'visible' }
          },
          {
            id: 'dark-base',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: 'none' }
          }
        ]
      },
      center: [78.583, 11.137],
      zoom: 7.5,
      pitch: 25,
      bearing: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '' }), 'bottom-right');

    map.on('mousedown', (e) => {
      if (!scanModeRef.current || e.originalEvent.button !== 0) return;
      drawRef.current = {
        start: { lng: e.lngLat.lng, lat: e.lngLat.lat },
        current: { lng: e.lngLat.lng, lat: e.lngLat.lat }
      };
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
    });

    map.on('mousemove', (e) => {
      if (!scanModeRef.current || !drawRef.current?.start) return;
      drawRef.current.current = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const src = map.getSource('scan-box');
      if (src) src.setData(buildBoxGeoJSON(drawRef.current.start, drawRef.current.current));
    });

    map.on('mouseup', () => {
      if (!scanModeRef.current || !drawRef.current?.start) return;
      const d = drawRef.current;
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
      drawRef.current = null;

      const w = Math.min(d.start.lng, d.current.lng);
      const e = Math.max(d.start.lng, d.current.lng);
      const s = Math.min(d.start.lat, d.current.lat);
      const n = Math.max(d.start.lat, d.current.lat);
      if (Math.abs(e - w) < 0.0005 || Math.abs(n - s) < 0.0005) {
        const src = map.getSource('scan-box');
        if (src) src.setData({ type: 'FeatureCollection', features: [] });
        setScanPreview(null);
        return;
      }
      setScanPreview({ bbox: [w, s, e, n] });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const applyMapLayerMode = (mode) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const isNdwi = mode === 'ndwi';
    map.setLayoutProperty('satellite-base', 'visibility', isNdwi ? 'none' : 'visible');
    map.setLayoutProperty('dark-base', 'visibility', isNdwi ? 'visible' : 'none');

    map.setPaintProperty('river-glow', 'line-color', isNdwi ? '#00f0ff' : '#38bdf8');
    map.setPaintProperty('river-glow', 'line-width', isNdwi ? 18 : 14);
    map.setPaintProperty('river-glow', 'line-opacity', isNdwi ? 0.75 : 0.4);

    map.setPaintProperty('river-core', 'line-color', isNdwi ? '#7dd3fc' : '#38bdf8');
    map.setPaintProperty('river-core', 'line-width', isNdwi ? 8 : 6);

    map.setPaintProperty('river-pulse', 'line-color', isNdwi ? '#f0f9ff' : '#ffffff');
    map.setPaintProperty('river-pulse', 'line-width', isNdwi ? 3 : 2);
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !riverData) return;

    const onMapLoaded = () => {
      map.resize();

      if (!map.getSource('scan-box')) {
        map.addSource('scan-box', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'scan-box-fill',
          type: 'fill',
          source: 'scan-box',
          paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.18 }
        });
        map.addLayer({
          id: 'scan-box-line',
          type: 'line',
          source: 'scan-box',
          paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [4, 3] }
        });
      }

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

        map.addLayer({
          id: 'river-glow',
          type: 'line',
          source: 'river-vector',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00f0ff', 'line-width': 14, 'line-opacity': 0.4, 'line-blur': 4 }
        });

        map.addLayer({
          id: 'river-core',
          type: 'line',
          source: 'river-vector',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#38bdf8', 'line-width': 6, 'line-opacity': 0.95 }
        });

        map.addLayer({
          id: 'river-pulse',
          type: 'line',
          source: 'river-vector',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [3, 3], 'line-opacity': 0.8 }
        });
      }

      const bbox = Array.isArray(riverData.bbox) ? riverData.bbox.map(Number) : [];
      const hasValidBounds = bbox.length === 4 && bbox.every(Number.isFinite) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
      const latitude = Number(riverData.latitude);
      const longitude = Number(riverData.longitude);

      requestAnimationFrame(() => {
        if (hasValidBounds) {
          map.fitBounds(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            {
              padding: { top: 80, bottom: 80, left: 80, right: 80 },
              maxZoom: 13,
              duration: 1800,
              pitch: 35
            }
          );
        } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          map.flyTo({ center: [longitude, latitude], zoom: 11, duration: 1800, pitch: 35 });
        }
      });
    };

    if (map.isStyleLoaded()) {
      onMapLoaded();
    } else {
      map.once('load', onMapLoaded);
    }
  }, [riverData]);

  const handleLayerToggle = (mode) => {
    setMapLayer(mode);
    applyMapLayerMode(mode);
  };

  const clearScanBox = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const src = map.getSource('scan-box');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  };

  const toggleScanMode = () => {
    const next = !scanMode;
    setScanMode(next);
    setScanPreview(null);
    setScanName('');
    setIsScanning(false);
    if (!next) {
      clearScanBox();
      const map = mapInstanceRef.current;
      if (map) {
        map.dragPan.enable();
        map.getCanvas().style.cursor = '';
      }
    }
  };

  const cancelScan = () => {
    clearScanBox();
    setScanPreview(null);
    setScanName('');
    setScanMode(false);
    const map = mapInstanceRef.current;
    if (map) {
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
    }
  };

  const confirmScan = async () => {
    if (!scanPreview || isScanning) return;
    const [w, s, e, n] = scanPreview.bbox;
    setIsScanning(true);
    try {
      const res = await fetch('/api/satellite/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: scanPreview.bbox,
          lat: (s + n) / 2,
          lng: (w + e) / 2,
          name: scanName.trim() || 'Scanned Area'
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Scan failed');
      }
      await onAreaScanned?.(data.river, data.observation);
      const map = mapInstanceRef.current;
      if (map) {
        map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 12, duration: 1000 });
      }
      clearScanBox();
      setScanPreview(null);
      setScanName('');
      setScanMode(false);
    } catch (err) {
      console.error('Area scan error:', err);
      alert(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
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

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`sat-map-btn ${scanMode ? 'active' : ''}`}
            onClick={toggleScanMode}
            title="Drag a rectangle on the map to run a real Sentinel-2 scan over that area"
          >
            🎯 Scan Area
          </button>
          <button
            className={`sat-map-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
            onClick={() => handleLayerToggle('satellite')}
          >
            🛰️ High-Res Satellite
          </button>
          <button
            className={`sat-map-btn ${mapLayer === 'ndwi' ? 'active' : ''}`}
            onClick={() => handleLayerToggle('ndwi')}
          >
            🌊 Water Mask (NDWI)
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '420px', background: '#0b1120' }} />

        {scanMode && !scanPreview && (
          <div className="glass" style={{
            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
            padding: '6px 12px', borderRadius: '999px', fontSize: '0.78rem',
            color: 'var(--text-secondary)', pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          }}>
            Drag on the map to draw a rectangle, then release to scan that area
          </div>
        )}

        {scanPreview && (
          <div className="glass" style={{
            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '8px 12px',
            borderRadius: '12px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)', zIndex: 5
          }}>
            <input
              value={scanName}
              onChange={e => setScanName(e.target.value)}
              placeholder="Name this area (optional)"
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 10px',
                fontSize: '0.8rem', width: '180px'
              }}
            />
            <button
              className="sat-map-btn active"
              onClick={confirmScan}
              disabled={isScanning}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isScanning ? 'Scanning…' : '✓ Scan area'}
            </button>
            <button className="sat-map-btn" onClick={cancelScan} disabled={isScanning} style={{ whiteSpace: 'nowrap' }}>
              ✕ Cancel
            </button>
          </div>
        )}
      </div>

      <div className="sat-map-legend glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{ width: '16px', height: '4px', background: '#00f0ff', borderRadius: '2px', boxShadow: '0 0 8px #00f0ff' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Delineated River Reach</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '4px', background: '#38bdf8', borderRadius: '2px' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Primary Water Flow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <div style={{ width: '16px', height: '4px', background: '#22d3ee', borderRadius: '2px', border: '1px dashed rgba(255,255,255,0.6)' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scanned Area</span>
        </div>
      </div>
    </div>
  );
}