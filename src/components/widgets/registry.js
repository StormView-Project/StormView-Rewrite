import { WeatherAlerts } from '../WeatherSidebar/WeatherAlerts';
import { HourlyForecast } from '../WeatherSidebar/HourlyForecast';
import { DailyForecast } from '../WeatherSidebar/DailyForecast';
import { WeatherDetails } from '../WeatherSidebar/WeatherDetails';
import { SunriseSunset } from './SunriseSunset';
import { AirQualityWidget } from './AirQualityWidget';
import { WindCompass } from './WindCompass';
import { FeelsLike } from './FeelsLike';
import { PrecipOutlook } from './PrecipOutlook';
import { Daylight } from './Daylight';
import { UVIndexWidget } from './UVIndexWidget';
import { MoonPhase } from './MoonPhase';
import { TodaysOutlook } from './TodaysOutlook';
import { FutureWeather } from './FutureWeather';
import { MonthOutlook } from './MonthOutlook';
import { WIDGET_LABELS } from './defaults';

/**
 * Registry of optional, reorderable/toggleable weather sections shown after
 * the fixed current-conditions hero (and, on mobile/watch, the radar preview)
 * on the home screen of all three UI trees. `current` and the radar preview
 * are navigation/hero fixtures and intentionally not part of this list.
 */
export const WIDGET_REGISTRY = {
  alerts: { label: WIDGET_LABELS.alerts, Component: WeatherAlerts, alertsProp: true },
  hourly: { label: WIDGET_LABELS.hourly, Component: HourlyForecast },
  daily: { label: WIDGET_LABELS.daily, Component: DailyForecast },
  sunrise: { label: WIDGET_LABELS.sunrise, Component: SunriseSunset },
  details: { label: WIDGET_LABELS.details, Component: WeatherDetails },
  aqi: { label: WIDGET_LABELS.aqi, Component: AirQualityWidget },
  windCompass: { label: WIDGET_LABELS.windCompass, Component: WindCompass },
  feelsLike: { label: WIDGET_LABELS.feelsLike, Component: FeelsLike },
  precipOutlook: { label: WIDGET_LABELS.precipOutlook, Component: PrecipOutlook },
  daylight: { label: WIDGET_LABELS.daylight, Component: Daylight },
  uvIndex: { label: WIDGET_LABELS.uvIndex, Component: UVIndexWidget },
  moonPhase: { label: WIDGET_LABELS.moonPhase, Component: MoonPhase },
  outlook: { label: WIDGET_LABELS.outlook, Component: TodaysOutlook },
  futureWeather: { label: WIDGET_LABELS.futureWeather, Component: FutureWeather },
  monthOutlook: { label: WIDGET_LABELS.monthOutlook, Component: MonthOutlook },
};

export { DEFAULT_WIDGETS, DETAILS_FIELD_LABELS, DEFAULT_DETAILS_FIELDS } from './defaults';
