import { Layer } from './Layer.js';
import { LRUCache } from '../utils/lru-cache.js';
import { GISUtils } from '../utils/gis.js';
import { TILE_SIZE, TILE_TTL, TILE_LOAD_TIMEOUT_MS, MAX_LATITUDE, MIN_LATITUDE } from '../utils/constants.js';

// TileLayer with LRU cache, queue, concurrency control and fetch customization
export class TileLayer extends Layer {
  constructor(urlTemplate, options = {}) {
    super(options);
    this.urlTemplate = urlTemplate;
    this.options = {
      minZoom: options.minZoom || 0,
      maxZoom: options.maxZoom || 18,
      attribution: options.attribution || '',
      background: options.background || '#ffffff',
      supportsRetina: options.supportsRetina || false,
      maxCacheSize: options.maxCacheSize || 800,
      tileLoader: options.tileLoader || null, // optional custom loader: async (url, key, signal) => ({ img, blobUrl })
      errorTileUrl: options.errorTileUrl || '',
      ...options
    };
    this.tileCache = new LRUCache(this.options.maxCacheSize);
    this.loadingTiles = new Set();
    this.loadingControllers = new Map();
    this._lastRenderedCenter = null;
    this._lastRenderedZoom = null;
    this._lastRenderedBearing = null;
    this._lastVelocity = { x: 0, y: 0 };
    this._lastVelocityTime = 0;
    this._isPanningFast = false;
    this._loadingQueue = [];
    // concurrency tuned by device memory
    const deviceMemory = navigator.deviceMemory || 4;
    if (deviceMemory >= 8) this._maxConcurrentLoads = 12;
    else if (deviceMemory >= 4) this._maxConcurrentLoads = 8;
    else this._maxConcurrentLoads = 4;
    this._ongoingLoads = 0;
    this._concurrencyResetTimer = null;
  }
  // Tile URL builder with retina support and {s} / {r} / {scale} placeholders
  _getTileUrl(x, y, z, retinaScale = 1) {
    const scale = Math.pow(2, z);
    let wrappedX = ((x % scale) + scale) % scale;
    const intX = Math.floor(wrappedX);
    const intY = Math.max(0, Math.min(scale - 1, Math.floor(y)));
    let url = this.urlTemplate.replace('{z}', z).replace('{x}', intX).replace('{y}', intY);
    if (url.includes('{s}')) {
      // simple subdomain distribution
      const subdomainIndex = Math.abs(intX + intY + z) % 3;
      const subdomain = ['a', 'b', 'c'][subdomainIndex];
      url = url.replace('{s}', subdomain);
    }
    // retina placeholders
    if (url.includes('{r}')) {
      const rToken = (retinaScale > 1 && this.options.supportsRetina) ? '@2x' : '';
      url = url.replace('{r}', rToken);
    }
    if (url.includes('{scale}')) {
      url = url.replace('{scale}', retinaScale > 1 && this.options.supportsRetina ? '2' : '1');
    }
    // fallback: append scale suffix for common OSM pattern
    if (retinaScale > 1 && this.options.supportsRetina && url.includes('openstreetmap') && !url.includes('@2x')) {
      url = url.replace('.png', '@2x.png');
    }

    if (this.options.supportsWebP && this._map.supportsWebP) {
      url = url.replace('.png', '.webp');
    }

    return url;
  }
  // Default image-based loader (keeps crossOrigin and supports AbortController)
  async _defaultImageLoader(url, key, signal) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let aborted = false;
      img.crossOrigin = "anonymous";
      const onAbort = () => {
        aborted = true;
        img.onload = null;
        img.onerror = null;
        try { img.src = ''; } catch (e) {}
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      img.onload = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        if (aborted) return;
        resolve({ img, blobUrl: null });
      };
      img.onerror = (e) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        if (aborted) return;
        reject(e || new Error('Tile load error'));
      };
      img.src = url;
    });
  }
  async _performLoadJob(job) {
    const key = job.key;
    const url = job.url;
    const retinaScale = job.retinaScale || 1;
    // placeholder tile entry (so duplicates won't spawn extra loads)
    let existing = this.tileCache.peek(key);
    if (!existing) {
      existing = { img: null, loaded: false, loadedAt: 0, lastUsed: Date.now(), controller: null, blobUrl: null, loadingPromise: null };
      this.tileCache.set(key, existing);
    }
    this.loadingTiles.add(key);
    const controller = new AbortController();
    // copy the token to allow external abort on eviction
    this.loadingControllers.set(key, controller);
    // safety timeout
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch (e) {}
    }, TILE_LOAD_TIMEOUT_MS);
    const loader = this.options.tileLoader || this._defaultImageLoader.bind(this);
    this._ongoingLoads++;
    try {
      const result = await loader(url, key, controller.signal);
      clearTimeout(timeoutId);
      this.loadingTiles.delete(key);
      this.loadingControllers.delete(key);
      if (!result || !result.img) {
        // treat as failure
        this.tileCache.delete(key);
        this._ongoingLoads = Math.max(0, this._ongoingLoads - 1);
        this.fire('tileerror', { tile: key, url, error: new Error('Invalid tile loader result') });
        return;
      }
      // attach to cache entry (it may have been deleted by eviction)
      const tileEntry = this.tileCache.peek(key);
      if (!tileEntry) {
        // evicted while loading -> free resources
        if (result.blobUrl) URA.revokeObjectURL(result.blobUrl);
        this._ongoingLoads = Math.max(0, this._ongoingLoads - 1);
        return;
      }
      tileEntry.img = result.img;
      tileEntry.blobUrl = result.blobUrl || null;
      tileEntry.loaded = true;
      tileEntry.loadedAt = Date.now();
      tileEntry.lastUsed = Date.now();
      tileEntry.controller = null;
      tileEntry.loadingPromise = null;
      this.loadingTiles.delete(key);
      this.loadingControllers.delete(key);
      this._tileFadeIn(tileEntry);
      if (this._map) this._map.debouncedRender(16);
      this.fire('tileload', { tile: key, url });
    } catch (err) {
      clearTimeout(timeoutId);
      this.loadingTiles.delete(key);
      this.loadingControllers.delete(key);
      // If aborted by eviction or controller abort, swallow quietly
      if (err && err.name === 'AbortError') {
        this.tileCache.delete(key);
        this._ongoingLoads = Math.max(0, this._ongoingLoads - 1);
        return;
      }
      // normal error: remove placeholder and emit tileerror
      this.tileCache.delete(key);
      this.fire('tileerror', { tile: key, url, error: err });
      if (this.options.errorTileUrl) {
        this._fetchErrorTile(key);
      }
    } finally {
      this._ongoingLoads = Math.max(0, this._ongoingLoads - 1);
      // schedule next queued loads
      this._processQueue();
    }
  }
  _queueTileLoad(key, url, priority = 0, retinaScale = 1) {
    if (this.loadingTiles.has(key)) return;
    // don't queue if already in queue
    if (this._loadingQueue.some(item => item.key === key)) return;

    const [z, x, y] = key.split('/').map(Number);
    const center = this._map.getCenter();
    const centerTile = this._map.lonLatToTile(center.lon, center.lat, z);
    const dx = x - centerTile.x;
    const dy = y - centerTile.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this._loadingQueue.push({ key, url, priority: priority - distance, retinaScale });
    // sort by priority (higher first)
    this._loadingQueue.sort((a, b) => b.priority - a.priority);
    this._processQueue();
  }
  _processQueue() {
    while (this._ongoingLoads < this._maxConcurrentLoads && this._loadingQueue.length > 0) {
      const next = this._loadingQueue.shift();
      // start load
      this._performLoadJob(next);
    }
  }
  _evict() {
    if (this.tileCache.size <= this.options.maxCacheSize) return;
    // avoid heavy work on main thread if idle callback available
    if ('requestIdleCallback' in window) requestIdleCallback(() => this._performEviction(), { timeout: 2000 });
    else setTimeout(() => this._performEviction(), 100);
  }
  _performEviction() {
    if (this.tileCache.size <= this.options.maxCacheSize || !this._map) return;
    const initialSize = this.tileCache.size;
    const toRemove = Math.max(0, initialSize - this.options.maxCacheSize);
    if (toRemove <= 0) return;
    const zInt = Math.floor(this._map.zoom);
    const scaleFactor = Math.pow(2, this._map.zoom - zInt);
    const ts = TILE_SIZE;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
    const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);
    const absCos = Math.abs(Math.cos(this._map.bearing)), absSin = Math.abs(Math.sin(this._map.bearing));
    const needW = w * absCos + h * absSin;
    const needH = w * absSin + h * absCos;
    const adaptiveBuffer = this._getAdaptiveTileBuffer();
    const cols = Math.ceil(needW / (ts * scaleFactor)) + adaptiveBuffer;
    const visibleLatSpan = MAX_LATITUDE - MIN_LATITUDE;
    const visibleLatPixels = h * absCos;
    const visibleLatDegrees = visibleLatSpan * (visibleLatPixels / h);
    const rows = Math.ceil(visibleLatDegrees / (TILE_SIZE * scaleFactor)) + adaptiveBuffer;
    const startX = Math.floor(ct.x - cols / 2);
    const startY = Math.floor(ct.y - rows / 2);
    const protectedKeys = new Set();
    for (let dx = 0; dx < cols; dx++) for (let dy = 0; dy < rows; dy++) protectedKeys.add(`${zInt}/${startX + dx}/${startY + dy}`);
    const zoom = this._map.zoom;
    const center = this._map.getCenter();
    const centerTile = this._map.lonLatToTile(center.lon, center.lat, zInt);

    const toEvict = [];
    for (const [key, tile] of this.tileCache.entries()) {
      if (protectedKeys.has(key)) continue;

      const [z, x, y] = key.split('/').map(Number);
      const dz = Math.abs(z - zoom);
      const dx = x - centerTile.x;
      const dy = y - centerTile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      toEvict.push({ key, tile, score: tile.lastUsed - dz * 1000 - distance * 100 });
    }

    toEvict.sort((a, b) => a.score - b.score);

    for (let i = 0; i < toRemove && i < toEvict.length; i++) {
      const { key, tile } = toEvict[i];
      this.tileCache.delete(key);

      const controller = this.loadingControllers.get(key);
      if (controller) {
        try { controller.abort(); } catch (e) {}
        this.loadingControllers.delete(key);
        this.loadingTiles.delete(key);
      }

      if (tile && tile.blobUrl) {
        try { URA.revokeObjectURL(tile.blobUrl); } catch (e) {}
      }
    }
  }
  _boostConcurrencyTemp(boost = 12, ms = 2000) {
    const original = this._maxConcurrentLoads;
    this._maxConcurrentLoads = Math.max(original, boost);
    if (this._concurrencyResetTimer) clearTimeout(this._concurrencyResetTimer);
    this._concurrencyResetTimer = setTimeout(() => { this._maxConcurrentLoads = original; this._concurrencyResetTimer = null; }, ms);
  }
  prefetchAround(center, zoom, buffer = 3, highPriority = false, delay = 0) {
    if (!this._map) return;
    if (delay > 0) {
      setTimeout(() => this._prefetchAroundImmediate(center, zoom, buffer, highPriority), delay);
      return;
    }
    this._prefetchAroundImmediate(center, zoom, buffer, highPriority);
  }
  _prefetchAroundImmediate(center, zoom, buffer, highPriority) {
    if (!this._map) return;
    const zInt = Math.floor(zoom);
    const scaleFactor = Math.pow(2, zoom - zInt);
    const ts = TILE_SIZE;
    const wrappedCenterLon = GISUtils.wrapLongitude(center.lon);
    const ct = this._map.projection.latLngToTile({ lat: center.lat, lon: wrappedCenterLon }, zInt);
    const cols = Math.ceil((this._map.canvas.width / this._map.dpr) / (ts * scaleFactor)) + buffer;
    const rows = Math.ceil((this._map.canvas.height / this._map.dpr) / (ts * scaleFactor)) + buffer;
    const startX = Math.floor(ct.x - cols / 2);
    const startY = Math.floor(ct.y - rows / 2);
    for (let dx = 0; dx < cols; dx++) {
      for (let dy = 0; dy < rows; dy++) {
        const X = startX + dx;
        const Y = startY + dy;
        const key = `${zInt}/${X}/${Y}`;
        const url = this._getTileUrl(X, Y, zInt);
        if (!this.tileCache.has(key) && !this.loadingTiles.has(key) && !this._loadingQueue.some(item => item.key === key)) {
          const priority = highPriority ? 10 : 0;
          this._queueTileLoad(key, url, priority);
        }
      }
    }
  }
  updatePanningVelocity(vx, vy) {
    const now = performance.now();
    const speed = Math.hypot(vx, vy);
    this._isPanningFast = speed > 0.5;
    this._lastVelocity = { x: vx, y: vy };
    this._lastVelocityTime = now;
    if (this._isPanningFast) this._boostConcurrencyTemp(12, 1500);
  }
  render() {
    if (!this._map) return;
    const retinaScale = this._map.dpr > 1 && this.options.supportsRetina ? 2 : 1;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const zInt = Math.floor(this._map.zoom);
    const scaleFactor = Math.pow(2, this._map.zoom - zInt);
    const ts = TILE_SIZE;
    const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
    const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);
    const absCos = Math.abs(Math.cos(this._map.bearing)), absSin = Math.abs(Math.sin(this._map.bearing));
    const needW = w * absCos + h * absSin;
    const needH = w * absSin + h * absCos;
    const adaptiveBuffer = this._getAdaptiveTileBuffer();
    const cols = Math.ceil(needW / (ts * scaleFactor)) + adaptiveBuffer;
    const visibleLatSpan = MAX_LATITUDE - MIN_LATITUDE;
    const visibleLatPixels = h * absCos;
    const visibleLatDegrees = visibleLatSpan * (visibleLatPixels / h);
    const rows = Math.ceil(visibleLatDegrees / (TILE_SIZE * scaleFactor)) + adaptiveBuffer;
    const startX = Math.floor(ct.x - cols / 2);
    const startY = Math.floor(ct.y - rows / 2);
    if (!this._renderTilesArray) this._renderTilesArray = [];
    else this._renderTilesArray.length = 0;
    const centerX = cols / 2, centerY = rows / 2;
    for (let dx = 0; dx < cols; dx++) for (let dy = 0; dy < rows; dy++) this._renderTilesArray.push({ X: startX + dx, Y: startY + dy, distSq: (dx - centerX) * (dx - centerX) + (dy - centerY) * (dy - centerY) });
    this._renderTilesArray.sort((a, b) => a.distSq - b.distSq);
    const ctx = this._map.ctx;
    ctx.save();
    // center
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this._map.bearing);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.imageSmoothingEnabled = false;
    for (const { X, Y } of this._renderTilesArray) {
      const key = `${zInt}/${X}/${Y}`;
      const url = this._getTileUrl(X, Y, zInt, retinaScale);
      let tile = this.tileCache.get(key);
      if (!tile) {
        // create a placeholder so duplicate queueing is prevented by _queueTileLoad
        this._queueTileLoad(key, url, 0, retinaScale);
        continue;
      }
      if (tile.loaded && tile.img) {
        try {
          // draw
          ctx.drawImage(tile.img, (X - ct.x) * ts, (Y - ct.y) * ts, ts, ts);
          tile.lastUsed = Date.now();
          // TTL reload check
          if (tile.loadedAt && (Date.now() - tile.loadedAt > TILE_TTL)) this._reloadTile(key, url, retinaScale);

          // draw
          ctx.drawImage(tile.img, (X - ct.x) * ts, (Y - ct.y) * ts, ts, ts);
          tile.lastUsed = Date.now();
          // TTL reload check
          if (tile.loadedAt && (Date.now() - tile.loadedAt > TILE_TTL)) this._reloadTile(key, url, retinaScale);
        } catch (err) {
          // drawing errors should not crash the render
        }
      }
    }
    ctx.restore();
    this._evict();
    this._preloadAdjacentZoomTiles();
    this._lastRenderedCenter = { ...this._map.center };
    this._lastRenderedZoom = this._map.zoom;
    this._lastRenderedBearing = this._map.bearing;
    // debug overlay (per-map setting if available)
    const debugEnabled = this._map && this._map._config && this._map._config.debug;
    if (debugEnabled) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#f00';
      ctx.fillText(`Zoom: ${this._map.zoom.toFixed(2)} | Bearing: ${this._map.bearing.toFixed(2)} | Tiles: ${this.tileCache.size} | Loading: ${this.loadingTiles.size}`, 10, 20);
      ctx.restore();
    }
  }
  _reloadTile(key, url, retinaScale = 1) {
    const existing = this.tileCache.peek(key);
    if (!existing) return;
    const token = key + "#r";
    if (this.loadingTiles.has(token)) return;
    const doReload = () => {
      const controller = new AbortController();
      const img = new Image();
      img.crossOrigin = "anonymous";
      this.loadingTiles.add(token);
      img.onload = () => {
        // replace underlying image (if tile entry still exists)
        const tile = this.tileCache.peek(key);
        if (tile) {
          tile.img = img;
          tile.loaded = true;
          tile.loadedAt = Date.now();
        }
        this.loadingTiles.delete(token);
        if (this._map) this._map.scheduleRender();
      };
      img.onerror = () => this.loadingTiles.delete(token);
      img.src = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(doReload, { timeout: 2000 });
    else setTimeout(doReload, 100);
  }
  _preloadAdjacentZoomTiles() {
    if (!this._map) return;
    const zInt = Math.floor(this._map.zoom);
    if (Math.abs(this._map.zoom - zInt) > 0.5) return;
    const nextZoom = Math.min(this.options.maxZoom, zInt + 1);
    const prevZoom = Math.max(this.options.minZoom, zInt - 1);
    const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
    const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);
    const ts = TILE_SIZE;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const adaptiveBuffer = this._getAdaptiveTileBuffer();
    const viewportTiles = Math.ceil(Math.max(w, h) / ts) + adaptiveBuffer;
    const retinaScale = this._map.dpr > 1 && this.options.supportsRetina ? 2 : 1;
    for (let dz of [prevZoom, nextZoom]) {
      if (dz === zInt) continue;
      const scaleDiff = Math.pow(2, dz - zInt);
      const startX = Math.floor(ct.x * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);
      const startY = Math.floor(ct.y * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);
      for (let dx = 0; dx < viewportTiles; dx++) for (let dy = 0; dy < viewportTiles; dy++) {
        const X = startX + dx, Y = startY + dy;
        const key = `${dz}/${X}/${Y}`;
        if (!this.tileCache.has(key) && !this.loadingTiles.has(key) && !this._loadingQueue.some(item => item.key === key)) {
          const url = this._getTileUrl(X, Y, dz, retinaScale);
          this._queueTileLoad(key, url, 0, retinaScale);
        }
      }
    }
  }
  onAdd() { this.fire('add'); }
  onRemove() {
    for (const controller of this.loadingControllers.values()) {
      try { controller.abort(); } catch (e) {}
    }
    this.loadingTiles.clear();
    this.loadingControllers.clear();
    for (const [key, tile] of this.tileCache.entries()) {
      if (tile && tile.blobUrl) {
        try { URA.revokeObjectURL(tile.blobUrl); } catch (e) {}
      }
    }
    this.tileCache.clear();
    this.fire('remove');
  }
  getAttribution() { return this.options.attribution; }
  getBackground() { return this.options.background; }
  getMinZoom() { return this.options.minZoom; }
  getMaxZoom() { return this.options.maxZoom; }
  _getAdaptiveTileBuffer() {
    let buffer = 3;
    const zoom = this._map ? this._map.zoom : 3;
    const deviceMemory = navigator.deviceMemory || 4;
    if (zoom <= 5) buffer = 1;
    else if (zoom <= 12) buffer = 2;
    else if (zoom <= 16) buffer = 3;
    else buffer = 4;
    if (deviceMemory < 2) buffer = Math.max(1, buffer - 1);
    else if (deviceMemory >= 8) buffer = Math.min(5, buffer + 1);
    if (this._isPanningFast) buffer = Math.min(5, buffer + 1);
    return Math.max(1, Math.min(5, buffer));
  }

  _tileFadeIn(tile) {
    tile.img.style.opacity = 0;
    setTimeout(() => {
      tile.img.style.transition = 'opacity 0.3s ease-in';
      tile.img.style.opacity = 1;
    }, 16);
  }

  _fetchErrorTile(key) {
    const img = new Image();
    img.onload = () => {
      this.tileCache.set(key, {
        img: img,
        loaded: true,
        loadedAt: Date.now(),
        lastUsed: Date.now(),
        error: true
      });
      if (this._map) this._map.scheduleRender();
    };
    img.src = this.options.errorTileUrl;
  }
}