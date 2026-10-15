import { useState } from 'react';
import { CalendarSearch, CloudRain, CloudDrizzle, CloudSnow, Cloud } from 'lucide-react';
import { fetchFutureWeather, MIN_FUTURE_DAYS, MAX_FUTURE_DAYS, toISODateLocal } from '../../services/futureWeather';
import { Spinner } from '../ui/Spinner';
import useAppStore from '../../store/useAppStore';
import './widgets.css';

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function precipTypeInfo(type) {
  switch (type) {
    case 'snow':    return { label: 'Snow', Icon: CloudSnow, color: '#93C5FD' };
    case 'showers': return { label: 'Showers', Icon: CloudDrizzle, color: '#60A5FA' };
    case 'rain':    return { label: 'Rain', Icon: CloudRain, color: '#60A5FA' };
    case 'none':    return { label: 'Dry', Icon: Cloud, color: 'var(--text-muted)' };
    default:        return null; // no breakdown data available for this date
  }
}

export function FutureWeather() {
  const location = useAppStore((s) => s.location);
  const units = useAppStore((s) => s.units);

  const [dateStr, setDateStr] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error | empty
  const [result, setResult] = useState(null);

  if (!location) return null;

  const minDate = addDays(new Date(), MIN_FUTURE_DAYS);
  const maxDate = addDays(new Date(), MAX_FUTURE_DAYS);
  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const speedUnit = units === 'imperial' ? 'mph' : 'km/h';
  const precipUnit = units === 'imperial' ? 'in' : 'mm';

  const handleChange = async (e) => {
    const value = e.target.value;
    setDateStr(value);
    if (!value) {
      setStatus('idle');
      setResult(null);
      return;
    }
    setStatus('loading');
    try {
      const data = await fetchFutureWeather(location.lat, location.lon, value, units);
      if (!data) {
        setStatus('empty');
      } else {
        setResult(data);
        setStatus('ready');
      }
    } catch {
      setStatus('error');
    }
  };

  const precipInfo = result ? precipTypeInfo(result.precipType) : null;

  return (
    <div className="widget-future sidebar-section">
      <div className="sidebar-section-title">Future Weather</div>
      <p className="widget-future-desc">
        Pick a date, and see the weather for that date.
      </p>

      <label className="widget-future-input-row">
        <CalendarSearch size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
        <input
          type="date"
          className="widget-future-input"
          value={dateStr}
          min={toISODateLocal(minDate)}
          max={toISODateLocal(maxDate)}
          onChange={handleChange}
        />
      </label>

      {status === 'loading' && (
        <div className="widget-future-status">
          <Spinner size={14} /> Loading outlook…
        </div>
      )}
      {status === 'error' && (
        <div className="widget-future-status widget-future-status--error">
          Couldn't load a forecast for that date.
        </div>
      )}
      {status === 'empty' && (
        <div className="widget-future-status">
          No outlook data available for that date yet.
        </div>
      )}

      {status === 'ready' && result && (
        <div className="widget-future-result">
          <div className="widget-future-hilow-row">
            <div className="widget-future-hilow">
              {result.tempMax != null && <span className="widget-future-high">H {result.tempMax}{tempUnit}</span>}
              {result.tempMin != null && <span className="widget-future-low">L {result.tempMin}{tempUnit}</span>}
            </div>
            {precipInfo && (
              <div className="widget-future-preciptype" style={{ color: precipInfo.color }}>
                <precipInfo.Icon size={16} strokeWidth={1.8} />
                {precipInfo.label}
              </div>
            )}
          </div>
          <div className="widget-future-grid">
            {result.precipSum != null && (
              <div className="widget-future-stat">
                <span>Precip.</span>
                <strong>{result.precipSum} {precipUnit}</strong>
              </div>
            )}
            {result.windSpeedMax != null && (
              <div className="widget-future-stat">
                <span>Wind</span>
                <strong>{result.windSpeedMax} {speedUnit}</strong>
              </div>
            )}
            {result.humidityMean != null && (
              <div className="widget-future-stat">
                <span>Humidity</span>
                <strong>{result.humidityMean}%</strong>
              </div>
            )}
            {result.cloudCoverMean != null && (
              <div className="widget-future-stat">
                <span>Cloud Cover</span>
                <strong>{result.cloudCoverMean}%</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
