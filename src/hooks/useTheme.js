import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveThemeVars, isLightBg, COLOR_PRESETS, THEME_VAR_KEYS } from '../utils/themeColor';
import { generateMaterialVars, MATERIAL_SHAPE_VARS } from '../utils/materialTheme';

// Seed used for Material You when Color Preset is "Default" — Material-izes
// the app's own brand blue instead of an arbitrary color.
const DEFAULT_MATERIAL_SEED = '#4f8ef5';
const MATERIAL_SHAPE_KEYS = Object.keys(MATERIAL_SHAPE_VARS);

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const colorPreset = useAppStore((s) => s.colorPreset);
  const customTheme = useAppStore((s) => s.customTheme);
  const materialYou = useAppStore((s) => s.materialYou);
  const customMode = useAppStore((s) => s.customMode);
  const materialSingleColor = useAppStore((s) => s.materialSingleColor);
  const materialSingleColorMode = useAppStore((s) => s.materialSingleColorMode);

  useEffect(() => {
    const root = document.documentElement;
    const applyVars = (vars) => Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    const clearInlineVars = () => {
      THEME_VAR_KEYS.forEach((k) => root.style.removeProperty(k));
      MATERIAL_SHAPE_KEYS.forEach((k) => root.style.removeProperty(k));
    };
    const setMaterialAttr = (on) => {
      if (on) root.setAttribute('data-material', 'true');
      else root.removeAttribute('data-material');
    };

    // Applies the light/dark mode attribute, then layers either the Material
    // You palette or the color preset's hand-authored vars on top (as inline
    // styles) — or clears any previous override so the plain stylesheet
    // block takes over.
    const applyForMode = (mode) => {
      root.setAttribute('data-theme', mode);
      if (materialYou) {
        const seed = colorPreset !== 'default'
          ? COLOR_PRESETS[colorPreset]?.[mode]?.accent ?? DEFAULT_MATERIAL_SEED
          : DEFAULT_MATERIAL_SEED;
        applyVars(generateMaterialVars(seed, mode));
        applyVars(MATERIAL_SHAPE_VARS);
        setMaterialAttr(true);
        return;
      }
      setMaterialAttr(false);
      const base = colorPreset !== 'default' ? COLOR_PRESETS[colorPreset]?.[mode] : null;
      if (base) {
        applyVars(deriveThemeVars(base));
      } else {
        clearInlineVars();
      }
    };

    if (theme === 'custom') {
      if (materialYou && customMode === 'single') {
        const mode = materialSingleColorMode;
        root.setAttribute('data-theme', mode);
        applyVars(generateMaterialVars(materialSingleColor, mode));
        applyVars(MATERIAL_SHAPE_VARS);
        setMaterialAttr(true);
        return;
      }
      root.setAttribute('data-theme', 'custom');
      if (materialYou) {
        // Full 8-color custom palette, still Material-ized: use the user's
        // own accent as the seed and infer light/dark from their background.
        const mode = isLightBg(customTheme.bg) ? 'light' : 'dark';
        applyVars(generateMaterialVars(customTheme.accent, mode));
        applyVars(MATERIAL_SHAPE_VARS);
        setMaterialAttr(true);
        return;
      }
      setMaterialAttr(false);
      applyVars(deriveThemeVars(customTheme));
      return;
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyForMode(mq.matches ? 'dark' : 'light');
      const handler = (e) => applyForMode(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }

    applyForMode(theme); // 'dark' | 'light'
  }, [theme, colorPreset, customTheme, materialYou, customMode, materialSingleColor, materialSingleColorMode]);

  const resolvedTheme = (() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'custom') {
      if (materialYou && customMode === 'single') return materialSingleColorMode;
      return isLightBg(customTheme.bg) ? 'light' : 'dark';
    }
    return theme;
  })();

  return resolvedTheme;
}
