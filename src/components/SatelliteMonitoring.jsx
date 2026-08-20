import { useEffect, useRef, useState } from 'react';
import SatelliteHeader from './satellite/SatelliteHeader';
import ObservationBanner from './satellite/ObservationBanner';
import RiverMap from './satellite/RiverMap';
import MetricsGrid from './satellite/MetricsGrid';
import ImageViewer from './satellite/ImageViewer';
import HistoryChart from './satellite/HistoryChart';
import AiInsights from './satellite/AiInsights';

export default function SatelliteMonitoring({ onShowToast, observation, riverData, onObservationChange, onWaterBodyChange, onAreaScanned }) {
  const [statistics, setStatistics] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyPeriod, setHistoryPeriod] = useState('30d');
  const [activeChartMetric, setActiveChartMetric] = useState('waterArea');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);  // starts false — no river selected yet
  const historyRequestRef = useRef(0);

  const loadHistory = async (riverId, period) => {
    const requestId = ++historyRequestRef.current;
    try {
      const res = await fetch(`/api/satellite/history?river=${encodeURIComponent(riverId)}&period=${period}`);
      const data = await res.json();
      if (data.success && requestId === historyRequestRef.current) {
        setHistoryData(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Load statistics whenever the active river changes.
  useEffect(() => {
    if (!riverData?.id) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/satellite/statistics?river=${encodeURIComponent(riverData.id)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && !cancelled) setStatistics(data.statistics);
      })
      .catch(err => console.error('Failed to load statistics:', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [riverData?.id]);

  useEffect(() => {
    if (riverData?.id) loadHistory(riverData.id, historyPeriod);
  }, [historyPeriod, riverData?.id]);

  const handleRefresh = async () => {
    if (isRefreshing || !riverData) return;
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/satellite/refresh?river=${encodeURIComponent(riverData.id)}`, { method: 'POST' });
      const data = await res.json();

      if (data.success && data.observation) {
        onObservationChange?.(data.observation);
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
      <SatelliteHeader
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        hasRiver={!!riverData}
        onRefresh={handleRefresh}
        onSelectRiver={handleSelectRiver}
      />

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

      {observation && <ObservationBanner observation={observation} />}

      {riverData && <RiverMap riverData={riverData} onAreaScanned={onAreaScanned} />}

      {observation && <MetricsGrid observation={observation} />}

      {riverData && <ImageViewer riverData={riverData} observation={observation} onShowToast={onShowToast} />}

      {riverData && (
        <HistoryChart
          riverData={riverData}
          historyData={historyData}
          statistics={statistics}
          historyPeriod={historyPeriod}
          onPeriodChange={setHistoryPeriod}
          activeChartMetric={activeChartMetric}
          onMetricChange={setActiveChartMetric}
        />
      )}

      {observation && <AiInsights observation={observation} />}
    </div>
  );
}