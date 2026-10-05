import { Home, Radar as RadarIcon, Settings } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import './MobileBottomNav.css';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'radar', label: 'Radar', Icon: RadarIcon },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

/**
 * Persistent bottom navigation for the dedicated mobile layout (not watch,
 * not desktop, not the classic opt-out mobile bottom-sheet layout). Styled
 * from the same shared CSS variables as everything else, so it reads as a
 * normal glass app bar in every regular theme and automatically picks up the
 * M3 look (flat tonal surface, pill active-indicator) when Material You mode
 * sets `--surface-elevated`/`--accent-dim` to real M3 tones.
 */
export function MobileBottomNav({ view, onNavigate }) {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  const activeId = settingsOpen ? 'settings' : view; // 'home' | 'radar'

  const handleTap = (id) => {
    if (id === 'settings') {
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen(false);
    onNavigate(id);
  };

  return (
    <nav className="mobile-bottom-nav">
      {TABS.map(({ id, label, Icon }) => {
        const active = activeId === id;
        return (
          <button
            key={id}
            className={`mobile-bottom-nav-item ${active ? 'mobile-bottom-nav-item--active' : ''}`}
            onClick={() => handleTap(id)}
            aria-label={label}
          >
            <span className="mobile-bottom-nav-icon">
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            </span>
            <span className="mobile-bottom-nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
