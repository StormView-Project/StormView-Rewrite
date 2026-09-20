import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { X, CloudRain } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import './PrecipDetailModal.css';

function todaysHours(hourly) {
  const todayStr = new Date().toDateString();
  return (hourly ?? []).filter((h) => new Date(h.time).toDateString() === todayStr);
}

/**
 * Hourly precipitation breakdown for today — opened from the "Precip." card
 * in WeatherDetails, since that card only has room for one number (the day's
 * total) and people often want to see how it's distributed through the day.
 */
export function PrecipDetailModal({ data, onClose }) {
  const units = useAppStore((s) => s.units);
  const precipUnit = units === 'imperial' ? 'in' : 'mm';
  const today = data.daily?.[0];
  const hours = todaysHours(data.hourly);

  const hasAmounts = hours.some((h) => h.precipitation != null);
  const totalToday = today?.precipSum != null
    ? today.precipSum
    : (hasAmounts ? hours.reduce((sum, h) => sum + (h.precipitation ?? 0), 0) : null);
  const peakChance = Math.max(0, today?.precipProb ?? 0, ...hours.map((h) => h.precipProb ?? 0));

  return createPortal(
    <div className="precip-modal-overlay" onClick={onClose}>
      <div className="precip-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="precip-modal-header">
          <div className="precip-modal-title">
            <CloudRain size={16} strokeWidth={1.8} style={{ color: '#60A5FA' }} />
            Precipitation Today
          </div>
          <button className="precip-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="precip-modal-summary">
          <div className="precip-modal-stat">
            <div className="precip-modal-stat-value">
              {totalToday != null ? `${totalToday.toFixed(2)} ${precipUnit}` : '—'}
            </div>
            <div className="precip-modal-stat-label">Total Today</div>
          </div>
          <div className="precip-modal-stat">
            <div className="precip-modal-stat-value">{peakChance}%</div>
            <div className="precip-modal-stat-label">Peak Chance</div>
          </div>
        </div>

        {hours.length > 0 ? (
          <div className="precip-modal-bars">
            {hours.map((h, i) => {
              const pct = h.precipProb ?? 0;
              const isPast = new Date(h.time).getTime() < Date.now();
              return (
                <div key={i} className={`precip-modal-col ${isPast ? 'precip-modal-col--past' : ''}`}>
                  <div className="precip-modal-pct">{pct > 0 ? `${pct}%` : ''}</div>
                  <div className="precip-modal-track">
                    <div className="precip-modal-fill" style={{ height: `${pct > 0 ? Math.max(pct, 6) : 0}%` }} />
                  </div>
                  <div className="precip-modal-hour">{format(h.time, 'ha')}</div>
                  {h.precipitation != null && h.precipitation > 0 && (
                    <div className="precip-modal-amount">{h.precipitation}{precipUnit}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="precip-modal-empty">No hourly data available.</div>
        )}
      </div>
    </div>,
    document.body
  );
}
