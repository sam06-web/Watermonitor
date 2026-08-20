import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom red icon for leaks
const leakIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const contaminationIcon = (severity = 'warning') => L.divIcon({
    className: 'contamination-map-marker',
    html: `<span class="${severity}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
});

const PipeMap = ({ pipes, setPipes, leakagePoints, contaminationPoints = [], clearLeakagePoints }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isErasing, setIsErasing] = useState(false); // New Eraser State
    // Pipes and LeakagePoints props from App.jsx
    const [currentPath, setCurrentPath] = useState([]);


    // Reference to current state for event listeners
    const isErasingRef = useRef(isErasing);
    useEffect(() => {
        isErasingRef.current = isErasing;
    }, [isErasing]);

    // Initialize Map
    useEffect(() => {
        if (mapInstance.current) return;

        const CONVENTION_CENTER_COORDS = [11.064754, 77.093565];
        const map = L.map(mapContainer.current).setView(CONVENTION_CENTER_COORDS, 17);
        mapInstance.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        return () => {
            map.remove();
            mapInstance.current = null;
        };
    }, []);

    // Handle Map Clicks for Drawing
    useEffect(() => {
        if (!mapInstance.current) return;

        const map = mapInstance.current;

        const handleMapClick = (e) => {
            if (isEditing && isDrawing) {
                const { lat, lng } = e.latlng;
                setCurrentPath(prev => [...prev, [lat, lng]]);
            }
        };

        map.on('click', handleMapClick);

        return () => {
            map.off('click', handleMapClick);
        };
    }, [isEditing, isDrawing]);

    // Finish Drawing Logic
    const finishDrawing = () => {
        if (currentPath.length > 1) {
            setPipes(prev => [...prev, currentPath]);
        }
        setCurrentPath([]);
        setIsDrawing(false);
    };

    // Render Layer Updates
    useEffect(() => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;

        // Clear existing vector layers
        map.eachLayer((layer) => {
            // Don't remove the tile layer! Tile layer doesn't have a specific easy check unless we saved ref.
            // Leaflet layers have URLs for tiles.
            if (layer instanceof L.TileLayer) return;
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        // Re-render Pipes
        pipes.forEach((path, index) => {
            const polyline = L.polyline(path, {
                color: isErasing ? '#ff5252' : 'blue', // Visual cue for eraser mode
                weight: 4,
                opacity: 0.7,
                className: isErasing ? 'cursor-pointer' : '' // Optional: add class for cursor
            }).addTo(map);

            // Interaction for Eraser
            polyline.on('click', (e) => {
                if (isErasingRef.current) {
                    L.DomEvent.stopPropagation(e); // Prevent map click
                    setPipes(prevPipes => prevPipes.filter((_, i) => i !== index));
                }
            });

            // Hover effect for eraser
            polyline.on('mouseover', function () {
                if (isErasingRef.current) {
                    this.setStyle({ color: 'red', weight: 6 });
                }
            });
            polyline.on('mouseout', function () {
                if (isErasingRef.current) {
                    this.setStyle({ color: '#ff5252', weight: 4 });
                } else {
                    this.setStyle({ color: 'blue', weight: 4 });
                }
            });
        });

        // Re-render Current Path being drawn
        if (currentPath.length > 0) {
            L.polyline(currentPath, { color: 'orange', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
            const lastPoint = currentPath[currentPath.length - 1];
            L.circleMarker(lastPoint, { radius: 5, color: 'orange' }).addTo(map);
        }

        // Render Leakage Points
        leakagePoints.forEach(leak => {
            L.marker([leak.lat, leak.lng], { icon: leakIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="font-family: sans-serif;">
                        <h3 style="margin: 0 0 5px; color: #d32f2f;">Leakage Alert!</h3>
                        <p style="margin: 0;"><strong>Location:</strong> ${leak.location}</p>
                        <p style="margin: 0;"><strong>Severity:</strong> ${leak.severity}</p>
                        <p style="margin: 0;"><strong>Flow Rate:</strong> ${leak.flowRate}</p>
                        <button style="margin-top: 8px; background: #d32f2f; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Dispatch Team</button>
                    </div>
                `);
        });

        // Quality events are separate from infrastructure leaks so the public can see why a location is flagged.
        contaminationPoints.forEach(point => {
            const marker = L.marker([point.lat, point.lng], { icon: contaminationIcon(point.severity) }).addTo(map);
            marker.bindPopup(`
                <div style="font-family: sans-serif; min-width: 220px;">
                    <h3 style="margin: 0 0 6px; color: #b42318;">Water Quality Alert</h3>
                    <p style="margin: 0 0 4px;"><strong>Location:</strong> ${point.location || 'Monitoring station'}</p>
                    <p style="margin: 0 0 4px;"><strong>Quality index:</strong> ${point.qualityScore ?? '—'} / 100</p>
                    <p style="margin: 0 0 4px;"><strong>Type:</strong> ${point.contaminationType || 'Under analysis'}</p>
                    <p style="margin: 0 0 4px;"><strong>Cause:</strong> ${point.cause || 'Awaiting analysis'}</p>
                    <p style="margin: 0;"><strong>Source:</strong> ${point.source === 'satellite' ? 'Satellite validation' : 'Continuous sensor'}</p>
                </div>
            `);
        });

        if (contaminationPoints.length > 0) {
            const bounds = L.latLngBounds(contaminationPoints.map(point => [point.lat, point.lng]));
            map.fitBounds(bounds.pad(0.5), { maxZoom: 15, animate: true });
            const latestPoint = contaminationPoints[contaminationPoints.length - 1];
            map.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.getLatLng().lat === Number(latestPoint.lat) && layer.getLatLng().lng === Number(latestPoint.lng)) {
                    layer.openPopup();
                }
            });
        }

    }, [pipes, currentPath, leakagePoints, contaminationPoints, isErasing]); // Re-render when isErasing changes to update styles


    return (
        <div className="card" style={{ height: 'calc(100vh - 120px)', padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%', cursor: isDrawing ? 'crosshair' : (isErasing ? 'not-allowed' : 'grab') }} />

            {/* Editor Controls */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '60px', // Shift right to avoid zoom controls
                zIndex: 1000,
                display: 'flex',
                gap: '8px'
            }}>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        style={{
                            padding: '8px 16px',
                            background: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            color: '#333'
                        }}
                    >
                        ⚙️ Setup Mode
                    </button>
                ) : (
                    <>
                        {/* Draw Button */}
                        <button
                            onClick={() => {
                                setIsDrawing(true);
                                setIsErasing(false);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: isDrawing ? '#e3f2fd' : 'white',
                                border: isDrawing ? '2px solid #2196f3' : 'none',
                                borderRadius: '4px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: isDrawing ? '#2196f3' : '#333'
                            }}
                        >
                            ✏️ Draw
                        </button>

                        {/* Eraser Button */}
                        <button
                            onClick={() => {
                                setIsErasing(true);
                                setIsDrawing(false);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: isErasing ? '#ffebee' : 'white',
                                border: isErasing ? '2px solid #f44336' : 'none',
                                borderRadius: '4px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: isErasing ? '#f44336' : '#333'
                            }}
                        >
                            🗑️ Eraser
                        </button>

                        {/* Clear Leaks Button */}
                        <button
                            onClick={clearLeakagePoints}
                            style={{
                                padding: '8px 16px',
                                background: 'white',
                                border: '1px solid #d32f2f',
                                borderRadius: '4px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: '#d32f2f'
                            }}
                        >
                            ⚠️ Clear Leaks
                        </button>

                        {isDrawing && currentPath.length > 0 && (
                            <button
                                onClick={finishDrawing}
                                style={{
                                    padding: '8px 16px',
                                    background: '#4caf50',
                                    border: 'none',
                                    borderRadius: '4px',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    color: 'white'
                                }}
                            >
                                ✓ Finish Line
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setIsDrawing(false);
                                setIsErasing(false);
                                setCurrentPath([]);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: '#757575',
                                border: 'none',
                                borderRadius: '4px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: 'white'
                            }}
                        >
                            Exit
                        </button>
                    </>
                )}
            </div>

            {/* Overlay Legend */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                zIndex: 1000
            }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#333' }}>Legend</h4>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '20px', height: '4px', background: 'blue', marginRight: '8px' }}></div>
                    <span style={{ fontSize: '12px', color: '#555' }}>Water Pipeline</span>
                </div>
                {isDrawing && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ width: '20px', height: '4px', background: 'orange', borderBottom: '1px dashed orange', marginRight: '8px' }}></div>
                        <span style={{ fontSize: '12px', color: '#555' }}>New Connection</span>
                    </div>
                )}
                {isErasing && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold' }}>!! Click pipe to remove !!</span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style={{ width: '12px', height: '20px', marginRight: '12px', marginLeft: '4px' }} alt="marker" />
                    <span style={{ fontSize: '12px', color: '#555' }}>Leakage Point</span>
                </div>
            </div>
        </div>
    );
};

export default PipeMap;
