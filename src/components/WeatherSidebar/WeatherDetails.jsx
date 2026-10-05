import { useState } from 'react';
import {
  Droplets, Wind, Eye, Gauge, Thermometer,
  Sun, Cloud, ArrowUp, Activity,
} from 'lucide-react';
import { PrecipDetailModal } from './PrecipDetailModal';
import useAppStore from '../../store/useAppStore';
import './WeatherDetails.css';

function uvLabel(uv) {
  if (uv == null) return { label: '—', color: 'var(--text-muted)' };
  if (uv <= 2)  return { label: `${uv} Low`,       color: '#4ADE80' };
  if (uv <= 5)  return { label: `${uv} Moderate`,  color: '#FACC15' };
  if (uv <= 7)  return { label: `${uv} High`,       color: '#FB923C' };
  if (uv <= 10) return { label: `${uv} Very High`,  color: '#F87171' };
  return { label: `${uv} Extreme`, color: '#E879F9' };
}

function aqiLabel(aqi) {
  if (aqi == null) return { label: '—', color: 'var(--text-muted)' };
  if (aqi <= 50)  return { label: `${aqi} Good`,       color: '#4ADE80' };
  if (aqi <= 100) return { label: `${aqi} Moderate`,   color: '#FACC15' };
  if (aqi <= 150) return { label: `${aqi} Sensitive`,  color: '#FB923C' };
  if (aqi <= 200) return { label: `${aqi} Unhealthy`,  color: '#F87171' };
  if (aqi <= 300) return { label: `${aqi} Very High`,  color: '#C084FC' };
  return                  { label: `${aqi} Hazardous`, color: '#EF4444' };
}


function windDirLabel(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function WeatherDetails({ data }) {
  const units = useAppStore((s) => s.units);
  const detailsFields = useAppStore((s) => s.detailsFields);
  const [precipModalOpen, setPrecipModalOpen] = useState(false);
  const cu = data.current;
  const aq = data.airQuality ?? {};
  const today = data.daily?.[0];

  const speedUnit = units === 'imperial' ? 'mph' : 'km/h';
  const distUnit  = units === 'imperial' ? 'mi' : 'km';
  const tempUnit  = units === 'imperial' ? '°F' : '°C';
  const uv     = uvLabel(cu.uvIndex);
  const aqi    = aqiLabel(aq.us_aqi);
  const windDir = cu.windDirectionLabel ?? windDirLabel(cu.windDirection);

  const items = [
    {
      key: 'humidity',
      icon: <Droplets size={15} strokeWidth={1.8} />,
      label: 'Humidity',
      value: cu.humidity != null ? `${cu.humidity}%` : '—',
      color: '#60A5FA',
    },
    {
      key: 'wind',
      icon: <Wind size={15} strokeWidth={1.8} />,
      label: 'Wind',
      value: cu.windSpeed != null ? `${windDir} ${cu.windSpeed} ${speedUnit}` : '—',
      sub: cu.windGusts != null ? `Gusts ${cu.windGusts} ${speedUnit}` : null,
      color: '#94A3B8',
    },
    {
      key: 'visibility',
      icon: <Eye size={15} strokeWidth={1.8} />,
      label: 'Visibility',
      value: cu.visibility != null ? `${cu.visibility} ${distUnit}` : '—',
      color: '#A78BFA',
    },
    {
      key: 'pressure',
      icon: <Gauge size={15} strokeWidth={1.8} />,
      label: 'Pressure',
      value: cu.pressure != null ? `${cu.pressure} hPa` : '—',
      color: '#34D399',
    },
    {
      key: 'dewPoint',
      icon: <Thermometer size={15} strokeWidth={1.8} />,
      label: 'Dew Point',
      value: cu.dewPoint != null ? `${cu.dewPoint}${tempUnit}` : '—',
      color: '#6EE7B7',
    },
    {
      key: 'uvIndex',
      icon: <Sun size={15} strokeWidth={1.8} />,
      label: 'UV Index',
      value: uv.label,
      valueColor: uv.color,
      color: '#FBBF24',
    },
    {
      key: 'cloudCover',
      icon: <Cloud size={15} strokeWidth={1.8} />,
      label: 'Cloud Cover',
      value: cu.cloudCover != null ? `${cu.cloudCover}%` : '—',
      color: '#94A3B8',
    },
    {
      key: 'precip',
      icon: <ArrowUp size={15} strokeWidth={1.8} />,
      label: 'Precip. Today',
      // `cu.precipitation` is only the CURRENT HOUR's amount, not a running
      // total — showing it as "today's precip" massively understated actual
      // rainfall (e.g. 0.004in mid-storm). Use the day's accumulated total
      // instead, falling back through what's actually available.
      value: today?.precipSum != null
        ? `${today.precipSum} ${units === 'imperial' ? 'in' : 'mm'}`
        : cu.precipitation != null
          ? `${cu.precipitation} ${units === 'imperial' ? 'in' : 'mm'}`
          : (cu.precipProb != null ? `${cu.precipProb}% chance` : '—'),
      sub: '',
      color: '#60A5FA',
      onClick: () => setPrecipModalOpen(true),
    },
    aq.us_aqi != null ? {
      key: 'aqi',
      icon: <Activity size={15} strokeWidth={1.8} />,
      label: 'Air Quality',
      value: aqi.label,
      valueColor: aqi.color,
      color: '#94A3B8',
      sub: '',
    } : null,
  ]
    .filter(Boolean)
    .filter((i) => detailsFields?.[i.key] !== false)
    .filter((i) => i.value !== '—' || i.label === 'Humidity' || i.label === 'UV Index');

  return (
    <div className="weather-details sidebar-section">
      <div className="sidebar-section-title">Details</div>
      <div className="details-grid">
        {items.map((item) => {
          const Tag = item.onClick ? 'button' : 'div';
          return (
            <Tag
              key={item.label}
              className={`detail-card${item.onClick ? ' detail-card--clickable' : ''}`}
              onClick={item.onClick}
            >
              <div className="detail-icon" style={{ color: item.color }}>{item.icon}</div>
              <div className="detail-info">
                <div className="detail-label">{item.label}</div>
                <div className="detail-value" style={item.valueColor ? { color: item.valueColor } : {}}>
                  {item.value}
                </div>
                {item.sub && <div className="detail-sub">{item.sub}</div>}
              </div>
            </Tag>
          );
        })}
      </div>

      {precipModalOpen && (
        <PrecipDetailModal data={data} onClose={() => setPrecipModalOpen(false)} />
      )}
    </div>
  );
}
