import { useState } from 'react';
import { X, Zap, CalendarRange, LayoutGrid, Smartphone, CloudRain, Activity } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import './WhatsNewModal.css';

// ─── DEVELOPER: bump version to re-show for all users; set name for this release ─
export const WHATS_NEW_VERSION = '3.7.0';
export const WHATS_NEW_NAME    = 'Faster radar & long-range outlooks';
// ─────────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    title: 'Faster LibreWXR Radar',
    desc: 'LibreWXR radar is now colored right on your device, so it downloads less than half the data and switching color schemes is instant. Want snow shown in its own colors? Set Rendering to Server under Settings → Radar.',
  },
  {
    icon: CalendarRange,
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.12)',
    title: 'Future Weather & Month Outlook',
    desc: 'Two new widgets look up to about 7 months ahead: pick a date or a whole month to see the expected temperatures and precipitation. These are long-range estimates, not exact forecasts. Turn them on in the Widgets tab.',
  },
  {
    icon: LayoutGrid,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    title: 'Even More Widgets',
    desc: 'Add Feels Like, Today\'s Outlook, Precipitation Outlook, Daylight, UV Index, and Moon Phase to your homepage from the Widgets tab.',
  },
  {
    icon: Smartphone,
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    title: 'New Mobile Tab Bar',
    desc: 'On phones, a bar along the bottom now jumps between Home, Radar, and Settings in one tap.',
  },
  {
    icon: CloudRain,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    title: 'Hourly Precipitation',
    desc: 'Tap the Precip. card in Weather Details to see how today\'s rain or snow is spread across each hour.',
  },
  {
    icon: Activity,
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
    title: 'Bug Fixes & Improvements',
    desc: 'The weather assistant now answers the question you actually asked, plus plenty of smaller fixes.',
  },
];

export function WhatsNewModal() {
  const dismissedVersion    = useAppStore((s) => s.dismissedWhatsNewVersion);
  const setDismissedVersion = useAppStore((s) => s.setDismissedWhatsNewVersion);
  const location            = useAppStore((s) => s.location);

  const [neverShow, setNeverShow] = useState(false);
  const [closing,   setClosing]   = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  // Show when: location is set, not dismissed for this session, and this
  // version hasn't been permanently dismissed.
  const shouldShow = !!location && !sessionDismissed && dismissedVersion !== WHATS_NEW_VERSION;

  if (!shouldShow) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      if (neverShow) {
        // Permanently dismissed for this version — persists across reloads
        setDismissedVersion(WHATS_NEW_VERSION);
      } else {
        // Session-only — plain local state, resets on next page load. (This
        // used to be faked with a sentinel string written to the persisted
        // store specifically so it wouldn't equal WHATS_NEW_VERSION — which
        // meant `shouldShow` above stayed true forever, the component never
        // unmounted, and its full-screen fixed overlay sat invisibly on top
        // of the whole app eating every touch/click until a reload.)
        setSessionDismissed(true);
      }
    }, 200);
  };

  return (
    <div className={`wn-overlay ${closing ? 'wn-overlay--out' : ''}`}>
      <div className={`wn-modal ${closing ? 'wn-modal--out' : ''}`}>

        {/* Header */}
        <div className="wn-header">
          <div className="wn-header-left">
            <div className="wn-eyebrow">
              <div className="wn-badge">v{WHATS_NEW_VERSION}</div>
              <span className="wn-eyebrow-text">What's New in StormView</span>
            </div>
            <div className="wn-title">{WHATS_NEW_NAME}</div>
          </div>
          <button className="wn-close" onClick={handleClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Feature list */}
        <div className="wn-body">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div className="wn-item" key={title}>
              <div className="wn-item-icon" style={{ color, background: bg }}>
                <Icon size={16} strokeWidth={2} />
              </div>
              <div className="wn-item-text">
                <div className="wn-item-title">{title}</div>
                <div className="wn-item-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="wn-footer">
          <label className="wn-checkbox-label">
            <input
              type="checkbox"
              className="wn-checkbox"
              checked={neverShow}
              onChange={(e) => setNeverShow(e.target.checked)}
            />
            <span>Don't show again until the next update</span>
          </label>
          <button className="wn-btn-close" onClick={handleClose}>
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}
