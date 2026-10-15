/* stormcastapi Radar API — mirrors the RainViewer v2 API structure exactly */

const API_BASE    = 'https://api.librewxr.net/public/weather-maps.json';
// Always derive tile host from the configured API URL.
// data.host from LibreWXR typically returns localhost or a LAN IP — both are
// unreachable from the browser, or blocked as HTTP mixed-content on HTTPS.
const SERVER_BASE = API_BASE.replace('/public/weather-maps.json', '');

/**
 * Fetches available radar frames from the stormcastapi API.
 * Returns a normalized array of frame objects sorted oldest→newest.
 * Each frame: { time, path, host, type: 'past'|'nowcast' }
 */
export async function fetchRadarFrames(signal) {
  const res = await fetch(API_BASE, { cache: 'no-cache', signal });
  if (!res.ok) throw new Error(`stormcastapi API error: ${res.status}`);
  const data = await res.json();

  const host = SERVER_BASE;
  const frames = [];

  if (data.radar?.past) {
    for (const f of data.radar.past) {
      frames.push({ time: f.time, path: f.path, host, type: 'past' });
    }
  }

  if (data.radar?.nowcast) {
    for (const f of data.radar.nowcast) {
      frames.push({ time: f.time, path: f.path, host, type: 'nowcast' });
    }
  }

  frames.sort((a, b) => a.time - b.time);
  return frames;
}

/**
 * Builds the tile URL for a given radar frame.
 * size: 256 or 512
 * colorScheme: 0–11 (or 255 for raw grayscale) — LibreWXR color scheme IDs
 * smooth: 1 (enabled) or 0
 * snow: 1 (show snow colors) or 0
 */
export const RADAR_TILE_SIZE   = 512;
export const RADAR_ZOOM_OFFSET = -1; // requests tiles at z-1, giving 4× fewer tiles per frame

export function getRadarTileUrl({ host, path, size = RADAR_TILE_SIZE, colorScheme = 7, smooth = 1, snow = 1, arrows = null }) {
  const base = `${host}${path}/${size}/{z}/{x}/{y}/${colorScheme}/${smooth}_${snow}.png`;
  return arrows ? `${base}?arrows=${arrows}` : base;
}

/**
 * Raw reflectivity tile for the on-device (WebAssembly) renderer: color scheme
 * 255 with server smoothing and snow off.  Pixel value v encodes dBZ = v/2 - 32;
 * the client colors and smooths it, so one URL serves every color scheme.
 */
export function getRawRadarTileUrl({ host, path, size = RADAR_TILE_SIZE }) {
  return getRadarTileUrl({ host, path, size, colorScheme: 255, smooth: 0, snow: 0 });
}

/**
 * Returns a human-readable label for a radar frame timestamp.
 */
export function getFrameLabel(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
