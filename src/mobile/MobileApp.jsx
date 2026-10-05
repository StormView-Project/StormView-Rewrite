import { useState } from 'react';
import { MobileHome } from './MobileHome';
import { MobileRadar } from './MobileRadar';
import { MobileBottomNav } from './MobileBottomNav';

/**
 * Root of the dedicated mobile experience.
 *
 * The desktop app renders a full-screen map with a floating weather sidebar.
 * On phones we instead show a scrollable weather page (MobileHome) and let the
 * user jump into a focused radar view (MobileRadar) via the radar preview card
 * (or the persistent bottom nav) — two separate screens, never shown at once,
 * plus the always-visible bottom nav layered on top of both.
 */
export function MobileApp({ weatherData, loading, error, onRefresh }) {
  const [view, setView] = useState('home'); // 'home' | 'radar'

  return (
    <>
      {view === 'radar' ? (
        <MobileRadar onBack={() => setView('home')} />
      ) : (
        <MobileHome
          weatherData={weatherData}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
          onOpenRadar={() => setView('radar')}
        />
      )}
      <MobileBottomNav view={view} onNavigate={setView} />
    </>
  );
}
