import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { fetchFutureWeatherRange, MAX_FUTURE_DAYS, toISODateLocal } from '../../services/futureWeather';
import { precipTypeInfo } from './FutureWeather';
import { Spinner } from '../ui/Spinner';
import useAppStore from '../../store/useAppStore';
import './widgets.css';

function monthBounds(yearMonthStr) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // day 0 of next month = last day of this month
  return { start: toISODateLocal(start), end: toISODateLocal(end) };
}

function toYearMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Every selectable month from this month through the model's max horizon,
 *  e.g. { value: '2026-12', label: 'December 2026' } — a native <select>
 *  supports type-ahead (press "D" to jump to December), which is what a
 *  native <input type="month"> can't do: that control only accepts picker
 *  clicks or locale-specific numeric entry, never a typed month name. */
function monthOptions(today, maxMonth) {
  const options = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);
  while (cursor <= end) {
    options.push({
      value: toYearMonth(cursor),
      label: cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
}

export function MonthOutlook() {
  const location = useAppStore((s) => s.location);
  const units = useAppStore((s) => s.units);

  const [monthStr, setMonthStr] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error | empty
  const [days, setDays] = useState([]);

  if (!location) return null;

  const today = new Date();
  const maxMonth = new Date(today);
  maxMonth.setDate(maxMonth.getDate() + MAX_FUTURE_DAYS);
  const precipUnit = units === 'imperial' ? 'in' : 'mm';
  const options = monthOptions(today, maxMonth);

  const handleChange = async (e) => {
    const value = e.target.value;
    setMonthStr(value);
    if (!value) {
      setStatus('idle');
      setDays([]);
      return;
    }
    setStatus('loading');
    try {
      const { start, end } = monthBounds(value);
      const result = await fetchFutureWeatherRange(location.lat, location.lon, start, end, units);
      if (!result.length) {
        setStatus('empty');
      } else {
        setDays(result);
        setStatus('ready');
      }
    } catch {
      setStatus('error');
    }
  };

  const firstSnowIndex = days.findIndex((d) => d.precipType === 'snow');

  return (
    <div className="widget-month sidebar-section">
      <div className="sidebar-section-title">Month Outlook</div>
      <p className="widget-future-desc">
        Pick a month to see the long-range outlook for every day in it — high/low,
        precipitation, and precipitation type. A statistical estimate, not a precise forecast.
      </p>

      <label className="widget-future-input-row">
        <CalendarRange size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
        <select
          className="widget-future-select"
          value={monthStr}
          onChange={handleChange}
        >
          <option value="">Select a month…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {status === 'loading' && (
        <div className="widget-future-status"><Spinner size={14} /> Loading month outlook…</div>
      )}
      {status === 'error' && (
        <div className="widget-future-status widget-future-status--error">
          Couldn't load that month.
        </div>
      )}
      {status === 'empty' && (
        <div className="widget-future-status">No outlook data available for that month yet.</div>
      )}

      {status === 'ready' && days.length > 0 && (
        <div className="widget-month-list">
          {days.map((day, i) => {
            const info = precipTypeInfo(day.precipType);
            const Icon = info?.Icon;
            const dateObj = new Date(`${day.date}T00:00:00`);
            const isFirstSnow = i === firstSnowIndex;
            return (
              <div
                key={day.date}
                className={`widget-month-row${isFirstSnow ? ' widget-month-row--flag' : ''}`}
              >
                <div className="widget-month-date">
                  <span className="widget-month-weekday">
                    {dateObj.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span className="widget-month-daynum">{dateObj.getDate()}</span>
                </div>
                <div className="widget-month-hilow">
                  {day.tempMax != null && <span className="widget-month-high">{day.tempMax}°</span>}
                  {day.tempMin != null && <span className="widget-month-low">{day.tempMin}°</span>}
                </div>
                <div className="widget-month-precip">
                  {Icon && <Icon size={14} strokeWidth={1.8} style={{ color: info.color }} />}
                  {day.precipSum != null && day.precipSum > 0 && (
                    <span className="widget-month-precip-amt">{day.precipSum}{precipUnit}</span>
                  )}
                </div>
                {isFirstSnow && <span className="widget-month-flag-label">First snow</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
