import L from 'leaflet';

/**
 * Main-thread side of the WebAssembly radar renderer: one shared worker
 * (radarWorker.js) plus a Leaflet tile layer that draws its bitmaps.
 */

let worker = null;
let failed = false;
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject }
const failureListeners = new Set();

/** Feature check: everything the worker path needs, including wasm SIMD. */
export const radarWasmSupported = (() => {
  try {
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined'
      || typeof DecompressionStream === 'undefined' || typeof createImageBitmap === 'undefined') return false;
    // Smallest module using a v128 instruction: (func (result v128) v128.const 0)
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 22, 1, 20, 0,
      253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11,
    ]));
  } catch {
    return false;
  }
})();

export function isRadarWasmAvailable() {
  return radarWasmSupported && !failed;
}

/** Called once if the worker can't start; callers switch to server tiles. */
export function onRadarWasmFailure(cb) {
  failureListeners.add(cb);
  return () => failureListeners.delete(cb);
}

function fail(message) {
  if (failed) return;
  failed = true;
  console.error(`Radar: WebAssembly renderer unavailable, using server tiles (${message})`);
  pending.forEach(({ reject }) => reject(new Error(message)));
  pending.clear();
  worker?.terminate();
  worker = null;
  failureListeners.forEach((cb) => cb());
}

function getWorker() {
  if (!worker && !failed) {
    worker = new Worker(new URL('./radarWorker.js', import.meta.url), { type: 'module' });
    worker.onerror = (e) => fail(e.message || 'worker error');
    worker.onmessage = ({ data }) => {
      if (data.type === 'failed') return fail(data.message);
      const req = pending.get(data.id);
      if (!req) {
        data.bitmap?.close();
        return;
      }
      pending.delete(data.id);
      if (data.type === 'tile') req.resolve(data.bitmap);
      else if (data.type === 'error') req.reject(new Error(data.message));
    };
  }
  return worker;
}

function requestTile(msg) {
  const id = nextId++;
  const promise = new Promise((resolve, reject) => {
    const w = getWorker();
    if (!w) return reject(new Error('WebAssembly renderer unavailable'));
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'render', id, ...msg });
  });
  return { id, promise };
}

/**
 * Background-download raw tiles for the given frames (URL templates, in the
 * order they'll play) at zoom `z` for the visible tile `coords`.  Replaces any
 * earlier prefetch list; an empty list stops prefetching.
 */
export function prefetchRadarTiles(templates, z, coords) {
  if (!worker && !templates.length) return;
  getWorker()?.postMessage({
    type: 'prefetch',
    templates,
    z,
    coords: coords.map(({ x, y }) => ({ x, y })),
  });
}

function cancelTile(id) {
  if (!pending.delete(id)) return;
  worker?.postMessage({ type: 'cancel', id });
}

/**
 * Tile layer for raw (scheme 255) LibreWXR tiles.  Each tile is a canvas the
 * worker's bitmap is transferred into (no copy, no main-thread pixel work).
 * Options: everything L.TileLayer takes, plus `colorScheme`.
 */
export const WasmRadarTileLayer = L.TileLayer.extend({
  initialize(url, options) {
    L.TileLayer.prototype.initialize.call(this, url, options);
    // Tiles leaving the view stop their fetch + render.
    const cancel = (e) => {
      if (e.tile._radarReq) cancelTile(e.tile._radarReq);
    };
    this.on('tileunload', cancel);
    this.on('tileabort', cancel);
  },

  createTile(coords, done) {
    const tile = document.createElement('canvas');
    tile.setAttribute('role', 'presentation');
    // Leaflet's zoom-change abort drops any tile without `complete` set, which
    // would blank finished canvases mid-animation (it's meant for <img>).
    tile.complete = false;

    const { id, promise } = requestTile({
      template: this._url,
      z: this._getZoomForUrl(),
      x: coords.x,
      y: coords.y,
      scheme: this.options.colorScheme,
    });
    tile._radarReq = id;

    promise.then(
      (bitmap) => {
        tile._radarReq = null;
        tile.complete = true;
        if (bitmap) tile.getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
        done(null, tile);
      },
      (err) => {
        tile._radarReq = null;
        tile.complete = true;
        done(err, tile);
      },
    );
    return tile;
  },
});
