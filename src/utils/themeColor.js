/** Small hex-color helpers used to derive a full custom theme from a
 *  handful of user-picked base colors, and to preview presets in Settings. */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mix(hexA, hexB, weight) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * weight);
  const g = Math.round(a.g + (b.g - a.g) * weight);
  const bl = Math.round(a.b + (b.b - a.b) * weight);
  return `rgb(${r}, ${g}, ${bl})`;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Whether a background color reads as a "light" theme (for callers that
 *  branch on theme === 'light', e.g. map tile filters). */
export function isLightBg(hex) {
  return luminance(hex) >= 0.5;
}

/** Color Mode — the light/dark/system/custom axis. */
export const MODE_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
  { id: 'custom', label: 'Custom' },
];

/**
 * Color Preset — the accent/flavor axis, applied on top of whichever mode
 * (light or dark) is active. Each preset ships both a light and a dark base
 * palette, expanded through `deriveThemeVars` — the same function the custom
 * builder uses — so every preset works properly in both modes instead of
 * being locked to one, and there's only one code path to keep correct.
 * `default` means "no override" — the plain stylesheet dark/light block.
 */
export const COLOR_PRESET_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'forest', label: 'Forest' },
  { id: 'crimson', label: 'Crimson' },
];

export const COLOR_PRESETS = {
  ocean: {
    dark: { bg: '#071620', surface: '#0c2333', textPrimary: '#e4f2f7', textSecondary: '#7fa8b8', accent: '#22d3ee', warning: '#f59e0b', danger: '#ef4444', success: '#10b981' },
    light: { bg: '#eef8fb', surface: '#ffffff', textPrimary: '#0b2733', textSecondary: '#4f7688', accent: '#0891b2', warning: '#d97706', danger: '#dc2626', success: '#059669' },
  },
  sunset: {
    dark: { bg: '#1a0f0a', surface: '#241510', textPrimary: '#f5e9df', textSecondary: '#b89380', accent: '#fb923c', warning: '#f59e0b', danger: '#ef4444', success: '#10b981' },
    light: { bg: '#fdf3ea', surface: '#ffffff', textPrimary: '#3a2213', textSecondary: '#8a6650', accent: '#ea580c', warning: '#d97706', danger: '#dc2626', success: '#059669' },
  },
  forest: {
    dark: { bg: '#0c1410', surface: '#131f19', textPrimary: '#e6f2ea', textSecondary: '#83a893', accent: '#4ade80', warning: '#f59e0b', danger: '#ef4444', success: '#10b981' },
    light: { bg: '#f0f7f2', surface: '#ffffff', textPrimary: '#132318', textSecondary: '#547063', accent: '#16a34a', warning: '#d97706', danger: '#dc2626', success: '#059669' },
  },
  crimson: {
    dark: { bg: '#160709', surface: '#210b0e', textPrimary: '#f7e6e8', textSecondary: '#c08890', accent: '#f43f5e', warning: '#f59e0b', danger: '#ef4444', success: '#10b981' },
    light: { bg: '#fdf1f2', surface: '#ffffff', textPrimary: '#3a1216', textSecondary: '#8a5a60', accent: '#e11d48', warning: '#d97706', danger: '#dc2626', success: '#059669' },
  },
};

/** Swatch preview colors, keyed by [presetId][mode] — just enough to render a
 *  small chip in Settings without reading computed styles. `default` mirrors
 *  the plain stylesheet dark/light blocks in index.css. */
export const PRESET_PREVIEW = {
  default: {
    dark: { bg: '#090910', accent: '#4f8ef5' },
    light: { bg: '#e8edf5', accent: '#2563eb' },
  },
  ocean: {
    dark: { bg: COLOR_PRESETS.ocean.dark.bg, accent: COLOR_PRESETS.ocean.dark.accent },
    light: { bg: COLOR_PRESETS.ocean.light.bg, accent: COLOR_PRESETS.ocean.light.accent },
  },
  sunset: {
    dark: { bg: COLOR_PRESETS.sunset.dark.bg, accent: COLOR_PRESETS.sunset.dark.accent },
    light: { bg: COLOR_PRESETS.sunset.light.bg, accent: COLOR_PRESETS.sunset.light.accent },
  },
  forest: {
    dark: { bg: COLOR_PRESETS.forest.dark.bg, accent: COLOR_PRESETS.forest.dark.accent },
    light: { bg: COLOR_PRESETS.forest.light.bg, accent: COLOR_PRESETS.forest.light.accent },
  },
  crimson: {
    dark: { bg: COLOR_PRESETS.crimson.dark.bg, accent: COLOR_PRESETS.crimson.dark.accent },
    light: { bg: COLOR_PRESETS.crimson.light.bg, accent: COLOR_PRESETS.crimson.light.accent },
  },
};

/** All CSS variable names `deriveThemeVars` can set — used to clear inline
 *  overrides when switching back to the plain stylesheet (`default` preset). */
export const THEME_VAR_KEYS = Object.keys(deriveThemeVars({
  bg: '#000000', surface: '#000000', textPrimary: '#000000', textSecondary: '#000000',
  accent: '#000000', warning: '#000000', danger: '#000000', success: '#000000',
}));

/**
 * Expands the user's ~8 picked base colors into the full CSS variable set the
 * app uses, so the custom-theme picker doesn't need one input per variable.
 * Returns a plain object of `--css-var: value` pairs to apply as inline styles
 * on `documentElement` (which naturally override the stylesheet).
 */
export function deriveThemeVars(custom) {
  const { bg, surface, textPrimary, textSecondary, accent, warning, danger, success } = custom;
  const isDark = luminance(bg) < 0.5;
  const mixColor = isDark ? '#ffffff' : '#000000';

  return {
    '--bg': bg,
    '--surface': surface,
    '--surface-elevated': mix(surface, mixColor, isDark ? 0.06 : 0.04),
    '--surface-hover': rgba(mixColor, isDark ? 0.05 : 0.04),
    '--surface-active': rgba(mixColor, 0.08),
    '--border': rgba(mixColor, 0.07),
    '--border-strong': rgba(mixColor, 0.14),

    '--text-primary': textPrimary,
    '--text-secondary': textSecondary,
    '--text-muted': rgba(textSecondary, 0.55),

    '--accent': accent,
    '--accent-light': mix(accent, '#ffffff', 0.25),
    '--accent-dim': rgba(accent, isDark ? 0.14 : 0.10),
    '--accent-glow': rgba(accent, isDark ? 0.35 : 0.25),
    '--on-accent': '#ffffff',

    '--nowcast-color': isDark ? '#34d399' : '#059669',
    '--nowcast-dim': isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(5, 150, 105, 0.10)',

    '--warning': warning,
    '--warning-dim': rgba(warning, isDark ? 0.14 : 0.10),
    '--danger': danger,
    '--danger-dim': rgba(danger, isDark ? 0.14 : 0.10),
    '--success': success,

    '--glass-bg': rgba(bg, isDark ? 0.86 : 0.84),
    '--glass-border': rgba(mixColor, 0.07),
    '--scrubber-bg': rgba(bg, 0.82),

    '--shadow-sm': isDark ? '0 2px 10px rgba(0, 0, 0, 0.4)' : '0 2px 10px rgba(0, 0, 0, 0.08)',
    '--shadow-md': isDark ? '0 6px 28px rgba(0, 0, 0, 0.5)' : '0 6px 28px rgba(0, 0, 0, 0.12)',
    '--shadow-lg': isDark ? '0 12px 56px rgba(0, 0, 0, 0.6)' : '0 12px 56px rgba(0, 0, 0, 0.16)',
    '--shadow-glow': `0 0 ${isDark ? 32 : 24}px ${rgba(accent, isDark ? 0.35 : 0.25)}`,

    '--scrollbar-thumb': rgba(mixColor, isDark ? 0.12 : 0.14),
  };
}
