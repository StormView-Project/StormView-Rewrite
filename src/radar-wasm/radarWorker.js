/**
 * Radar tile worker: fetches raw LibreWXR tiles, decodes + renders them with
 * WebAssembly (radarCore.js), and posts back ready-to-draw ImageBitmaps.
 *
 * Raw tiles are cached here by URL, independent of color scheme, so switching
 * schemes or replaying frames re-renders locally with no network traffic.
 *
 * Messages in:   { type: 'render', id, template, z, x, y, scheme }
 *                { type: 'cancel', id }
 *                { type: 'prefetch', templates, z, coords }  (background, low priority)
 * Messages out:  { type: 'ready' } | { type: 'failed', message }
 *                { type: 'tile', id, bitmap }   (bitmap null = transparent)
 *                { type: 'error', id, message }
 */
import wasmUrl from './radar.wasm?url';
import { createRadarCore, blurRadiusFor, EMPTY } from './radarCore.js';

const CACHE_BUDGET = 64 * 1024 * 1024; // decoded raw values, bytes
const PREFETCH_CONCURRENCY = 3;        // leave connections free for visible tiles

let core = null;
const coreReady = (async () => {
  let instance;
  try {
    ({ instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl)));
  } catch {
    // Some hosts serve .wasm without application/wasm; compile from bytes instead.
    const bytes = await (await fetch(wasmUrl)).arrayBuffer();
    ({ instance } = await WebAssembly.instantiate(bytes));
  }
  core = createRadarCore(instance);
})();

coreReady.then(
  () => postMessage({ type: 'ready' }),
  (err) => postMessage({ type: 'failed', message: String(err?.message ?? err) }),
);

/* ---- Raw tile cache: url -> { size, values (Uint8Array | EMPTY), block } ---- */

const cache = new Map();
let cacheBytes = 0;

function cacheGet(url) {
  const hit = cache.get(url);
  if (hit) { cache.delete(url); cache.set(url, hit); } // LRU touch
  return hit;
}

function cachePut(url, tile) {
  cache.set(url, tile);
  cacheBytes += tile.values.length;
  for (const [k, v] of cache) {
    if (cacheBytes <= CACHE_BUDGET) break;
    cache.delete(k);
    cacheBytes -= v.values.length;
  }
}

/* ---- In-flight fetches, shared between requests for the same URL ---- */

const inflight = new Map(); // url -> { promise, controller, refs }

async function decodeFallback(blob) {
  // Interlaced / 16-bit PNGs: let the browser decode, then read the R channel.
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const rgba = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  bmp.close();
  const values = new Uint8Array(bmp.width * bmp.height);
  let nonzero = 0;
  for (let i = 0; i < values.length; i++) {
    values[i] = rgba[i * 4 + 3] ? rgba[i * 4] : 0;
    if (values[i]) nonzero++;
  }
  return { size: bmp.width, values: nonzero ? values : null, block: 0 };
}

async function fetchRaw(url, signal, priority) {
  const res = await fetch(url, { signal, priority });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  await coreReady;
  const tile = (await core.decode(new Uint8Array(buf))) ?? (await decodeFallback(new Blob([buf])));
  return { ...tile, values: tile.values ?? EMPTY };
}

/** Starts (or joins) the fetch for `url`. `own` requests can cancel it. */
function loadRaw(url, own, priority = 'auto') {
  const hit = cacheGet(url);
  if (hit) return Promise.resolve(hit);
  let entry = inflight.get(url);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, refs: 0 };
    entry.promise = fetchRaw(url, controller.signal, priority)
      .then((tile) => { cachePut(url, tile); return tile; })
      .finally(() => { if (inflight.get(url) === entry) inflight.delete(url); });
    inflight.set(url, entry);
  }
  if (own) entry.refs++;
  return entry.promise;
}

function release(url) {
  const entry = inflight.get(url);
  if (entry && --entry.refs <= 0) {
    entry.controller.abort();
    inflight.delete(url);
  }
}

/* ---- Rendering ---- */

const tileUrl = (template, z, x, y) =>
  template.replace('{z}', z).replace('{x}', x).replace('{y}', y);

/* ---- Background prefetch of upcoming frames ---- */

let prefetchQueue = [];
let prefetchActive = 0;

function pumpPrefetch() {
  while (prefetchActive < PREFETCH_CONCURRENCY && prefetchQueue.length) {
    // Stop before prefetching would evict tiles we already have.
    if (cacheBytes > CACHE_BUDGET * 0.8) { prefetchQueue = []; return; }
    const url = prefetchQueue.shift();
    if (cache.has(url) || inflight.has(url)) continue;
    prefetchActive++;
    loadRaw(url, false, 'low')
      .catch(() => {})
      .finally(() => { prefetchActive--; pumpPrefetch(); });
  }
}

function prefetch({ templates, z, coords }) {
  const n = 1 << z;
  prefetchQueue = [];
  for (const template of templates) {
    for (const { x, y } of coords) {
      if (y >= 0 && y < n) prefetchQueue.push(tileUrl(template, z, ((x % n) + n) % n, y));
    }
  }
  pumpPrefetch();
}

/** Last block-size estimate per zoom, for tiles too sparse to measure. */
const blockByZoom = new Map();

/**
 * Value grid for a neighbour: cached -> use it; being fetched (usually by
 * another tile in the same view) -> wait for it; otherwise unknown (null),
 * which edge-replicates.  Off the top/bottom of the world it's empty.
 */
async function neighbour(template, z, x, y) {
  const n = 1 << z;
  if (y < 0 || y >= n) return EMPTY;
  const url = tileUrl(template, z, ((x % n) + n) % n, y);
  const hit = cacheGet(url);
  if (hit) return hit.values;
  const pending = inflight.get(url);
  if (!pending) return null;
  try { return (await pending.promise).values; } catch { return null; }
}

const live = new Map(); // request id -> url

async function render({ id, template, z, x, y, scheme }) {
  const url = tileUrl(template, z, x, y);
  live.set(id, url);
  try {
    const tile = await loadRaw(url, true);
    if (!live.has(id)) return;
    if (tile.values === EMPTY) {
      postMessage({ type: 'tile', id, bitmap: null });
      return;
    }

    // Yield once so render messages for neighbouring tiles queued behind this
    // one get to start their fetches; then stitch whatever is available.
    await new Promise((r) => setTimeout(r, 0));
    const grid = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        grid.push(dx || dy ? neighbour(template, z, x + dx, y + dy) : tile.values);
      }
    }
    const neighbours = await Promise.all(grid);
    if (!live.has(id)) return;

    if (tile.block) blockByZoom.set(z, tile.block);
    const block = tile.block || blockByZoom.get(z) || 1;
    const rgba = core.render(neighbours, tile.size, scheme, blurRadiusFor(block, tile.size));
    const bitmap = await createImageBitmap(new ImageData(rgba, tile.size, tile.size));
    if (!live.has(id)) { bitmap.close(); return; }
    postMessage({ type: 'tile', id, bitmap }, [bitmap]);
  } catch (err) {
    if (live.has(id)) postMessage({ type: 'error', id, message: String(err?.message ?? err) });
  } finally {
    live.delete(id);
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'render') {
    render(data);
  } else if (data.type === 'prefetch') {
    prefetch(data);
  } else if (data.type === 'cancel') {
    const url = live.get(data.id);
    if (url) {
      live.delete(data.id);
      release(url);
    }
  }
};
