import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getApiUrl } from '../../utils/api';

/* ─── helpers ─────────────────────────────────────────────────── */

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
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
    }
  };
}

function parseBbox(raw) {
  if (!raw) return null;
  let box = raw;
  if (typeof raw === 'string') {
    try { box = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(box) || box.length < 4) return null;
  const nums = box.slice(0, 4).map(Number);
  if (!nums.every(Number.isFinite)) return null;
  if (nums[0] >= nums[2] || nums[1] >= nums[3]) return null;
  return nums; // [west, south, east, north]
}

function parseGeometry(raw, lat, lng) {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  if (raw && typeof raw === 'object' && raw.type) return raw;
  const nLat = Number(lat), nLng = Number(lng);
  if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
    return { type: 'Point', coordinates: [nLng, nLat] };
  }
  return null;
}

/* ─── component ────────────────────────────────────────────────── */

export default function RiverMap({ riverData, onAreaScanned, onShowToast }) {
  const [mapLayer, setMapLayer]     = useState('satellite');
  const [scanMode, setScanMode]     = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanName, setScanName]     = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);   // the live MapLibre instance
  const scanModeRef     = useRef(false);
  const drawRef         = useRef(null);
  const markerRef       = useRef(null);   // point-marker for single-coord rivers
  const riverDataRef    = useRef(null);   // latest riverData for closures

  // keep ref in sync every render
  riverDataRef.current = riverData;

  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  /* ── initialise map once ─────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-sat': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri, Maxar'
          },
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© CARTO'
          }
        },
        layers: [
          { id: 'satellite-base', type: 'raster', source: 'esri-sat',    layout: { visibility: 'visible' } },
          { id: 'dark-base',      type: 'raster', source: 'carto-dark',  layout: { visibility: 'none'    } }
        ]
      },
      center: [78.0, 20.0],
      zoom: 4,
      pitch: 20,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    /* draw-rectangle for scan */
    map.on('mousedown', (e) => {
      if (!scanModeRef.current || e.originalEvent.button !== 0) return;
      drawRef.current = {
        start:   { lng: e.lngLat.lng, lat: e.lngLat.lat },
        current: { lng: e.lngLat.lng, lat: e.lngLat.lat }
      };
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
    });
    map.on('mousemove', (e) => {
      if (!scanModeRef.current || !drawRef.current?.start) return;
      drawRef.current.current = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      map.getSource('scan-box')?.setData(buildBoxGeoJSON(drawRef.current.start, drawRef.current.current));
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
        map.getSource('scan-box')?.setData({ type: 'FeatureCollection', features: [] });
        setScanPreview(null);
        return;
      }
      setScanPreview({ bbox: [w, s, e, n] });
    });

    /* once style loads, add sources & layers then fly to current river */
    map.on('load', () => {
      /* scan-box */
      map.addSource('scan-box', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'scan-box-fill', type: 'fill', source: 'scan-box', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'scan-box-line', type: 'line', source: 'scan-box', paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [4, 3] } });

      /* river vector – seeded with empty collection; updated on data change */
      map.addSource('river-vector', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'river-glow', type: 'line', source: 'river-vector', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#00f0ff', 'line-width': 14, 'line-opacity': 0.4, 'line-blur': 4 } });
      map.addLayer({ id: 'river-core', type: 'line', source: 'river-vector', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#38bdf8', 'line-width': 6, 'line-opacity': 0.95 } });
      map.addLayer({ id: 'river-pulse', type: 'line', source: 'river-vector', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [3, 3], 'line-opacity': 0.8 } });

      // if river is already set, navigate to it
      if (riverDataRef.current) {
        updateRiverOnMap(map, riverDataRef.current);
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helper: update river layer & camera ────────────────────── */
  const updateRiverOnMap = useCallback((map, data) => {
    if (!map || !data) return;

    // Remove old point marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const geom = parseGeometry(data.geometry, data.latitude, data.longitude);
    const bbox = parseBbox(data.bbox);
    const lat  = Number(data.latitude);
    const lng  = Number(data.longitude);

    // Update vector source
    const src = map.getSource('river-vector');
    if (src) {
      src.setData({
        type: 'Feature',
        geometry: geom || { type: 'Point', coordinates: [lng || 0, lat || 0] },
        properties: { name: data.name || '', basin: data.basin || '' }
      });
    }

    // For point-only rivers (no LineString), add a marker so the user can see where it is
    if (geom?.type === 'Point' && Number.isFinite(lat) && Number.isFinite(lng)) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: #00f0ff; border: 3px solid white;
        box-shadow: 0 0 12px #00f0ff, 0 0 24px rgba(0,240,255,0.5);
        cursor: pointer;
      `;
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(
          `<div style="color:#0f172a;font-weight:700;font-size:0.9rem">${data.name || 'Water Body'}</div>
           <div style="color:#475569;font-size:0.8rem">${data.state || data.country || ''}</div>`
        ))
        .addTo(map);
    }

    // Navigate camera
    if (bbox) {
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 13,
        duration: 1400,
        pitch: 30
      });
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo({ center: [lng, lat], zoom: 11, duration: 1400, pitch: 30, essential: true });
    }
  }, []);

  /* ── react to riverData prop changes ─────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!riverData) return;

    if (map && map.isStyleLoaded()) {
      updateRiverOnMap(map, riverData);
    }
    // if map isn't ready yet, the 'load' handler above will pick it up via riverDataRef
  }, [riverData, updateRiverOnMap]);

  /* ── layer toggle ────────────────────────────────────────────── */
  const applyMapLayerMode = useCallback((mode) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const isNdwi = mode === 'ndwi';
    map.setLayoutProperty('satellite-base', 'visibility', isNdwi ? 'none'    : 'visible');
    map.setLayoutProperty('dark-base',      'visibility', isNdwi ? 'visible' : 'none');

    // only set paint props if the layer already exists
    if (map.getLayer('river-glow')) {
      map.setPaintProperty('river-glow', 'line-color',   isNdwi ? '#00f0ff' : '#38bdf8');
      map.setPaintProperty('river-glow', 'line-width',   isNdwi ? 18 : 14);
      map.setPaintProperty('river-glow', 'line-opacity', isNdwi ? 0.75 : 0.4);
    }
    if (map.getLayer('river-core')) {
      map.setPaintProperty('river-core', 'line-color', isNdwi ? '#7dd3fc' : '#38bdf8');
      map.setPaintProperty('river-core', 'line-width', isNdwi ? 8 : 6);
    }
    if (map.getLayer('river-pulse')) {
      map.setPaintProperty('river-pulse', 'line-color', isNdwi ? '#f0f9ff' : '#ffffff');
      map.setPaintProperty('river-pulse', 'line-width', isNdwi ? 3 : 2);
    }
  }, []);

  const handleLayerToggle = (mode) => {
    setMapLayer(mode);
    applyMapLayerMode(mode);
  };

  /* ── scan helpers ─────────────────────────────────────────────── */
  const clearScanBox = () => {
    mapRef.current?.getSource('scan-box')?.setData({ type: 'FeatureCollection', features: [] });
  };

  const toggleScanMode = () => {
    const next = !scanMode;
    setScanMode(next);
    setScanPreview(null);
    setScanName('');
    setIsScanning(false);
    if (!next) {
      clearScanBox();
      const map = mapRef.current;
      if (map) { map.dragPan.enable(); map.getCanvas().style.cursor = ''; }
    }
  };

  const cancelScan = () => {
    clearScanBox();
    setScanPreview(null);
    setScanName('');
    setScanMode(false);
    const map = mapRef.current;
    if (map) { map.dragPan.enable(); map.getCanvas().style.cursor = ''; }
  };

  const confirmScan = async () => {
    if (!scanPreview || isScanning) return;
    const [w, s, e, n] = scanPreview.bbox;
    setIsScanning(true);
    try {
      const res  = await fetch(getApiUrl('/api/satellite/scan'), {
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
      if (!data.success) throw new Error(data.error || 'Scan failed');
      await onAreaScanned?.(data.river, data.observation);
      mapRef.current?.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 12, duration: 1000 });
      clearScanBox(); setScanPreview(null); setScanName(''); setScanMode(false);
    } catch (err) {
      console.error('Area scan error:', err);
      if (onShowToast) {
        onShowToast({ title: 'Scan Failed', message: err.message, type: 'error' });
      } else {
        alert(`Scan failed: ${err.message}`);
      }
    } finally {
      setIsScanning(false);
    }
  };

  /* ─── render ─────────────────────────────────────────────────── */
  return (
    <div className="sat-map-container-card glass-card" style={{ marginBottom: '2rem', padding: '0', overflow: 'hidden' }}>
      <div className="sat-map-header" style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🗺️</span>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: '700' }}>
              {riverData?.name ? `${riverData.name} — Dynamic Satellite Map` : 'Dynamic Satellite Map'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              MapLibre GL • Vector Reach Highlighting • Multi-Layer Toggle
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            className={`btn sat-map-action-btn ${scanMode ? 'btn-primary active' : ''}`}
            onClick={toggleScanMode}
            title="Drag a rectangle on the map to run a real Sentinel-2 scan over that area"
          >
            🎯 Scan Area
          </button>
          <button
            className={`btn sat-map-action-btn ${mapLayer === 'satellite' ? 'btn-primary active' : ''}`}
            onClick={() => handleLayerToggle('satellite')}
          >
            🛰️ High-Res Satellite
          </button>
          <button
            className={`btn sat-map-action-btn ${mapLayer === 'ndwi' ? 'btn-primary active' : ''}`}
            onClick={() => handleLayerToggle('ndwi')}
          >
            🌊 Water Mask (NDWI)
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '480px', background: '#0b1120' }} />

        {scanMode && !scanPreview && (
          <div className="glass" style={{
            position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)',
            padding: '8px 16px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600',
            color: 'var(--text-primary)', pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)'
          }}>
            Drag on the map to draw a rectangle, then release to scan that area
          </div>
        )}

        {scanPreview && (
          <div className="glass" style={{
            position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '10px 16px',
            borderRadius: '14px', boxShadow: '0 8px 28px rgba(0,0,0,0.6)', zIndex: 15
          }}>
            <input
              value={scanName}
              onChange={e => setScanName(e.target.value)}
              placeholder="Name this area (optional)"
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', borderRadius: '10px', padding: '8px 12px',
                fontSize: '0.85rem', width: '200px'
              }}
            />
            <button className="sat-map-btn active" onClick={confirmScan} disabled={isScanning} style={{ whiteSpace: 'nowrap' }}>
              {isScanning ? 'Scanning…' : '✓ Scan area'}
            </button>
            <button className="sat-map-btn" onClick={cancelScan} disabled={isScanning} style={{ whiteSpace: 'nowrap' }}>
              ✕ Cancel
            </button>
          </div>
        )}

        <div className="sat-map-legend glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '18px', height: '5px', background: '#00f0ff', borderRadius: '3px', boxShadow: '0 0 8px #00f0ff' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Delineated River Reach</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '18px', height: '5px', background: '#38bdf8', borderRadius: '3px' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Primary Water Flow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '18px', height: '5px', background: '#22d3ee', borderRadius: '3px', border: '1px dashed rgba(255,255,255,0.8)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Scanned Area</span>
          </div>
        </div>
      </div>
    </div>
  );
}