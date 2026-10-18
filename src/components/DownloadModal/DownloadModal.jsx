import { useEffect, useState } from 'react';
import {
  X, Download, Laptop, Smartphone, TabletSmartphone, Monitor, Terminal,
  ExternalLink, Share, SquarePlus, ChevronLeft,
} from 'lucide-react';
import '../BetaModal/BetaModal.css';
import './DownloadModal.css';

const GITHUB_ORG = 'StormView-Project';

/* Native apps published as GitHub releases. `asset` picks the download from
   the latest release; if the GitHub API can't be reached, the button falls
   back to the release page. */
const RELEASE_APPS = {
  macos:   { repo: 'StormView-MacOS',      asset: /\.(dmg|zip)$/i },
  android: { repo: 'StormView-AndroidApp', asset: /\.apk$/i },
};

const releasePage = (repo) => `https://github.com/${GITHUB_ORG}/${repo}/releases/latest`;

/** Resolves each app's latest release asset: { macos: { url, tag }, ... } */
function useLatestReleases() {
  const [releases, setReleases] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    Object.entries(RELEASE_APPS).forEach(async ([id, { repo, asset }]) => {
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repo}/releases/latest`,
          { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const file = data.assets?.find((a) => asset.test(a.name));
        if (file) {
          setReleases((r) => ({ ...r, [id]: { url: file.browser_download_url, tag: data.tag_name } }));
        }
      } catch {
        // Offline / rate-limited — the release-page fallback still works.
      }
    });
    return () => controller.abort();
  }, []);

  return releases;
}

function PlatformRow({ icon: Icon, name, desc, children }) {
  return (
    <div className="dm-row">
      <div className="dm-row-icon"><Icon size={18} strokeWidth={1.8} /></div>
      <div className="dm-row-text">
        <div className="dm-row-name">{name}</div>
        <div className="dm-row-desc">{desc}</div>
      </div>
      <div className="dm-row-action">{children}</div>
    </div>
  );
}

function ReleaseButton({ id, release }) {
  const { repo } = RELEASE_APPS[id];
  return (
    <a
      className="bm-btn bm-btn--accent dm-btn"
      href={release?.url ?? releasePage(repo)}
      target="_blank"
      rel="noopener noreferrer"
      title={release ? `Download ${release.tag}` : 'Open the latest release on GitHub'}
    >
      <Download size={13} strokeWidth={2.2} />
      Download
    </a>
  );
}

/** Step-by-step "Add to Home Screen" instructions for iPhone / iPad. */
function IosInstallModal({ onClose, onBack }) {
  const steps = [
    { icon: Smartphone, text: <>Open <strong>StormView</strong> in <strong>Safari</strong> on your iPhone or iPad.</> },
    { icon: Share, text: <>Tap the <strong>Share</strong> button — the square with an arrow pointing up, in the toolbar.</> },
    { icon: SquarePlus, text: <>Scroll down the share menu and tap <strong>Add to Home Screen</strong>.</> },
    { icon: Download, text: <>Tap <strong>Add</strong>. StormView now opens from your home screen like a regular app.</> },
  ];

  return (
    <div className="bm-overlay dm-overlay--top" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bm-modal">
        <button className="bm-close" onClick={onClose} aria-label="Close">
          <X size={15} strokeWidth={2} />
        </button>

        <div className="bm-top">
          <button className="dm-back" onClick={onBack}>
            <ChevronLeft size={14} strokeWidth={2} />
            All downloads
          </button>
          <div className="bm-top-label">iPhone &amp; iPad</div>
          <h2 className="bm-top-heading">Add StormView to your Home Screen</h2>
        </div>

        <ol className="dm-steps">
          {steps.map(({ icon: Icon, text }, i) => (
            <li className="dm-step" key={i}>
              <div className="dm-step-num">{i + 1}</div>
              <div className="dm-step-text">{text}</div>
              <Icon size={16} strokeWidth={1.8} className="dm-step-icon" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function DownloadModal({ onClose }) {
  const releases = useLatestReleases();
  const [showIos, setShowIos] = useState(false);

  return (
    <>
      <div className="bm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bm-modal">
          <button className="bm-close" onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={2} />
          </button>

          <div className="bm-top">
            <div className="bm-top-icon">
              <Download size={20} strokeWidth={1.8} />
            </div>
            <div className="bm-top-label">Get the App</div>
            <h2 className="bm-top-heading">Download StormView</h2>
            <p className="bm-top-desc">
              Take live radar and weather alerts with you, on desktop and mobile.
            </p>
          </div>

          <div className="dm-list">
            <PlatformRow icon={Laptop} name="macOS" desc="Unzip, then drag StormView into Applications.">
              <ReleaseButton id="macos" release={releases.macos} />
            </PlatformRow>

            <PlatformRow icon={Smartphone} name="Android" desc="May not be possible to install anymore due to Google being Google.">
              <ReleaseButton id="android" release={releases.android} />
            </PlatformRow>

            <PlatformRow icon={TabletSmartphone} name="iPhone & iPad" desc="Install from Safari as a Home Screen app.">
              <button className="bm-btn bm-btn--ghost dm-btn" onClick={() => setShowIos(true)}>
                How to install
              </button>
            </PlatformRow>

            <PlatformRow icon={Monitor} name="Windows" desc="Coming soon">
              <span className="dm-soon">Soon</span>
            </PlatformRow>

            <PlatformRow icon={Terminal} name="Linux" desc="Coming soon">
              <span className="dm-soon">Soon</span>
            </PlatformRow>
          </div>

          <div className="dm-footer">
            Desktop and Android builds come from
            <a href={`https://github.com/${GITHUB_ORG}`} target="_blank" rel="noopener noreferrer">
              StormView-Project on GitHub <ExternalLink size={10} strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>

      {showIos && <IosInstallModal onClose={onClose} onBack={() => setShowIos(false)} />}
    </>
  );
}
