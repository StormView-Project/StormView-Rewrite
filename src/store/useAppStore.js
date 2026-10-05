import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_WIDGETS, DEFAULT_DETAILS_FIELDS } from '../components/widgets/defaults';
import { DEFAULT_MODEL } from '../services/webllm';

const DEFAULT_CUSTOM_THEME = {
  bg: '#090910',
  surface: '#111119',
  textPrimary: '#e8e8f2',
  textSecondary: '#8888a8',
  accent: '#4f8ef5',
  warning: '#f59e0b',
  danger: '#ef4444',
  success: '#10b981',
};

const useAppStore = create(
  persist(
    (set, get) => ({
      // ---- Persisted settings ----
      theme: 'light',           // 'dark' | 'light' | 'system' | 'custom' — the light/dark mode axis
      colorPreset: 'default',  // 'default' | 'ocean' | 'sunset' | 'forest' | 'crimson' — accent flavor, applied on top of the mode (ignored when theme === 'custom')
      customTheme: DEFAULT_CUSTOM_THEME,
      materialYou: false,      // Material You (M3) rendering mode — reskins colors/shape/elevation from a seed color
      customMode: 'full',      // 'full' (8-color picker) | 'single' (one seed color -> full Material You palette) — only meaningfully different when materialYou is on
      materialSingleColor: '#4f8ef5', // seed color for customMode === 'single'
      materialSingleColorMode: 'dark', // 'dark' | 'light' — which M3 scheme to generate from the single seed color (no bg color is picked in this mode to infer it from)
      widgets: DEFAULT_WIDGETS, // [{ id, enabled }] — order + visibility of optional home-screen sections
      detailsFields: DEFAULT_DETAILS_FIELDS, // { fieldKey: enabled } — which info cards show in the Weather Details widget
      aqiShowPollutants: true, // Air Quality widget: show the PM2.5/PM10/etc breakdown
      assistantModel: DEFAULT_MODEL, // which WebLLM model the weather assistant loads
      weatherAPI: 'openmeteo', // 'nws' | 'openmeteo'
      units: 'imperial',       // 'imperial' | 'metric'
      sidebarPosition: 'left', // 'left' | 'right'
      newMobileLayout: true,   // use the dedicated mobile weather page on phones
      watchRoundDisplay: false, // watch mode: optimise layout for a circular screen
      radarSource: 'openmeteo', // 'stormcast' (LibreWXR) | 'openmeteo' (Open-Meteo maps)
      openmeteoDomain: 'ncep_hrrr_conus',        // which Open-Meteo weather model
      openmeteoVariable: 'precipitation', // which Open-Meteo map layer to render
      radarOpacity: 0.75,
      radarTileQuality: 512,   // URL image size: 256 (fast, blurry) or 512 (sharp)
      radarColorScheme: 7,     // 0-11 LibreWXR color scheme IDs (7 = Rainbow)
      showNowcast: true,
      showSatellite: false,
      showAlertPolygons: true,
      showAdvisories: false,
      showArrows: false,
      mapZoom: 7,
      mapLayer: 'radar',       // 'radar' | 'aqi'
      location: null,          // { lat, lon, name, state }
      notifNws: true,          // receive NWS weather alert notifications
      notifAqi: true,          // receive AQI unhealthy notifications

      // ---- Transient UI state ----
      settingsOpen: false,
      settingsTab: 'location', // 'location' | 'api' | 'display' | 'widgets' | 'radar' | 'alerts'
      // { loadedTiles, totalTiles, framesLoaded, framesTotal, startTime }
      radarTileProgress: null,
      dismissedWhatsNewVersion: null, // persisted — stores the version string user dismissed

      // ---- Radar playback state ----
      radarFrames: [],         // [{ time, path, host, type: 'past'|'nowcast' }]
      radarCurrentIdx: 0,
      radarPlaying: false,
      radarSpeed: 1,           // 0.5 | 1 | 2

      // ---- Setters: settings ----
      setTheme: (theme) => set({ theme }),
      setColorPreset: (colorPreset) => set({ colorPreset }),
      setCustomTheme: (patch) => set((s) => ({ customTheme: { ...s.customTheme, ...patch } })),
      setMaterialYou: (v) => set({ materialYou: v }),
      setCustomMode: (v) => set({ customMode: v }),
      setMaterialSingleColor: (v) => set({ materialSingleColor: v }),
      setMaterialSingleColorMode: (v) => set({ materialSingleColorMode: v }),
      setAssistantModel: (id) => set({ assistantModel: id }),
      setWidgetEnabled: (id, enabled) => set((s) => ({
        widgets: s.widgets.map((w) => (w.id === id ? { ...w, enabled } : w)),
      })),
      moveWidget: (id, delta) => set((s) => {
        const idx = s.widgets.findIndex((w) => w.id === id);
        const next = idx + delta;
        if (idx === -1 || next < 0 || next >= s.widgets.length) return {};
        const widgets = s.widgets.slice();
        [widgets[idx], widgets[next]] = [widgets[next], widgets[idx]];
        return { widgets };
      }),
      setDetailsField: (key, enabled) => set((s) => ({
        detailsFields: { ...s.detailsFields, [key]: enabled },
      })),
      setAqiShowPollutants: (v) => set({ aqiShowPollutants: v }),
      setWeatherAPI: (api) => set({ weatherAPI: api }),
      setUnits: (units) => set({ units }),
      setSidebarPosition: (pos) => set({ sidebarPosition: pos }),
      setNewMobileLayout: (v) => set({ newMobileLayout: v }),
      setWatchRoundDisplay: (v) => set({ watchRoundDisplay: v }),
      setRadarSource: (v) => set({ radarSource: v }),
      setOpenmeteoDomain: (v) => set({ openmeteoDomain: v }),
      setOpenmeteoVariable: (v) => set({ openmeteoVariable: v }),
      setRadarOpacity: (v) => set({ radarOpacity: v }),
      setRadarTileQuality: (v) => set({ radarTileQuality: v }),
      setRadarColorScheme: (v) => set({ radarColorScheme: v }),
      setShowNowcast: (v) => set({ showNowcast: v }),
      setShowSatellite: (v) => set({ showSatellite: v }),
      setShowAlertPolygons: (v) => set({ showAlertPolygons: v }),
      setShowAdvisories: (v) => set({ showAdvisories: v }),
      setShowArrows: (v) => set({ showArrows: v }),
      setMapZoom: (v) => set({ mapZoom: v }),
      setMapLayer: (v) => set({ mapLayer: v }),
      setLocation: (loc) => set({ location: loc }),
      setNotifNws: (v) => set({ notifNws: v }),
      setNotifAqi: (v) => set({ notifAqi: v }),

      // ---- Setters: UI ----
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setSettingsTab: (tab) => set({ settingsTab: tab }),
      setRadarTileProgress: (p) => set({ radarTileProgress: p }),
      setDismissedWhatsNewVersion: (v) => set({ dismissedWhatsNewVersion: v }),

      // ---- Setters: radar ----
      setRadarFrames: (frames) => set({
        radarFrames: frames,
        radarCurrentIdx: (() => {
          // Default to the most-recent observed (last 'past') frame, not nowcast
          for (let i = frames.length - 1; i >= 0; i--) {
            if (frames[i].type === 'past') return i;
          }
          return frames.length > 0 ? frames.length - 1 : 0;
        })(),
      }),
      setRadarCurrentIdx: (idx) => set({ radarCurrentIdx: idx }),
      setRadarPlaying: (v) => set({ radarPlaying: v }),
      setRadarSpeed: (v) => set({ radarSpeed: v }),

      // ---- Helpers ----
      resolvedTheme: () => {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
      },

      getUnitLabel: (type) => {
        const { units } = get();
        if (type === 'temp') return units === 'imperial' ? '°F' : '°C';
        if (type === 'speed') return units === 'imperial' ? 'mph' : 'km/h';
        if (type === 'distance') return units === 'imperial' ? 'mi' : 'km';
        if (type === 'pressure') return 'hPa';
        return '';
      },
    }),
    {
      name: 'stormview-v1',
      version: 1,
      // Keep persisted values on version bump; new keys fall back to initial state defaults.
      migrate: (state) => state,
      // Explicit merge: spread defaults first so any new keys added to the store
      // always have a valid initial value even when loading older stored data.
      merge: (persisted, current) => {
        const merged = { ...current, ...persisted };
        // Named color presets used to BE the `theme` value (e.g. theme: 'ocean'),
        // locking each one to a single dark palette. They're now a separate
        // `colorPreset` axis layered on top of light/dark mode — normalize any
        // old persisted value so users who picked one before this change don't
        // silently fall back to the plain default theme.
        const OLD_PRESET_IDS = ['ocean', 'sunset', 'forest', 'crimson'];
        if (OLD_PRESET_IDS.includes(persisted?.theme)) {
          merged.colorPreset = persisted.theme;
          merged.theme = 'dark';
        }
        // `widgets` is an array, so the generic spread above takes the user's
        // saved list wholesale — any widget id added to DEFAULT_WIDGETS after
        // they last saved would otherwise never appear. Reconcile: keep the
        // user's saved order/enabled state for ids that still exist, append
        // newly-added ids (with their default enabled state) at the end, and
        // drop ids that no longer exist.
        if (persisted?.widgets) {
          const stillValid = persisted.widgets.filter((w) =>
            DEFAULT_WIDGETS.some((d) => d.id === w.id));
          const validIds = new Set(stillValid.map((w) => w.id));
          const newOnes = DEFAULT_WIDGETS.filter((d) => !validIds.has(d.id));
          merged.widgets = [...stillValid, ...newOnes];
        }
        return merged;
      },
      partialize: (s) => ({
        theme: s.theme,
        colorPreset: s.colorPreset,
        customTheme: s.customTheme,
        materialYou: s.materialYou,
        customMode: s.customMode,
        materialSingleColor: s.materialSingleColor,
        materialSingleColorMode: s.materialSingleColorMode,
        widgets: s.widgets,
        detailsFields: s.detailsFields,
        aqiShowPollutants: s.aqiShowPollutants,
        assistantModel: s.assistantModel,
        weatherAPI: s.weatherAPI,
        units: s.units,
        sidebarPosition: s.sidebarPosition,
        newMobileLayout: s.newMobileLayout,
        watchRoundDisplay: s.watchRoundDisplay,
        radarSource: s.radarSource,
        openmeteoDomain: s.openmeteoDomain,
        openmeteoVariable: s.openmeteoVariable,
        radarOpacity: s.radarOpacity,
        radarTileQuality: s.radarTileQuality,
        radarColorScheme: s.radarColorScheme,
        showNowcast: s.showNowcast,
        showSatellite: s.showSatellite,
        showAlertPolygons: s.showAlertPolygons,
        showAdvisories: s.showAdvisories,
        showArrows: s.showArrows,
        mapZoom: s.mapZoom,
        mapLayer: s.mapLayer,
        location: s.location,
        notifNws: s.notifNws,
        notifAqi: s.notifAqi,
        dismissedWhatsNewVersion: s.dismissedWhatsNewVersion,
      }),
    }
  )
);

export default useAppStore;
