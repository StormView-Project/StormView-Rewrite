import { useEffect } from 'react';

/**
 * Global M3 ripple-on-click feedback for every button in the app, active only
 * while Material You mode is on (`data-material="true"` on `<html>`, set by
 * useTheme.js). One delegated listener covers every button in the app
 * instead of adding ripple logic to each component individually — the host
 * button just needs `position: relative; overflow: hidden` (added generically
 * via the `[data-material="true"] button` CSS rule in index.css).
 */
export function useMaterialRipple() {
  useEffect(() => {
    const onPointerDown = (e) => {
      if (document.documentElement.dataset.material !== 'true') return;
      if (e.button !== 0) return; // primary click/touch only
      const target = e.target.closest('button, [role="button"]');
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'm3-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      // Safety net — if the host unmounts or the animation never fires for
      // some reason, don't leak the node forever.
      setTimeout(() => ripple.remove(), 900);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
}
