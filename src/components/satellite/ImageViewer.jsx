import { useRef, useState } from 'react';

const SPECTRUM_MODES = [
  { id: 'rgb', label: 'True Color (RGB)', desc: 'Bands 4, 3, 2 - Natural View' },
  { id: 'false_color', label: 'False Color (NIR)', desc: 'Bands 8, 4, 3 - Vegetation Health' },
  { id: 'ndwi', label: 'NDWI Water Mask', desc: 'Bands 3, 8 - Water Delineation' },
  { id: 'moisture', label: 'Moisture Index (NDMI)', desc: 'Bands 8, 11 - Soil Wetness' }
];

export default function ImageViewer({ riverData, observation, onShowToast }) {
  const [spectrumMode, setSpectrumMode] = useState('rgb');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const compareContainerRef = useRef(null);

  const getImageUrl = (type, date, variant = 'latest') => {
    const riverId = riverData?.id;
    if (!riverId) return '';
    const imageDate = date || observation?.imageDate || '';
    const scene = observation?.id || imageDate || 'current';
    return `/api/satellite/image?river=${encodeURIComponent(riverId)}&type=${encodeURIComponent(type)}&date=${encodeURIComponent(imageDate)}&scene=${encodeURIComponent(`${scene}-${variant}`)}`;
  };

  const getPreviousImageDate = () => {
    if (!observation?.imageDate) return '';
    const previousDate = new Date(observation.imageDate);
    previousDate.setDate(previousDate.getDate() - 15);
    return previousDate.toISOString().split('T')[0];
  };

  const handleSliderMove = (e) => {
    if (!compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (!clientX) return;

    const pos = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(pos);
  };

  const handleDownloadImage = () => {
    if (!riverData || !observation) return;
    const imageUrl = getImageUrl(spectrumMode, observation.imageDate);

    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AquaSense_${riverData.id}_${spectrumMode}_${observation.imageDate}.png`;
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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

          <button
            className="sat-tool-btn"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title="Fullscreen View"
          >
            ⛶
          </button>

          <button
            className="btn btn-primary"
            onClick={handleDownloadImage}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            ⬇ Download Image
          </button>
        </div>
      </div>

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
          <div className="sat-image-wrapper" style={{ transform: `scale(${viewerZoom})` }}>
            <img
              key={`${riverData?.id}-${observation?.id}-${spectrumMode}`}
              src={getImageUrl(spectrumMode, observation?.imageDate)}
              alt={`${riverData?.name} Satellite Observation`}
              className="sat-image-render"
            />
          </div>
        ) : (
          <div className="sat-compare-viewport" style={{ transform: `scale(${viewerZoom})` }}>
            <img
              key={`${riverData?.id}-${observation?.id}-latest`}
              src={getImageUrl('rgb', observation?.imageDate, 'latest')}
              alt="Latest Satellite Observation"
              className="sat-compare-img sat-compare-after"
            />
            <div className="sat-compare-badge after">
              LATEST PASS ({observation?.imageDate})
            </div>

            <div className="sat-compare-overlay" style={{ width: `${sliderPosition}%` }}>
              <img
                key={`${riverData?.id}-${observation?.id}-previous`}
                src={getImageUrl('rgb', getPreviousImageDate(), 'previous')}
                alt="Previous Satellite Observation"
                className="sat-compare-img sat-compare-before"
              />
              <div className="sat-compare-badge before">
                PREVIOUS PASS (15 Days Prior)
              </div>
            </div>

            <div className="sat-compare-handle" style={{ left: `${sliderPosition}%` }}>
              <div className="sat-compare-handle-line"></div>
              <div className="sat-compare-handle-button">⇄</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}