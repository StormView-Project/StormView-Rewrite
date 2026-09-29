/**
 * Open-Meteo's Seasonal Forecast API — long-range daily outlooks beyond the
 * normal ~16-day forecast (the SEAS5 ensemble model extends to roughly 7
 * months out). Unlike the main forecast API, this has no weather-code/icon
 * field and no precipitation-probability field — it's a statistical outlook
 * (an ensemble mean across ~50 model runs), not a precise day-level forecast,
 * and gets less reliable the further out you go.
 *
 * https://open-meteo.com/en/docs/seasonal-forecast-api
 */

const BASE = 'https://seasonal-api.open-meteo.com/v1/seasonal';

/**
 * Formats a Date as "YYYY-MM-DD" using its LOCAL calendar fields —
 * `d.toISOString().slice(0, 10)` goes through UTC first, which silently
 * shifts the date by a day for anyone in a positive UTC-offset timezone
 * (same bug class already fixed for daily forecast dates in openmeteo.js).
 */
export function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'rain_sum',
  'showers_sum',
  'snowfall_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'relative_humidity_2m_mean',
  'cloud_cover_mean',
].join(',');

/** How far beyond today the seasonal model realistically extends. */
export const MAX_FUTURE_DAYS = 210; // ~7 months
/** Below this, the normal Daily Forecast section is already more accurate. */
export const MIN_FUTURE_DAYS = 17;

const round = (n) => (n == null ? null : Math.round(n));

/** 'rain' | 'showers' | 'snow' | 'none' | null (unknown — no breakdown data at all). */
export function classifyPrecip({ rainSum, showersSum, snowfallSum, precipSum }) {
  if (snowfallSum == null && rainSum == null && showersSum == null && precipSum == null) return null;
  if (snowfallSum > 0) return 'snow';
  if (showersSum > 0) return 'showers';
  if (rainSum > 0) return 'rain';
  if (precipSum > 0) return 'rain'; // something fell but the type breakdown was null — rain is the safe default
  return 'none';
}

function parseDay(d, i) {
  const has = (arr) => arr?.[i] != null;
  const rainSum = has(d.rain_sum) ? d.rain_sum[i] : null;
  const showersSum = has(d.showers_sum) ? d.showers_sum[i] : null;
  const snowfallSum = has(d.snowfall_sum) ? d.snowfall_sum[i] : null;
  const precipSum = has(d.precipitation_sum) ? d.precipitation_sum[i] : null;

  return {
    date: d.time[i],
    tempMax: has(d.temperature_2m_max) ? round(d.temperature_2m_max[i]) : null,
    tempMin: has(d.temperature_2m_min) ? round(d.temperature_2m_min[i]) : null,
    tempMean: has(d.temperature_2m_mean) ? round(d.temperature_2m_mean[i]) : null,
    precipSum,
    rainSum,
    showersSum,
    snowfallSum,
    precipType: classifyPrecip({ rainSum, showersSum, snowfallSum, precipSum }),
    windSpeedMax: has(d.wind_speed_10m_max) ? round(d.wind_speed_10m_max[i]) : null,
    windGustsMax: has(d.wind_gusts_10m_max) ? round(d.wind_gusts_10m_max[i]) : null,
    humidityMean: has(d.relative_humidity_2m_mean) ? round(d.relative_humidity_2m_mean[i]) : null,
    cloudCoverMean: has(d.cloud_cover_mean) ? round(d.cloud_cover_mean[i]) : null,
  };
}

/** Fetches the outlook for every day in [startDateStr, endDateStr] (inclusive, "YYYY-MM-DD"). */
export async function fetchFutureWeatherRange(lat, lon, startDateStr, endDateStr, units) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: DAILY_VARS,
    start_date: startDateStr,
    end_date: endDateStr,
    temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: units === 'imperial' ? 'mph' : 'kmh',
    precipitation_unit: units === 'imperial' ? 'inch' : 'mm',
    timezone: 'auto',
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`Future weather API error ${res.status}`);
  const data = await res.json();
  const d = data.daily;
  if (!d?.time?.length) return [];

  return d.time.map((_, i) => parseDay(d, i))
    // Dates right at the edge of the model's range can come back "present"
    // but with every field null.
    .filter((day) => day.tempMax != null || day.tempMin != null || day.precipSum != null);
}

export async function fetchFutureWeather(lat, lon, dateStr, units) {
  const days = await fetchFutureWeatherRange(lat, lon, dateStr, dateStr, units);
  return days[0] ?? null;
}
