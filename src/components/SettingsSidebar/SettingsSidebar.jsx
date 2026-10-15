import { useState, useEffect } from 'react';
import { X, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { LocationSettings } from './LocationSettings';
import { Toggle } from '../ui/Toggle';
import { NotificationSettings } from '../NotificationSettings/NotificationSettings';
import { fetchOpenMeteoLayers, DOMAINS } from '../../services/openmeteoRadar';
import { WIDGET_REGISTRY, DETAILS_FIELD_LABELS } from '../widgets/registry';
import { MODE_OPTIONS, COLOR_PRESET_OPTIONS, PRESET_PREVIEW, isLightBg } from '../../utils/themeColor';
import { useIsWatch } from '../../hooks/useIsWatch';
import { radarWasmSupported } from '../../radar-wasm/radarRenderer';
import useAppStore from '../../store/useAppStore';
import './SettingsSidebar.css';

/** Loads the layer list (the model's variable list) for a domain. */
function useOpenMeteoLayers(enabled, domain) {
  const [layers, setLayers] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLayers([]);
    fetchOpenMeteoLayers(undefined, domain)
      .then((l) => { if (alive) setLayers(l); })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled, domain]);
  return layers;
}

const TABS = [
  { id: 'location', label: 'Location' },
  { id: 'api',      label: 'Weather' },
  { id: 'display',  label: 'Display' },
  { id: 'widgets',  label: 'Widgets' },
  { id: 'radar',    label: 'Radar' },
  { id: 'alerts',   label: 'Alerts' },
];

/* LibreWXR color scheme IDs — must match the integer passed in the tile URL */
const COLOR_SCHEMES = [
  { id: 0,  name: 'B&W',             gradient: 'linear-gradient(90deg, #000, #888, #fff)' },
  { id: 1,  name: 'RainViewer',      gradient: 'linear-gradient(90deg, transparent, #0000ff, #00ff00, #ffff00, #ff8000, #ff0000)' },
  { id: 2,  name: 'Universal Blue',  gradient: 'linear-gradient(90deg, transparent, #1a1aff, #0066ff, #00ccff, #66ffff, #fff)' },
  { id: 3,  name: 'TITAN',           gradient: 'linear-gradient(90deg, transparent, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000, #ff00ff)' },
  { id: 4,  name: 'Weather Channel', gradient: 'linear-gradient(90deg, transparent, #006600, #00cc00, #ffff00, #ff6600, #ff0000, #cc00cc)' },
  { id: 5,  name: 'Meteored',        gradient: 'linear-gradient(90deg, transparent, #004488, #0088cc, #00cc88, #88cc00, #cc8800, #cc0000)' },
  { id: 6,  name: 'NEXRAD III',      gradient: 'linear-gradient(90deg, #000, #004400, #008800, #00cc00, #ffff00, #ff8800, #ff0000, #cc00cc)' },
  { id: 7,  name: 'Rainbow',         gradient: 'linear-gradient(90deg, transparent, #0000ff, #00ffff, #00ff00, #ffff00, #ff8000, #ff0000)' },
  { id: 8,  name: 'Dark Sky',        gradient: 'linear-gradient(90deg, transparent, #0d1117, #1f3a5c, #2d6a9f, #63b3ed, #fff)' },
  { id: 9,  name: 'Datameteo',       gradient: 'linear-gradient(90deg, transparent, #320064, #6400c8, #9600ff, #c864ff, #ff96ff)' },
  { id: 10, name: 'Viper HD',        gradient: 'linear-gradient(90deg, transparent, #00004c, #0000ff, #00ffff, #ffff00, #ff0000)' },
  { id: 11, name: 'MRMS CREF',       gradient: 'linear-gradient(90deg, #000, #003366, #0066cc, #00cc66, #66ff00, #ffcc00, #ff6600, #ff0000)' },
];

function SegControl({ options, value, onChange }) {
  return (
    <div className="seg-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`seg-btn ${value === opt.value ? 'seg-btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingsSlider({ label, value, min, max, step = 0.01, format, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="settings-slider-wrap">
      <div className="settings-slider-top">
        <span className="settings-slider-label">{label}</span>
        <span className="settings-slider-value">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function LocationTab() {
  return (
    <div className="settings-group">
      <div className="settings-group-label">Your Location</div>
      <LocationSettings />
    </div>
  );
}

function APITab() {
  const weatherAPI = useAppStore((s) => s.weatherAPI);
  const setWeatherAPI = useAppStore((s) => s.setWeatherAPI);
  const units = useAppStore((s) => s.units);
  const setUnits = useAppStore((s) => s.setUnits);

  return (
    <>
      <div className="settings-group">
        <div className="settings-group-label">Weather Provider</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Data Source</div>
            <div className="settings-row-sub">NWS is US-only. Open-Meteo is global.</div>
          </div>
          <SegControl
            options={[
              { label: 'NWS', value: 'nws' },
              { label: 'Open-Meteo', value: 'openmeteo' },
            ]}
            value={weatherAPI}
            onChange={setWeatherAPI}
          />
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Units</div>
        <div className="settings-row">
          <div className="settings-row-label">Temperature & Speed</div>
          <SegControl
            options={[
              { label: 'Imperial', value: 'imperial' },
              { label: 'Metric', value: 'metric' },
            ]}
            value={units}
            onChange={setUnits}
          />
        </div>
      </div>
    </>
  );
}

const CUSTOM_COLOR_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'textPrimary', label: 'Primary Text' },
  { key: 'textSecondary', label: 'Secondary Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
  { key: 'success', label: 'Success' },
];

function ThemeSwatch({ id, label, active, preview, onClick }) {
  return (
    <button className={`theme-swatch ${active ? 'theme-swatch--active' : ''}`} onClick={onClick}>
      <div
        className="theme-swatch-preview"
        style={preview.gradient ? { background: preview.gradient } : {
          background: preview.bg,
          '--swatch-accent': preview.accent,
        }}
      >
        {!preview.gradient && <div className="theme-swatch-accent-dot" />}
      </div>
      <span className="theme-swatch-name">{label}</span>
    </button>
  );
}

function DisplayTab() {
  const isWatch = useIsWatch();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const colorPreset = useAppStore((s) => s.colorPreset);
  const setColorPreset = useAppStore((s) => s.setColorPreset);
  const customTheme = useAppStore((s) => s.customTheme);
  const setCustomTheme = useAppStore((s) => s.setCustomTheme);
  const materialYou = useAppStore((s) => s.materialYou);
  const setMaterialYou = useAppStore((s) => s.setMaterialYou);
  const customMode = useAppStore((s) => s.customMode);
  const setCustomMode = useAppStore((s) => s.setCustomMode);
  const materialSingleColor = useAppStore((s) => s.materialSingleColor);
  const setMaterialSingleColor = useAppStore((s) => s.setMaterialSingleColor);
  const materialSingleColorMode = useAppStore((s) => s.materialSingleColorMode);
  const setMaterialSingleColorMode = useAppStore((s) => s.setMaterialSingleColorMode);
  const sidebarPosition = useAppStore((s) => s.sidebarPosition);
  const setSidebarPosition = useAppStore((s) => s.setSidebarPosition);
  const newMobileLayout = useAppStore((s) => s.newMobileLayout);
  const setNewMobileLayout = useAppStore((s) => s.setNewMobileLayout);
  const watchRoundDisplay = useAppStore((s) => s.watchRoundDisplay);
  const setWatchRoundDisplay = useAppStore((s) => s.setWatchRoundDisplay);
  // Material You is still a work in progress, so it lives in a collapsed
  // Experimental section — opened by default only if it's already turned on.
  const [experimentalOpen, setExperimentalOpen] = useState(materialYou);

  // A read-only echo of useTheme()'s own resolution — used only to preview
  // color-preset swatches in the right mode, not to apply anything itself.
  const resolvedMode = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme === 'custom'
      ? (isLightBg(customTheme.bg) ? 'light' : 'dark')
      : theme;

  return (
    <>
      <div className="settings-group">
        <div className="settings-group-label">Mode</div>
        <div className="theme-swatch-grid">
          {MODE_OPTIONS.map((m) => {
            const preview = m.id === 'system'
              ? { gradient: 'linear-gradient(90deg, #090910 50%, #e8edf5 50%)' }
              : m.id === 'custom'
                ? { bg: customTheme.bg, accent: customTheme.accent }
                : PRESET_PREVIEW.default[m.id];
            return (
              <ThemeSwatch
                key={m.id}
                label={m.label}
                active={theme === m.id}
                preview={preview}
                onClick={() => setTheme(m.id)}
              />
            );
          })}
        </div>

        {theme === 'custom' && (materialYou && customMode === 'single' ? (
          <div className="custom-theme-picker custom-theme-picker--single">
            <label className="custom-theme-field">
              <span>Seed Color</span>
              <input
                type="color"
                value={materialSingleColor}
                onChange={(e) => setMaterialSingleColor(e.target.value)}
              />
            </label>
            <div className="settings-row" style={{ marginTop: 6 }}>
              <div className="settings-row-label">Base</div>
              <SegControl
                options={[
                  { label: 'Dark', value: 'dark' },
                  { label: 'Light', value: 'light' },
                ]}
                value={materialSingleColorMode}
                onChange={setMaterialSingleColorMode}
              />
            </div>
          </div>
        ) : (
          <div className="custom-theme-picker">
            {CUSTOM_COLOR_FIELDS.map((f) => (
              <label key={f.key} className="custom-theme-field">
                <span>{f.label}</span>
                <input
                  type="color"
                  value={customTheme[f.key]}
                  onChange={(e) => setCustomTheme({ [f.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      {theme !== 'custom' && (
        <div className="settings-group">
          <div className="settings-group-label">Color Preset</div>
          <div className="settings-row-sub" style={{ marginBottom: 10 }}>
            An accent flavor layered on top of your chosen mode — works in both Light and Dark.
          </div>
          <div className="theme-swatch-grid">
            {COLOR_PRESET_OPTIONS.map((p) => (
              <ThemeSwatch
                key={p.id}
                label={p.label}
                active={colorPreset === p.id}
                preview={PRESET_PREVIEW[p.id][resolvedMode]}
                onClick={() => setColorPreset(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="settings-group">
        <div className="settings-group-label">Layout</div>
        <div className="settings-row">
          <div className="settings-row-label">Sidebar Position</div>
          <SegControl
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            value={sidebarPosition}
            onChange={setSidebarPosition}
          />
        </div>
        <div className="settings-row" style={{ marginTop: 6 }}>
          <div>
            <div className="settings-row-label">New Mobile Layout</div>
            <div className="settings-row-sub">
              On phones, use the dedicated scrollable weather page. Turn off to
              use the classic map + bottom sheet.
            </div>
          </div>
          <Toggle checked={newMobileLayout} onChange={setNewMobileLayout} />
        </div>

        {isWatch && (
          <div className="settings-row" style={{ marginTop: 6 }}>
            <div>
              <div className="settings-row-label">Round Display</div>
              <div className="settings-row-sub">
                Pad the layout to fit a circular watch screen so nothing is
                clipped at the corners.
              </div>
            </div>
            <Toggle checked={watchRoundDisplay} onChange={setWatchRoundDisplay} />
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Weather Assistant</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Clear Downloaded AI Model</div>
            <div className="settings-row-sub">
              Frees the on-device model StormView's weather assistant downloaded to your browser.
            </div>
          </div>
          <button
            className="wa-clear-btn"
            onClick={async () => {
              const { clearModelCache } = await import('../../services/webllm');
              clearModelCache();
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="settings-group">
        <button
          className="settings-group-label settings-experimental-toggle"
          aria-expanded={experimentalOpen}
          onClick={() => setExperimentalOpen((o) => !o)}
        >
          Experimental
          <ChevronDown
            size={12}
            strokeWidth={2.5}
            className={experimentalOpen ? 'settings-experimental-chevron--open' : ''}
          />
        </button>

        {experimentalOpen && (
          <>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Material You</div>
                <div className="settings-row-sub">
                  Work in progress — some screens may look off. Reskins the whole
                  app with Google's real M3 color algorithm, shape scale, and
                  ripple/state-layer feedback, generated from your current accent
                  color.
                </div>
              </div>
              <Toggle checked={materialYou} onChange={setMaterialYou} />
            </div>

            {theme === 'custom' && materialYou && (
              <div className="settings-row" style={{ marginTop: 6 }}>
                <div className="settings-row-label">Custom Mode</div>
                <SegControl
                  options={[
                    { label: 'Full Palette', value: 'full' },
                    { label: 'Single Color', value: 'single' },
                  ]}
                  value={customMode}
                  onChange={setCustomMode}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function WidgetsTab() {
  const widgets = useAppStore((s) => s.widgets);
  const setWidgetEnabled = useAppStore((s) => s.setWidgetEnabled);
  const moveWidget = useAppStore((s) => s.moveWidget);
  const detailsFields = useAppStore((s) => s.detailsFields);
  const setDetailsField = useAppStore((s) => s.setDetailsField);
  const aqiShowPollutants = useAppStore((s) => s.aqiShowPollutants);
  const setAqiShowPollutants = useAppStore((s) => s.setAqiShowPollutants);

  const detailsEnabled = widgets.find((w) => w.id === 'details')?.enabled;
  const aqiEnabled = widgets.find((w) => w.id === 'aqi')?.enabled;

  return (
    <>
      <div className="settings-group">
        <div className="settings-group-label">Home Screen Sections</div>
        <div className="settings-row-sub" style={{ marginBottom: 10 }}>
          Show, hide, and reorder the sections below "Current Conditions" on your
          homepage/sidebar. Current Conditions and the radar preview are always shown.
        </div>
        {widgets.map((w, i) => (
          <div key={w.id} className="settings-row widget-row">
            <Toggle
              checked={w.enabled}
              onChange={(v) => setWidgetEnabled(w.id, v)}
              label={WIDGET_REGISTRY[w.id]?.label ?? w.id}
            />
            <div className="widget-row-controls">
              <button
                className="widget-row-btn"
                disabled={i === 0}
                onClick={() => moveWidget(w.id, -1)}
                aria-label="Move up"
              >
                <ChevronUp size={14} strokeWidth={2} />
              </button>
              <button
                className="widget-row-btn"
                disabled={i === widgets.length - 1}
                onClick={() => moveWidget(w.id, 1)}
                aria-label="Move down"
              >
                <ChevronDown size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {detailsEnabled && (
        <div className="settings-group">
          <div className="settings-group-label">Weather Details — Fields</div>
          <div className="settings-row-sub" style={{ marginBottom: 10 }}>
            Hide any of these info cards you don't need from the Weather Details section.
          </div>
          <div className="widget-fields-grid">
            {Object.entries(DETAILS_FIELD_LABELS).map(([key, label]) => (
              <Toggle
                key={key}
                checked={detailsFields?.[key] !== false}
                onChange={(v) => setDetailsField(key, v)}
                label={label}
              />
            ))}
          </div>
        </div>
      )}

      {aqiEnabled && (
        <div className="settings-group">
          <div className="settings-group-label">Air Quality Widget</div>
          <div className="settings-row">
            <Toggle
              checked={aqiShowPollutants}
              onChange={setAqiShowPollutants}
              label="Show Pollutant Breakdown"
            />
          </div>
        </div>
      )}
    </>
  );
}

function AdvisoryConfirm({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 22px',
        maxWidth: 340, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} strokeWidth={2.5} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Performance Warning
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 8px' }}>
          Enabling advisories fetches zone boundary data from the NWS API for every active advisory in the country — this can be <strong style={{ color: 'var(--text-primary)' }}>dozens of extra network requests</strong> and may noticeably slow down the page, especially on first load.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 18px' }}>
          Zone boundaries are cached after the first fetch, so subsequent reloads will be faster.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px', fontSize: 12.5, fontWeight: 500,
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
              background: 'var(--warning)', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: '#000',
            }}
          >
            Enable Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function RadarTab() {
  const [advisoryConfirmOpen, setAdvisoryConfirmOpen] = useState(false);
  const mapLayer         = useAppStore((s) => s.mapLayer);
  const setMapLayer      = useAppStore((s) => s.setMapLayer);
  const radarSource      = useAppStore((s) => s.radarSource);
  const setRadarSource   = useAppStore((s) => s.setRadarSource);
  const openmeteoDomain      = useAppStore((s) => s.openmeteoDomain);
  const setOpenmeteoDomain    = useAppStore((s) => s.setOpenmeteoDomain);
  const openmeteoVariable    = useAppStore((s) => s.openmeteoVariable);
  const setOpenmeteoVariable  = useAppStore((s) => s.setOpenmeteoVariable);
  const radarOpacity     = useAppStore((s) => s.radarOpacity);
  const setRadarOpacity  = useAppStore((s) => s.setRadarOpacity);
  const radarTileQuality = useAppStore((s) => s.radarTileQuality);
  const setRadarTileQuality = useAppStore((s) => s.setRadarTileQuality);
  const radarColorScheme = useAppStore((s) => s.radarColorScheme);
  const setRadarColorScheme = useAppStore((s) => s.setRadarColorScheme);
  const radarRenderer = useAppStore((s) => s.radarRenderer);
  const radarFrameFade = useAppStore((s) => s.radarFrameFade);
  const setRadarFrameFade = useAppStore((s) => s.setRadarFrameFade);
  const setRadarRenderer = useAppStore((s) => s.setRadarRenderer);
  const showNowcast = useAppStore((s) => s.showNowcast);
  const setShowNowcast = useAppStore((s) => s.setShowNowcast);
  const showSatellite = useAppStore((s) => s.showSatellite);
  const setShowSatellite = useAppStore((s) => s.setShowSatellite);
  const showAlertPolygons = useAppStore((s) => s.showAlertPolygons);
  const setShowAlertPolygons = useAppStore((s) => s.setShowAlertPolygons);
  const showAdvisories = useAppStore((s) => s.showAdvisories);
  const setShowAdvisories = useAppStore((s) => s.setShowAdvisories);
  const showArrows = useAppStore((s) => s.showArrows);
  const setShowArrows = useAppStore((s) => s.setShowArrows);

  const openmeteoLayers = useOpenMeteoLayers(radarSource === 'openmeteo', openmeteoDomain);

  const changeDomain = (slug) => {
    setOpenmeteoDomain(slug);
    // Variable lists differ per model — reset to the one they all share.
    if (openmeteoVariable !== 'precipitation') setOpenmeteoVariable('precipitation');
  };

  return (
    <>
      {/* ---- Layer selector ---- */}
      <div className="settings-group">
        <div className="settings-group-label">Map Layer</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Active Overlay</div>
            <div className="settings-row-sub">Switch between radar and air quality index</div>
          </div>
          <select
            className="settings-select"
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value)}
          >
            <option value="radar">Radar</option>
            <option value="aqi">AQI (Air Quality)</option>
          </select>
        </div>

        {mapLayer === 'aqi' && (
          <div className="settings-aqi-note">
            A color gradient shows air quality across the map — green is clean, yellow/orange/red indicates increasing pollution.
            Click anywhere for precise AQI values and pollutant breakdown. Data from Open-Meteo (global coverage, no API key required).
          </div>
        )}
      </div>

      {/* ---- Radar-only options ---- */}
      {mapLayer === 'radar' && <>
      <div className="settings-group">
        <div className="settings-group-label">Radar Source</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Provider</div>
            <div className="settings-row-sub">
              {radarSource === 'openmeteo'
                ? 'Open-Meteo Maps — weather-model data rendered in-browser. Very fast and global, with short-range forecast steps. Pick a model and layer below.'
                : 'LibreWXR / StormCast — observed radar mosaic with a 90-minute nowcast (best over the US).'}
            </div>
          </div>
          <select
            className="settings-select"
            value={radarSource}
            onChange={(e) => setRadarSource(e.target.value)}
          >
            <option value="stormcast">LibreWXR</option>
            <option value="openmeteo">Open-Meteo</option>
          </select>
        </div>

        {radarSource === 'openmeteo' && (
          <>
            <div className="settings-row settings-row--stack" style={{ marginTop: 6 }}>
              <div>
                <div className="settings-row-label">Model</div>
                <div className="settings-row-sub">
                  Which weather model to pull data from.
                </div>
              </div>
              <select
                className="settings-select"
                value={openmeteoDomain}
                onChange={(e) => changeDomain(e.target.value)}
              >
                {DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}{d.scope === 'US' ? ' (US)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-row settings-row--stack" style={{ marginTop: 6 }}>
              <div>
                <div className="settings-row-label">Layer</div>
                <div className="settings-row-sub">
                  Which variable to render on the map.
                </div>
              </div>
              <select
                className="settings-select"
                value={openmeteoVariable}
                onChange={(e) => setOpenmeteoVariable(e.target.value)}
                disabled={openmeteoLayers.length === 0}
              >
                {openmeteoLayers.length === 0 ? (
                  <option>{openmeteoVariable}</option>
                ) : (
                  openmeteoLayers.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))
                )}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Radar Options</div>
        {radarSource === 'stormcast' && (
          <div className="settings-row" style={{ marginBottom: 6 }}>
            <div>
              <div className="settings-row-label">Tile Quality</div>
              <div className="settings-row-sub">
                {radarTileQuality === 256
                  ? 'Fast — 256 px tiles, loads quicker, blurry at high zoom'
                  : 'Sharp — 512 px tiles, full detail, slower to load'}
              </div>
            </div>
            <SegControl
              options={[
                { label: 'Fast', value: 256 },
                { label: 'Sharp', value: 512 },
              ]}
              value={radarTileQuality}
              onChange={setRadarTileQuality}
            />
          </div>
        )}
        {radarSource === 'stormcast' && radarWasmSupported && (
          <div className="settings-row" style={{ marginBottom: 6 }}>
            <div>
              <div className="settings-row-label">Rendering</div>
              <div className="settings-row-sub">
                {radarRenderer === 'wasm'
                  ? showArrows
                    ? 'On-device — paused while Storm Motion Arrows are on (the server draws them)'
                    : 'On-device — smaller downloads and instant color changes; snow shows in rain colors'
                  : 'Server — LibreWXR colors each tile, including snow'}
              </div>
            </div>
            <SegControl
              options={[
                { label: 'Device', value: 'wasm' },
                { label: 'Server', value: 'server' },
              ]}
              value={radarRenderer}
              onChange={setRadarRenderer}
            />
          </div>
        )}
        <SettingsSlider
          label="Radar Opacity"
          value={radarOpacity}
          min={0.1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setRadarOpacity}
        />
        <div className="settings-row" style={{ marginTop: 6 }}>
          <Toggle
            checked={showNowcast}
            onChange={setShowNowcast}
            label={radarSource === 'openmeteo' ? 'Show Forecast Steps' : 'Show 90-min Nowcast'}
          />
        </div>
        {radarSource === 'stormcast' && (
          <div className="settings-row">
            <Toggle
              checked={radarFrameFade}
              onChange={setRadarFrameFade}
              label="Fade Between Frames"
            />
          </div>
        )}
        <div className="settings-row">
          <Toggle
            checked={showSatellite}
            onChange={setShowSatellite}
            label="Satellite Imagery"
          />
        </div>
        <div className="settings-row">
          <Toggle
            checked={showAlertPolygons}
            onChange={setShowAlertPolygons}
            label="NWS Warning Polygons"
          />
        </div>
        {radarSource === 'stormcast' && (
          <div className="settings-row">
            <Toggle
              checked={showArrows}
              onChange={setShowArrows}
              label="Storm Motion Arrows"
            />
          </div>
        )}
        {radarSource === 'stormcast' && showArrows && (
          <div style={{
            padding: '8px 10px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginTop: 4,
          }}>
            Overlays storm direction arrows from optical flow analysis. Arrow color automatically matches your current theme.
          </div>
        )}
        {showAlertPolygons && (
          <div style={{
            marginTop: 4,
            padding: '8px 10px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            Overlays active NWS warning polygons (US only). Click any polygon for full details.
          </div>
        )}
        {showAlertPolygons && (
          <div style={{
            marginTop: 6,
            paddingLeft: 14,
            borderLeft: '2px solid var(--border)',
          }}>
            <div className="settings-row" style={{ marginBottom: 0 }}>
              <Toggle
                checked={showAdvisories}
                onChange={(val) => val ? setAdvisoryConfirmOpen(true) : setShowAdvisories(false)}
                label="Include Advisories & Statements"
              />
            </div>
            {showAdvisories && (
              <div style={{
                marginTop: 4,
                padding: '7px 10px',
                background: 'var(--accent-dim)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-xs)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Also shows heat advisories, fog advisories, air quality alerts, special statements, and more. Boundaries are county/zone-based (dashed outlines) and may load slower on first use.
              </div>
            )}
          </div>
        )}
      </div>

      {radarSource === 'stormcast' && (
      <div className="settings-group">
        <div className="settings-group-label">Color Scheme</div>
        <div className="color-scheme-grid">
          {COLOR_SCHEMES.map((cs) => (
            <button
              key={cs.id}
              className={`color-scheme-btn ${radarColorScheme === cs.id ? 'color-scheme-btn--active' : ''}`}
              onClick={() => setRadarColorScheme(cs.id)}
            >
              <div className="color-scheme-swatch" style={{ background: cs.gradient }} />
              <span className="color-scheme-name">{cs.name}</span>
            </button>
          ))}
        </div>
      </div>
      )}
      </>}  {/* end mapLayer === 'radar' */}

      {advisoryConfirmOpen && (
        <AdvisoryConfirm
          onConfirm={() => { setShowAdvisories(true); setAdvisoryConfirmOpen(false); }}
          onCancel={() => setAdvisoryConfirmOpen(false)}
        />
      )}
    </>
  );
}

function AlertsTab({ pushNotifications }) {
  return (
    <div className="settings-group">
      <div className="settings-group-label">Push Notifications</div>
      <NotificationSettings {...pushNotifications} />
    </div>
  );
}

const STATIC_TAB_CONTENT = {
  location: <LocationTab />,
  api:      <APITab />,
  display:  <DisplayTab />,
  widgets:  <WidgetsTab />,
  radar:    <RadarTab />,
};

export function SettingsSidebar({ pushNotifications }) {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const settingsTab = useAppStore((s) => s.settingsTab);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);

  if (!settingsOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} />
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={() => setSettingsOpen(false)}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="settings-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${settingsTab === t.id ? 'settings-tab--active' : ''}`}
              onClick={() => setSettingsTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {settingsTab === 'alerts'
            ? <AlertsTab pushNotifications={pushNotifications} />
            : STATIC_TAB_CONTENT[settingsTab] ?? <LocationTab />}
        </div>

        <div className="settings-footer">
          <div className="settings-footer-text">
            <span className="settings-footer-beta">BETA</span>
            StormView is in active development — bugs and missing features are expected.
          </div>
          <a
            href="https://github.com/arc360alt/StormView-Rewrite"
            target="_blank"
            rel="noopener noreferrer"
            className="settings-footer-link"
          >
            Report an issue on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}
