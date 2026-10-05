import { AlertCircle, MapPin } from 'lucide-react';
import { CurrentConditions } from './CurrentConditions';
import { WIDGET_REGISTRY } from '../widgets/registry';
import { useOrderedWidgets } from '../../hooks/useOrderedWidgets';
import useAppStore from '../../store/useAppStore';

function SkeletonLoading() {
  return (
    <div style={{ padding: '16px' }}>
      <div className="skeleton skel-lg" style={{ marginBottom: 12 }} />
      <div className="skeleton skel-line" />
      <div className="skeleton skel-line skel-sm" />
      <div style={{ marginTop: 24 }}>
        <div className="skeleton skel-line" style={{ width: '30%', marginBottom: 12 }} />
        <div className="skeleton skel-lg" />
      </div>
    </div>
  );
}

/**
 * Shared scrollable weather body used by both WeatherSidebar (desktop)
 * and WeatherBottomSheet (mobile).
 */
export function WeatherContent({ weatherData, loading, error, onOpenSettings }) {
  const orderedWidgets = useOrderedWidgets();

  if (loading && !weatherData) return <SkeletonLoading />;

  if (error && !weatherData) {
    return (
      <div className="sidebar-error">
        <AlertCircle size={28} className="sidebar-error-icon" />
        <span>{error}</span>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="sidebar-error">
        <MapPin size={28} style={{ color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Set a location to see weather</span>
        <button
          onClick={onOpenSettings}
          style={{
            marginTop: 8, padding: '8px 16px',
            background: 'var(--accent)', color: 'var(--on-accent, #fff)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <>
      {error && <div className="sidebar-notice">{error}</div>}
      <CurrentConditions data={weatherData} />
      {orderedWidgets.map((id) => {
        const { Component, alertsProp } = WIDGET_REGISTRY[id];
        return alertsProp
          ? <Component key={id} alerts={weatherData.alerts} />
          : <Component key={id} data={weatherData} />;
      })}
    </>
  );
}
