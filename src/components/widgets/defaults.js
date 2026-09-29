/**
 * Pure widget id/label/default-order data, kept separate from `registry.js`
 * (which imports the actual section components). The store needs the default
 * order but must NOT pull in component modules that import the store back —
 * that would create a circular import.
 */
export const WIDGET_LABELS = {
  alerts: 'Weather Alerts',
  hourly: 'Hourly Forecast',
  daily: 'Daily Forecast',
  sunrise: 'Sunrise & Sunset',
  details: 'Weather Details',
  aqi: 'Air Quality',
  windCompass: 'Wind Compass',
  feelsLike: 'Feels Like',
  precipOutlook: 'Precipitation Outlook',
  daylight: 'Daylight',
  uvIndex: 'UV Index',
  moonPhase: 'Moon Phase',
  outlook: "Today's Outlook",
  futureWeather: 'Future Weather',
  monthOutlook: 'Month Outlook',
};

export const DEFAULT_WIDGETS = [
  { id: 'alerts', enabled: true },
  { id: 'hourly', enabled: true },
  { id: 'daily', enabled: true },
  { id: 'sunrise', enabled: true },
  { id: 'details', enabled: true },
  { id: 'aqi', enabled: false },
  { id: 'windCompass', enabled: false },
  { id: 'feelsLike', enabled: false },
  { id: 'precipOutlook', enabled: false },
  { id: 'daylight', enabled: false },
  { id: 'uvIndex', enabled: false },
  { id: 'moonPhase', enabled: false },
  { id: 'outlook', enabled: false },
  { id: 'futureWeather', enabled: false },
  { id: 'monthOutlook', enabled: false },
];

/** Individual info cards inside the "Weather Details" widget — each can be
 *  hidden independently so the widget only shows what you actually care about. */
export const DETAILS_FIELD_LABELS = {
  humidity: 'Humidity',
  wind: 'Wind',
  visibility: 'Visibility',
  pressure: 'Pressure',
  dewPoint: 'Dew Point',
  uvIndex: 'UV Index',
  cloudCover: 'Cloud Cover',
  precip: 'Precipitation',
  aqi: 'Air Quality',
};

export const DEFAULT_DETAILS_FIELDS = {
  humidity: true,
  wind: true,
  visibility: true,
  pressure: true,
  dewPoint: true,
  uvIndex: true,
  cloudCover: true,
  precip: true,
  aqi: true,
};
