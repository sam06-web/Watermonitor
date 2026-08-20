import { useEffect, useState } from 'react';
import SatelliteHeader from './satellite/SatelliteHeader';
import RiverMap from './satellite/RiverMap';
import MetricsGrid from './satellite/MetricsGrid';
import ImageViewer from './satellite/ImageViewer';
import AiInsights from './satellite/AiInsights';

export default function SatelliteMonitoring({ onShowToast, observation, riverData, onObservationChange, onWaterBodyChange, onAreaScanned }) {
  const handleSelectRiver = (river) => {
    onWaterBodyChange?.(river.id);
    if (onShowToast) {
      onShowToast({
        title: 'Satellite Scene Loaded',
        message: `Loading latest observation for ${river.name}`,
        type: 'info'
      });
    }
  };

  return (
    <div className="satellite-monitoring-container">
      <SatelliteHeader onSelectRiver={handleSelectRiver} />

      {/* Empty state — shown until user searches and selects a water body */}
      {!riverData && !observation && (
        <div className="glass-card" style={{
          margin: '0 0 1.5rem',
          padding: '3rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5" opacity="0.6">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Search for a water body to begin
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Type any river, lake, or reservoir name above — global coverage via Sentinel-2 satellite imagery.
            </p>
          </div>
        </div>
      )}

      {riverData && <RiverMap riverData={riverData} onAreaScanned={onAreaScanned} />}

      {observation && <MetricsGrid observation={observation} />}

      {riverData && <ImageViewer riverData={riverData} observation={observation} onShowToast={onShowToast} />}

      {observation && <AiInsights observation={observation} />}
    </div>
  );
}
