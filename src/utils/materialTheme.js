/**
 * Material You (M3) color generation — wraps Google's own
 * `@material/material-color-utilities` (the same HCT-based algorithm Android
 * uses) rather than hand-picking colors, so "Material You" here is the real
 * thing: a full tonal scheme derived from one seed color.
 */
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { mix, rgba } from './themeColor';

/**
 * M3's shape scale, mapped onto this app's existing --radius-* variables.
 * Nearly everything in the app already uses these variables for corners, so
 * remapping just these four values reshapes the whole app's rounding in one
 * place. --radius-xl already matches M3's extra-large (28px); --radius-pill
 * is already a pill and needs no change.
 */
export const MATERIAL_SHAPE_VARS = {
  '--radius-xs': '4px',
  '--radius-sm': '8px',
  '--radius-md': '12px',
  '--radius-lg': '16px',
  '--radius-xl': '28px',
};

/** Builds the same `--css-var` map shape `deriveThemeVars` produces, from a
 *  single seed color — drop-in compatible with the existing apply path in
 *  useTheme.js. `mode` is 'light' or 'dark'. */
export function generateMaterialVars(seedHex, mode) {
  const theme = themeFromSourceColor(argbFromHex(seedHex));
  const scheme = mode === 'light' ? theme.schemes.light : theme.schemes.dark;
  const hex = (argb) => hexFromArgb(argb);

  const bg = hex(scheme.background);
  const surface = hex(scheme.surface);
  const primary = hex(scheme.primary);
  const onBackground = hex(scheme.onBackground);
  const onSurfaceVariant = hex(scheme.onSurfaceVariant);
  const outline = hex(scheme.outline);
  const outlineVariant = hex(scheme.outlineVariant);
  const error = hex(scheme.error);
  const errorContainer = hex(scheme.errorContainer);

  return {
    '--bg': bg,
    '--surface': surface,
    // M3's real elevation technique: tint the surface toward primary at
    // increasing weight instead of darkening/lightening it in isolation.
    '--surface-elevated': mix(surface, primary, 0.05),
    '--surface-hover': mix(surface, primary, 0.08),
    '--surface-active': mix(surface, primary, 0.11),
    '--border': outlineVariant,
    '--border-strong': outline,

    '--text-primary': onBackground,
    '--text-secondary': onSurfaceVariant,
    '--text-muted': rgba(onSurfaceVariant, 0.65),

    '--accent': primary,
    '--accent-light': mix(primary, '#ffffff', 0.25),
    '--accent-dim': hex(scheme.primaryContainer),
    '--accent-glow': rgba(primary, mode === 'dark' ? 0.35 : 0.25),
    // Real M3 onPrimary — matters here specifically because M3's primary is
    // often a LIGHT pastel tone in dark mode (e.g. #acc7ff), where the app's
    // usual hardcoded white button text would fail completely on contrast.
    '--on-accent': hex(scheme.onPrimary),

    // M3 doesn't define warning/success/nowcast roles — inventing a mapping
    // risks poor contrast for no real benefit, so these stay fixed.
    '--nowcast-color': mode === 'dark' ? '#34d399' : '#059669',
    '--nowcast-dim': mode === 'dark' ? 'rgba(52, 211, 153, 0.14)' : 'rgba(5, 150, 105, 0.10)',
    '--warning': '#f59e0b',
    '--warning-dim': mode === 'dark' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.10)',
    '--danger': error,
    '--danger-dim': errorContainer,
    '--success': '#10b981',

    '--glass-bg': rgba(bg, mode === 'dark' ? 0.86 : 0.84),
    '--glass-border': outlineVariant,
    '--scrubber-bg': rgba(bg, 0.82),

    // M3 elevation is subtle (communicated mainly via surface tint, not
    // heavy drop shadows) — noticeably flatter than the hand-authored shadows.
    '--shadow-sm': mode === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
    '--shadow-md': mode === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.12)',
    '--shadow-lg': mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.14)',
    '--shadow-glow': `0 0 ${mode === 'dark' ? 28 : 20}px ${rgba(primary, mode === 'dark' ? 0.3 : 0.2)}`,

    '--scrollbar-thumb': rgba(outline, mode === 'dark' ? 0.4 : 0.3),
  };
}
