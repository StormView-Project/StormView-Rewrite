import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getRadarTileUrl, getRawRadarTileUrl, RADAR_TILE_SIZE, RADAR_ZOOM_OFFSET } from '../../services/stormcast';
import { WasmRadarTileLayer, isRadarWasmAvailable, onRadarWasmFailure, prefetchRadarTiles } from '../../radar-wasm/radarRenderer';
import useAppStore from '../../store/useAppStore';

/**
 * Windowed radar renderer — keeps (KEEP_BEHIND + 1 + PRELOAD_AHEAD) frames on the map at once.
 * The window slides as the animation advances; evicted frames are removed so their
 * tile fetches stop. Browser HTTP cache makes replays near-instant.
 *
 * GPU acceleration:
 *   - Dedicated 'radar' pane → own compositor layer (will-change: transform)
 *   - Per-container will-change: opacity → GPU opacity compositing
 *   - img.decoding = 'async' → PNG decode off main thread
 *   - CSS opacity transitions in MapView.css → GPU-animated crossfade (optional)
 *
 * Two tile paths:
 *   - wasm:   raw reflectivity tiles (3-5x smaller, one URL for every color
 *             scheme), colored + smoothed on-device by WebAssembly in a worker
 *             (src/radar-wasm/).  Scheme changes and replays re-render from the
 *             worker's raw cache without touching the network.
 *   - server: finished PNGs from LibreWXR.  Used when motion arrows are on
 *             (drawn server-side), for snow colors (needs the server's model
 *             snow mask), or when the browser can't run the wasm renderer.
 */

const PRELOAD_AHEAD = 4;
const KEEP_BEHIND   = 1; // so stepping back a frame is instant, not a reload
const FRAME_TIMEOUT = 12_000;
const RADAR_PANE    = 'radar';

const TILE_OPTS = {
  opacity: 0,
  tileSize: RADAR_TILE_SIZE,
  zoomOffset: RADAR_ZOOM_OFFSET,
  pane: RADAR_PANE,
  keepBuffer: 0,
  updateWhenIdle: true,
  attribution: '© Stormcast',
};

/* ---- Layer helpers ---- */

function frameKey(frame, cs, tq, arrows, wasm) {
  return `${frame.path}:${cs}:${tq}:${arrows ?? 'none'}:${wasm ? 'wasm' : 'server'}`;
}

function getOrCreate(frame, cs, tq, arrows, wasm, cache) {
  const k = frameKey(frame, cs, tq, arrows, wasm);
  if (cache.has(k)) return [k, cache.get(k)];

  if (wasm) {
    const url = getRawRadarTileUrl({ host: frame.host, path: frame.path, size: tq });
    const layer = new WasmRadarTileLayer(url, { ...TILE_OPTS, colorScheme: cs });
    cache.set(k, layer);
    return [k, layer];
  }

  const url = getRadarTileUrl({ host: frame.host, path: frame.path, colorScheme: cs, size: tq, arrows });
  const layer = L.tileLayer(url, { ...TILE_OPTS });

  // Decode tile PNGs off the main thread (avoids render jank when tiles arrive)
  const origCreateTile = layer.createTile.bind(layer);
  layer.createTile = function(coords, done) {
    const img = origCreateTile(coords, done);
    img.decoding = 'async';
    return img;
  };

  cache.set(k, layer);
  return [k, layer];
}

/* ---- Component ---- */

export function RadarLayer() {
  const map         = useMap();
  const frames      = useAppStore((s) => s.radarFrames);
  const currentIdx  = useAppStore((s) => s.radarCurrentIdx);
  const cs          = useAppStore((s) => s.radarColorScheme);
  const tileQuality = useAppStore((s) => s.radarTileQuality);
  const opacity     = useAppStore((s) => s.radarOpacity);
  const showArrows  = useAppStore((s) => s.showArrows);
  const theme       = useAppStore((s) => s.theme);
  const renderer    = useAppStore((s) => s.radarRenderer);
  const frameFade   = useAppStore((s) => s.radarFrameFade);
  const setProgress = useAppStore((s) => s.setRadarTileProgress);
  const setReadyPaths = useAppStore((s) => s.setRadarReadyPaths);

  // dark UI → light arrows for contrast; light UI → dark arrows
  const isDark    = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const arrowStyle = showArrows ? (isDark ? 'light' : 'dark') : null;

  // Arrows are drawn into server tiles, so they force the server path.
  const [wasmAvailable, setWasmAvailable] = useState(isRadarWasmAvailable);
  useEffect(() => onRadarWasmFailure(() => setWasmAvailable(false)), []);
  const useWasm = renderer === 'wasm' && wasmAvailable && !arrowStyle;

  const cache       = useRef(new Map());
  const readyKeys   = useRef(new Set());
  const watchedKeys = useRef(new Set());
  const timeouts    = useRef(new Map());
  const activeKey   = useRef(null);
  const [viewEpoch, setViewEpoch] = useState(0);
  const moveTimer   = useRef(null);

  /* ---- Create dedicated GPU-composited pane (once per map instance) ---- */
  useEffect(() => {
    if (!map.getPane(RADAR_PANE)) {
      const pane = map.createPane(RADAR_PANE);
      pane.style.zIndex        = 250; // above base tiles (200), below vector overlays (400)
      pane.style.willChange    = 'transform';
      pane.style.pointerEvents = 'none';
    }
  }, [map]);

  /* ---- Crossfade between frames (CSS transition in MapView.css) ---- */
  useEffect(() => {
    map.getPane(RADAR_PANE)?.classList.toggle('radar-pane--fade', frameFade);
  }, [map, frameFade]);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => () => {
    clearTimeout(moveTimer.current);
    timeouts.current.forEach(id => clearTimeout(id));
    cache.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    cache.current.clear();
    readyKeys.current.clear();
    watchedKeys.current.clear();
    timeouts.current.clear();
    activeKey.current = null;
    setProgress(null);
    setReadyPaths(null);
    prefetchRadarTiles([], 0, []);
  }, [map, setProgress, setReadyPaths]);

  /* ---- Pan/zoom: stop stale requests, reload after settle, re-warm new viewport ---- */
  useEffect(() => {
    const onViewChange = () => {
      cache.current.forEach((layer, k) => {
        if (k !== activeKey.current && layer._map) {
          try { map.removeLayer(layer); } catch {}
        }
      });
      readyKeys.current.clear();
      watchedKeys.current.clear();
      useAppStore.getState().setRadarReadyPaths(new Set());
      timeouts.current.forEach(id => clearTimeout(id));
      timeouts.current.clear();
      clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => setViewEpoch(e => e + 1), 500);
    };
    map.on('moveend', onViewChange);
    map.on('zoomend', onViewChange);
    return () => {
      map.off('moveend', onViewChange);
      map.off('zoomend', onViewChange);
      clearTimeout(moveTimer.current);
    };
  }, [map]);

  /* ---- Windowed load: KEEP_BEHIND previous + current + PRELOAD_AHEAD next frames ---- */
  useEffect(() => {
    if (!frames.length) return;
    // Frames from the Open-Meteo source have no tile `path` — that layer renders them.
    if (frames[0]?.path == null) return;

    const n = frames.length;
    const offsets = [];
    for (let j = -KEEP_BEHIND; j <= PRELOAD_AHEAD; j++) offsets.push(j);
    const frameAt = (j) => frames[(((currentIdx + j) % n) + n) % n];

    const wanted = new Set();
    for (const j of offsets) {
      wanted.add(frameKey(frameAt(j), cs, tileQuality, arrowStyle, useWasm));
    }

    // Evict stale layers (snapshot first to avoid mutating Map during iteration)
    const stale = [...cache.current.keys()].filter(k => !wanted.has(k));
    stale.forEach(k => {
      try { map.removeLayer(cache.current.get(k)); } catch {}
      cache.current.delete(k);
      readyKeys.current.delete(k);
      watchedKeys.current.delete(k);
      clearTimeout(timeouts.current.get(k));
      timeouts.current.delete(k);
    });

    const t0 = Date.now();

    // Use wanted.size as the target so duplicate keys (circular wrap) don't
    // produce an unreachable completion count.
    const targetSize = wanted.size;

    const keyOf = (f) => frameKey(f, cs, tileQuality, arrowStyle, useWasm);

    // Once the window is loaded, have the worker fetch raw tiles for every other
    // frame in the background, so playback reaches them already downloaded
    // (rendering from local data then takes a few ms instead of a round trip).
    const prefetchRest = () => {
      const layer = cache.current.get(keyOf(frames[currentIdx]));
      if (!useWasm || !layer?._map) return;
      const coords = Object.values(layer._tiles).map((t) => t.coords);
      const ahead = [...frames.slice(currentIdx), ...frames.slice(0, currentIdx)];
      const templates = ahead
        .filter((f) => !wanted.has(keyOf(f)))
        .map((f) => getRawRadarTileUrl({ host: f.host, path: f.path, size: tileQuality }));
      prefetchRadarTiles(templates, layer._getZoomForUrl(), coords);
    };

    const reportProgress = () => {
      setReadyPaths(new Set(frames.filter((f) => readyKeys.current.has(keyOf(f))).map((f) => f.path)));
      const loaded = [...readyKeys.current].filter(k => wanted.has(k)).length;
      if (loaded >= targetSize) {
        setProgress(null);
        prefetchRest();
      } else {
        setProgress({ loadedTiles: loaded, totalTiles: targetSize,
          framesLoaded: loaded, framesTotal: targetSize, startTime: t0 });
      }
    };

    reportProgress();

    for (const j of offsets) {
      const frame = frameAt(j);
      const [k, layer] = getOrCreate(frame, cs, tileQuality, arrowStyle, useWasm, cache.current);

      if (!layer._map) {
        layer.addTo(map);
        const container = layer.getContainer?.();
        if (container) container.style.willChange = 'opacity';
      }

      if (!readyKeys.current.has(k) && !watchedKeys.current.has(k)) {
        watchedKeys.current.add(k);

        const markReady = () => {
          clearTimeout(timeouts.current.get(k));
          timeouts.current.delete(k);
          watchedKeys.current.delete(k);
          readyKeys.current.add(k);
          reportProgress();
        };

        // If the layer is already on the map and not loading, its `load` event
        // fired before we got here (during the pan/zoom debounce window).
        // Mark it ready immediately instead of waiting for an event that won't come.
        if (layer._map && !layer.isLoading()) {
          markReady();
        } else {
          layer.once('load', markReady);

          // Failsafe: if a tile hangs and load never fires, advance anyway
          const tid = setTimeout(() => {
            layer.off('load', markReady);
            console.error(`Radar: frame timed out after ${FRAME_TIMEOUT / 1000}s — tiles may not have loaded. Check the radar tile server.`);
            markReady();
          }, FRAME_TIMEOUT);
          timeouts.current.set(k, tid);
        }
      }
    }

    // Show current frame (CSS transition in MapView.css crossfades on GPU)
    const [k, layer] = getOrCreate(frames[currentIdx], cs, tileQuality, arrowStyle, useWasm, cache.current);
    if (activeKey.current && activeKey.current !== k) {
      cache.current.get(activeKey.current)?.setOpacity(0);
    }
    layer.setOpacity(useAppStore.getState().radarOpacity);
    activeKey.current = k;

  }, [map, frames, currentIdx, cs, tileQuality, arrowStyle, useWasm, setProgress, setReadyPaths, viewEpoch]);

  /* ---- Opacity slider ---- */
  useEffect(() => {
    if (activeKey.current) cache.current.get(activeKey.current)?.setOpacity(opacity);
  }, [opacity]);

  return null;
}
