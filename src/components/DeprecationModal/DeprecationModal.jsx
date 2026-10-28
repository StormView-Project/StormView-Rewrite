import { AlertTriangle, ExternalLink } from 'lucide-react';
import './DeprecationModal.css';

export function DeprecationModal({ onContinue }) {
  return (
    <div className="dm-overlay">
      <div className="dm-modal" role="dialog" aria-modal="true" aria-labelledby="dm-heading">
        <div className="dm-icon">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </div>
        <div className="dm-label">Deprecated</div>
        <h2 className="dm-heading" id="dm-heading">StormView is deprecated</h2>
        <p className="dm-desc">
          StormView is no longer being developed. Please use SkyView instead,
          now available at <strong>weather.nyxdev.app</strong>.
        </p>
        <div className="dm-actions">
          <a
            className="dm-btn dm-btn--accent"
            href="https://weather.nyxdev.app"
            rel="noopener noreferrer"
          >
            Go to SkyView
            <ExternalLink size={12} strokeWidth={2} className="dm-btn-ext" />
          </a>
          <button className="dm-btn dm-btn--ghost" onClick={onContinue}>
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
