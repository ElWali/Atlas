// --- Base Layer Class ---
const Atlas = window.Atlas || {};
Atlas.Layer = class {
  constructor(options = {}) {
    this.options = options;
    this._map = null;
    this._events = {};
  }

  addTo(map) {
    if (this._map) {
      this._map.removeLayer(this);
    }
    this._map = map;
    map.addLayer(this);
    return this;
  }

  remove() {
    if (this._map) {
      this._map.removeLayer(this);
      this._map = null;
    }
    return this;
  }

  on(type, fn) {
    if (!this._events[type]) {
      this._events[type] = [];
    }
    this._events[type].push(fn);
    return this;
  }

  off(type, fn) {
    if (!this._events[type]) return this;
    if (!fn) {
      this._events[type] = [];
    } else {
      this._events[type] = this._events[type].filter(cb => cb !== fn);
    }
    return this;
  }

  fire(type, data = {}) {
    if (!this._events[type]) return;
    data.type = type;
    data.target = this;
    this._events[type].forEach(fn => fn(data));
  }

  onAdd() { }
  onRemove() { }
  render() { }
}

// --- TileLayer Class (Updated to use Projection) ---
/**
 * Tile Layer for displaying map tiles
 *
 * @class TileLayer
 * @extends Layer
 * @example
 * const layer = new TileLayer(
 * 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
 * {
 * minZoom: 0,
 * maxZoom: 19,
 * attribution: '© OpenStreetMap'
 * }
 * );
 * map.addLayer(layer);
 */
class TileLayer extends Layer {
  /**
 * Creates a tile layer
 *
 * @param {string} urlTemplate - Tile URL template with {z}, {x}, {y}
 * @param {TileLayerOptions} [options={}] - Configuration options
 * @param {number} [options.minZoom=0] - Minimum zoom level
 * @param {number} [options.maxZoom=18] - Maximum zoom level
 * @param {string} [options.attribution] - Attribution text/HTML
 * @param {string} [options.background='#ffffff'] - Background color
 * @param {boolean} [options.supportsRetina=false] - Retina tile support
 * @param {number} [options.maxCacheSize=500] - Max tiles in memory
 * @throws {Error} If URL template is invalid
 *
 * @example
 * const layer = new TileLayer(
 * 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
 * );
 */
  constructor(urlTemplate, options = {}) {
    // NEW: Validate options
    const optionResult = ConfigValidator.validate(options, TILE_LAYER_SCHEMA);
    if (optionResult.errors.length > 0) {
      console.error('[Atlas] TileLayer option errors:', optionResult.errors);
      throw new Error(`TileLayer validation failed: ${optionResult.errors[0].message}`);
    }
    super(options);
    this.urlTemplate = urlTemplate;
    this.options = {
      minZoom: options.minZoom || 0,
      maxZoom: options.maxZoom || 18,
      attribution: options.attribution || '',
      background: options.background || '#ffffff',
      supportsRetina: options.supportsRetina || false,
      maxCacheSize: options.maxCacheSize || 500,
      ...options
    };
    this.tileCache = new Map();
    this.loadingTiles = new Set();
    this.loadingControllers = new Map();
    this._retinaAvailable = true;
    this._tileErrorMap = new Map();
    this._failedTiles = new Set();
    this._maxTileRetries = 3;
    this._memoryManager = null;
  }

  _getTileUrl(x, y, z) {
    const scale = Math.pow(2, z);
    // Robustly wrap the X coordinate to [0, scale)
    let wrappedX = ((x % scale) + scale) % scale;
    const intX = Math.floor(wrappedX);
    const intY = Math.max(0, Math.min(scale - 1, Math.floor(y)));
    let url = this.urlTemplate.replace('{z}', z).replace('{x}', intX).replace('{y}', intY);
    if (this.options.supportsRetina && this._shouldRequestRetina()) {
      url += CONFIG.retinaSuffix;
    }
    return url;
  }

  _shouldRequestRetina() {
    const mode = CONFIG.retina;
    const want = (mode === true) || (mode === "auto" && (window.devicePixelRatio || 1) > 1.5);
    return want && this._retinaAvailable;
  }

  async _loadTile(key, url) {
    if (this.tileCache.has(key)) return this.tileCache.get(key);
    const controller = new AbortController();
    const signal = controller.signal;
    this.loadingControllers.set(key, controller);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const tile = { img, loaded: false, loadedAt: Date.now(), lastUsed: Date.now(), controller };
    this.tileCache.set(key, tile);
    if (this._memoryManager) {
      this._memoryManager.trackTile(key, tile);
    }
    this.loadingTiles.add(key);
    const startTime = performance.now();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (this.loadingTiles.has(key)) {
          controller.abort();
          const error = ErrorFactory.create('tile', 'Tile load timeout', {
            tileKey: key,
            url,
            context: { timeoutMs: TILE_LOAD_TIMEOUT_MS, loadTime: performance.now() - startTime }
          });
          reject(error);
        }
      }, TILE_LOAD_TIMEOUT_MS);
    });
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = () => {
        clearTimeout(timeoutId);
        const loadTime = performance.now() - startTime;
        // Validate image
        try {
          if (img.width === 0 || img.height === 0) {
            throw new Error('Invalid image dimensions');
          }
          tile.loaded = true;
          tile.loadedAt = Date.now();
          this.loadingTiles.delete(key);
          this.loadingControllers.delete(key);
          this._tileErrorMap.delete(key); // Clear error tracking
          console.log(`[Atlas] Tile ${key} loaded in ${loadTime.toFixed(2)}ms`);
          if (this._map) {
            this._map.scheduleRender();
          }
          this.fire('tileload', { tile: key, url, loadTime });
          resolve(tile);
        } catch (validationError) {
          reject(ErrorFactory.create('tile', validationError.message, {
            tileKey: key,
            url,
            context: { validationError: validationError.message }
          }));
        }
      };
      img.onerror = (e) => {
        clearTimeout(timeoutId);
        if (signal.aborted) return;
        const error = ErrorFactory.create('tile', `Failed to load tile: ${url}`, {
          tileKey: key,
          url,
          context: { errorEvent: e?.toString?.(), retryCount: this._getRetryCount(key) }
        });
        // Track error for this tile
        this._trackTileError(key, error);
        // Check if should retry
        if (this._shouldRetryTile(key, error)) {
          console.log(`[Atlas] Retrying tile ${key}...`);
          this.fire('tileretry', { tile: key, url, error });
          // Retry with exponential backoff
          setTimeout(() => {
            if (!this.loadingTiles.has(key)) return;
            this._loadTile(key, url);
          }, this._getRetryDelay(key));
        } else {
          // Load fallback or placeholder
          if (this.options.supportsRetina && url.includes(CONFIG.retinaSuffix)) {
            const nonRetinaUrl = url.replace(CONFIG.retinaSuffix, "");
            console.log(`[Atlas] Retina not available, trying standard: ${nonRetinaUrl}`);
            img.src = nonRetinaUrl;
            return;
          }
          this._handleTileFailure(key, error);
          this.loadingTiles.delete(key);
          this.loadingControllers.delete(key);
          reject(error);
        }
      };
      img.src = url;
    });
    try {
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      if (!signal.aborted) {
        if (this._map?._errorHandler) {
          await this._map._errorHandler.handle(error, `TileLayer._loadTile(${key})`);
        } else {
          console.error("[Atlas] Tile loading failed:", error.message);
        }
      }
      throw error;
    }
    return tile;
  }

  _reloadTile(key, url) {
    const existing = this.tileCache.get(key);
    if (!existing) return;
    const token = key + "#r";
    if (this.loadingTiles.has(token)) return;

    const doReload = () => {
      const controller = new AbortController();
      const img = new Image();
      img.crossOrigin = "anonymous";
      this.loadingTiles.add(token);

      img.onload = () => {
        existing.img = img;
        existing.loaded = true;
        existing.loadedAt = Date.now();
        this.loadingTiles.delete(token);
        if (this._map) {
          this._map.scheduleRender();
        }
      };

      img.onerror = () => {
        this.loadingTiles.delete(token);
      };

      img.src = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(doReload, { timeout: 2000 });
    } else {
      setTimeout(doReload, 100);
    }
  }

  _evict() {
    if (this.tileCache.size <= this.options.maxCacheSize) return;
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this._performEviction(), { timeout: 2000 });
    } else {
      setTimeout(() => this._performEviction(), 100);
    }
  }

  _performEviction() {
    if (this._memoryManager) {
      const toEvict = this._memoryManager.getEvictionCandidates();
      toEvict.forEach(key => {
        this.tileCache.delete(key);
      });
      return;
    }
    // Fallback to original logic
    if (this.tileCache.size <= this.options.maxCacheSize) return;
    const entries = Array.from(this.tileCache.entries());
    entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const removeCount = this.tileCache.size - this.options.maxCacheSize;
    for (let i = 0; i < removeCount; i++) {
      this.tileCache.delete(entries[i][0]);
    }
  }

  _preloadAdjacentZoomTiles() {
    if (!this._map) return;
    const zInt = Math.floor(this._map.zoom);
    const nextZoom = Math.min(this.options.maxZoom, zInt + 1);
    const prevZoom = Math.max(this.options.minZoom, zInt - 1);

    if (Math.abs(this._map.zoom - zInt) > 0.3) return;

    // Use wrapped longitude to prevent loading tiles from adjacent worlds
    const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
    const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);
    const ts = TILE_SIZE;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const viewportTiles = Math.ceil(Math.max(w, h) / ts) + TILE_BUFFER;

    for (let dz of [prevZoom, nextZoom]) {
      if (dz === zInt) continue;
      const scaleDiff = Math.pow(2, Math.abs(dz - zInt));
      const startX = Math.floor(ct.x * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);
      const startY = Math.floor(ct.y * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);

      for (let dx = 0; dx < viewportTiles; dx++) {
        for (let dy = 0; dy < viewportTiles; dy++) {
          const X = startX + dx, Y = startY + dy;
          const key = `${dz}/${X}/${Y}`;
          if (!this.tileCache.has(key) && !this.loadingTiles.has(key)) {
            const url = this._getTileUrl(X, Y, dz);
            this._loadTile(key, url);
          }
        }
      }
    }
  }

  render() {
    if (!this._map) return;

    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const zInt = Math.floor(this._map.zoom);
    const scaleFactor = Math.pow(2, this._map.zoom - zInt);
    const ts = TILE_SIZE;

    // Use wrapped longitude to anchor the tile grid, preventing "split world" artifacts
    const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
    const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);

    const absCos = Math.abs(Math.cos(this._map.bearing)), absSin = Math.abs(Math.sin(this._map.bearing));
    const needW = w * absCos + h * absSin;
    const needH = w * absSin + h * absCos;

    const cols = Math.ceil(needW / (ts * scaleFactor)) + TILE_BUFFER;
    const rows = Math.ceil(needH / (ts * scaleFactor)) + TILE_BUFFER;

    const startX = Math.floor(ct.x - cols / 2);
    const startY = Math.floor(ct.y - rows / 2);

    const tiles = [];
    for (let dx = 0; dx < cols; dx++) {
      for (let dy = 0; dy < rows; dy++) {
        const X = startX + dx, Y = startY + dy;
        const dist = Math.hypot(dx - cols / 2, dy - rows / 2);
        tiles.push({ X, Y, dist });
      }
    }

    tiles.sort((a, b) => a.dist - b.dist);

    const ctx = this._map.ctx;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this._map.bearing);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.imageSmoothingEnabled = false;

    for (const { X, Y } of tiles) {
      const key = `${zInt}/${X}/${Y}`;
      const url = this._getTileUrl(X, Y, zInt);
      const trX = (X - ct.x) * ts;
      const trY = (Y - ct.y) * ts;

      let tile = this.tileCache.get(key);
      if (!tile) {
        this._loadTile(key, url);
      } else if (tile.loaded) {
        ctx.drawImage(tile.img, trX, trY, ts, ts);
        tile.lastUsed = Date.now();
        if (tile.loadedAt && (Date.now() - tile.loadedAt > TILE_TTL)) {
          this._reloadTile(key, url);
        }
      }
    }

    ctx.restore();
    this._evict();
    this._preloadAdjacentZoomTiles();
  }

  onAdd() {
    // NEW: Initialize memory manager
    if (!this._memoryManager && this._map) {
      this._memoryManager = new MemoryManager({
        maxTiles: this.options.maxCacheSize,
        metricsCollector: this._map._performanceMonitor?._collector
      });
      this._memoryManager.startMonitoring();
    }
    this.fire('add');
  }

  onRemove() {
    // NEW: Clean up memory manager
    if (this._memoryManager) {
      this._memoryManager.destroy();
      this._memoryManager = null;
    }
    // ... existing cleanup ...
    for (const controller of this.loadingControllers.values()) {
      controller.abort();
    }
    this.loadingTiles.clear();
    this.loadingControllers.clear();
    this.tileCache.clear();
    this.fire('remove');
  }

  /**
 * Track tile loading errors
 * @private
 */
  _trackTileError(key, error) {
    if (!this._tileErrorMap.has(key)) {
      this._tileErrorMap.set(key, []);
    }
    this._tileErrorMap.get(key).push({ error: error.message, code: error.code, timestamp: Date.now() });
  }

  /**
 * Get retry count for a tile
 * @private
 */
  _getRetryCount(key) {
    const errors = this._tileErrorMap.get(key) || [];
    return errors.length;
  }

  /**
 * Determine if should retry tile
 * @private
 */
  _shouldRetryTile(key, error) {
    const retryCount = this._getRetryCount(key);
    // Don't retry 404s or authorization errors
    if (error.statusCode === 404 || error.statusCode === 403) {
      return false;
    }
    return retryCount < this._maxTileRetries;
  }

  /**
 * Get retry delay with exponential backoff
 * @private
 */
  _getRetryDelay(key) {
    const retryCount = this._getRetryCount(key);
    return Math.min(100 * Math.pow(2, retryCount), 3000);
  }

  /**
 * Handle tile failure gracefully
 * @private
 */
  _handleTileFailure(key, error) {
    this._failedTiles.add(key);
    console.warn(`[Atlas] Tile failed after retries: ${key}`, error.message);
    this.fire('tileerror', { tile: key, error, canRetry: false, failedAfterRetries: true });
    // Create placeholder/fallback tile
    this._createFallbackTile(key);
  }

  /**
 * Create fallback tile for failed loads
 * @private
 */
  _createFallbackTile(key) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = TILE_SIZE;
    fallbackCanvas.height = TILE_SIZE;
    const ctx = fallbackCanvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#999';
    ctx.font = '12px Arial';
    ctx.fillText('Error', 10, 20);
    ctx.fillText(key, 10, 35);
    const tile = this.tileCache.get(key);
    if (tile) {
      tile.img = fallbackCanvas;
      tile.loaded = true;
      tile.isFallback = true;
    }
  }

  /**
 * Get tile error stats
 */
  getTileErrorStats() {
    return {
      failedTiles: Array.from(this._failedTiles),
      errorMap: Object.fromEntries(this._tileErrorMap),
      totalErrors: Array.from(this._tileErrorMap.values()).reduce((a, b) => a + b.length, 0)
    };
  }

  /**
 * NEW: Get memory statistics
 */
  getMemoryStats() {
    if (this._memoryManager) {
      return this._memoryManager.getMemoryStats();
    }
    return {};
  }

  /**
 * Gets tile attribution
 *
 * @returns {string} Attribution HTML/text
 */
  getAttribution() {
    return this.options.attribution;
  }

  getBackground() {
    return this.options.background;
  }

  getMinZoom() {
    return this.options.minZoom;
  }

  getMaxZoom() {
    return this.options.maxZoom;
  }
}

/**
 * GeoJSON vector layer
 *
 * @class GeoJSONLayer
 * @extends Layer
 * @example
 * const layer = new GeoJSONLayer({
 * type: 'FeatureCollection',
 * features: [...]
 * }, {
 * interactive: true,
 * style: { color: '#ff7800' }
 * });
 *
 * layer.on('click', (e) => {
 * console.log('Clicked:', e.feature.properties);
 * });
 *
 * map.addLayer(layer);
 */
class GeoJSONLayer extends Layer {
  /**
 * Creates a GeoJSON layer
 *
 * @param {GeoJSON} geojson - GeoJSON data (Feature, FeatureCollection, or Geometry)
 * @param {GeoJSONLayerOptions} [options={}] - Configuration options
 * @param {Function|object} [options.style] - Style function or object
 * @param {boolean} [options.interactive=true] - Enable interaction
 * @param {boolean} [options.validateStrict=true] - Strict GeoJSON validation
 * @param {boolean} [options.autoRepair=false] - Auto-repair invalid GeoJSON
 * @throws {Error} If GeoJSON validation fails
 *
 * @example
 * const layer = new GeoJSONLayer(geoJsonData, {
 * style: (feature) => ({
 * color: feature.properties.color,
 * weight: 2 * }),
 * interactive: true
 * });
 */
  constructor(geojson, options = {}) {
    // NEW: Validate options
    const optionResult = ConfigValidator.validate(options, GEOJSON_LAYER_SCHEMA);
    if (optionResult.errors.length > 0) {
      console.error('[Atlas] GeoJSONLayer option errors:', optionResult.errors);
      throw new Error(`GeoJSONLayer validation failed: ${optionResult.errors[0].message}`);
    }
    super(options);
    this._validator = new GeoJSONValidator({
      strict: options.validateStrict !== false,
      autoRepair: options.autoRepair || false,
      warnOnMissingProperties: true
    });
    // Validate input
    if (!this._validator.validate(geojson)) {
      const report = this._validator.getReport();
      console.error('[Atlas] GeoJSON validation failed:', report);
      if (!options.autoRepair) {
        throw new Error(`Invalid GeoJSON: ${report.errors[0].message}`);
      }
    }
    // Repair if needed
    geojson = this._validator.repair(geojson);
    this._geojson = this._normalizeGeoJSON(geojson);
    this._features = [];
    this._featureCache = new Map();
    this._hitCache = new Map();
    this._lastRenderZoom = null;
    this._lastRenderBearing = null;
    this._lastRenderCenter = null;
    this.options.style = options.style || {
      color: '#3388ff',
      weight: 3,
      opacity: 1,
      fillColor: '#3388ff',
      fillOpacity: 0.2
    };
    this.options.interactive = options.interactive !== undefined ? options.interactive : true;
    this._hoveredFeature = null;
    this._eventDelegationManager = null;
  }

  _normalizeGeoJSON(input) {
    if (Array.isArray(input)) {
      return {
        type: 'FeatureCollection',
        features: input.map(f => f.type === 'Feature' ? f : { type: 'Feature', geometry: f, properties: {} })
      };
    } else if (input.type === 'FeatureCollection') {
      return input;
    } else if (input.type === 'Feature') {
      return { type: 'FeatureCollection', features: [input] };
    } else {
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: input, properties: {} }]
      };
    }
  }

  _latLngToScreenPoint(coord) {
    if (!this._map) return { x: 0, y: 0 };
    const [lon, lat] = coord;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const zInt = Math.floor(this._map.zoom);
    const ts = TILE_SIZE * Math.pow(2, this._map.zoom - zInt);
    const ct = this._map.projection.latLngToTile(this._map.center, zInt);
    const pt = this._map.projection.latLngToTile({ lat, lon }, zInt);
    const trX = (pt.x - ct.x) * ts;
    const trY = (pt.y - ct.y) * ts;
    const anchorVec = rot(trX, trY, this._map.bearing);
    const screenX = w / 2 + anchorVec.x;
    const screenY = h / 2 + anchorVec.y;
    return { x: screenX, y: screenY };
  }

  _getFeatureStyle(feature) {
    if (typeof this.options.style === 'function') {
      return this.options.style(feature);
    }
    return this.options.style;
  }

  _processFeature(feature) {
    const cacheKey = JSON.stringify(feature);
    if (this._featureCache.has(cacheKey)) {
      return this._featureCache.get(cacheKey);
    }

    const geometry = feature.geometry;
    const processed = { type: geometry.type, coordinates: null, properties: feature.properties };

    switch (geometry.type) {
      case 'Point':
        processed.coordinates = this._latLngToScreenPoint(geometry.coordinates);
        break;
      case 'MultiPoint':
        processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord));
        break;
      case 'LineString':
        processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord));
        break;
      case 'MultiLineString':
        processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord)));
        break;
      case 'Polygon':
        processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord)));
        break;
      case 'MultiPolygon':
        processed.coordinates = geometry.coordinates.map(polygon => polygon.map(ring => ring.map(coord => this._latLngToScreenPoint(coord))));
        break;
      default:
        console.warn('[Atlas] Unsupported geometry type:', geometry.type);
        return null;
    }

    this._featureCache.set(cacheKey, processed);
    return processed;
  }

  _renderPoint(ctx, feature, style) {
    const { x, y } = feature.coordinates;
    ctx.beginPath();
    ctx.arc(x, y, style.radius || 5, 0, 2 * Math.PI);
    ctx.fillStyle = style.fillColor || style.color || '#3388ff';
    ctx.fill();
    if (style.stroke !== false) {
      ctx.strokeStyle = style.color || '#3388ff';
      ctx.lineWidth = style.weight || 2;
      ctx.globalAlpha = style.opacity || 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _renderLineString(ctx, feature, style) {
    const coords = feature.coordinates;
    if (coords.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.strokeStyle = style.color || '#3388ff';
    ctx.lineWidth = style.weight || 3;
    ctx.globalAlpha = style.opacity || 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _renderPolygon(ctx, feature, style) {
    const rings = feature.coordinates;
    if (rings.length === 0) return;

    ctx.beginPath();
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      if (ring.length < 3) continue;
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y);
      }
      ctx.closePath();
    }

    if (style.fill !== false) {
      ctx.fillStyle = style.fillColor || style.color || '#3388ff';
      ctx.globalAlpha = style.fillOpacity || 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (style.stroke !== false) {
      ctx.strokeStyle = style.color || '#3388ff';
      ctx.lineWidth = style.weight || 3;
      ctx.globalAlpha = style.opacity || 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  _pointInPolygon(x, y, rings) {
    let inside = false;
    // Check the outer ring first
    if (this._pointInRing(x, y, rings[0])) {
      inside = true;
      // Now check the inner rings (holes)
      for (let i = 1; i < rings.length; i++) {
        if (this._pointInRing(x, y, rings[i])) {
          inside = false; // Point is in a hole
          break;
        }
      }
    }
    return inside;
  }

  _pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, yi = ring[i].y;
      const xj = ring[j].x, yj = ring[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  _pointOnLine(x, y, line, width) {
    for (let i = 0; i < line.length - 1; i++) {
      const p1 = line[i];
      const p2 = line[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const closeX = p1.x + t * dx;
      const closeY = p1.y + t * dy;
      const distSq = (x - closeX) * (x - closeX) + (y - closeY) * (y - closeY);
      if (distSq < (width / 2) * (width / 2)) return true;
    }
    return false;
  }

  _hitDetect(x, y) {
    // Iterate backwards to prioritize features rendered on top
    for (let i = this._features.length - 1; i >= 0; i--) {
      const feature = this._features[i];
      const processed = this._processFeature(feature);
      if (!processed) continue;
      const style = this._getFeatureStyle(feature);

      switch (processed.type) {
        case 'Point':
          const dist = Math.hypot(x - processed.coordinates.x, y - processed.coordinates.y);
          if (dist <= (style.radius || 5) + 5) { // Add a 5px buffer
            return feature;
          }
          break;
        case 'LineString':
          if (this._pointOnLine(x, y, processed.coordinates, (style.weight || 3) + 10)) { // Add a 10px buffer
            return feature;
          }
          break;
        case 'Polygon':
          if (this._pointInPolygon(x, y, processed.coordinates)) {
            return feature;
          }
          break;
      }
    }
    return null;
  }

  _onMouseMove(e) {
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const feature = this._hitDetect(x, y);

    if (this._hoveredFeature && this._hoveredFeature !== feature) {
      this.fire('mouseout', { originalEvent: e, feature: this._hoveredFeature });
      this._hoveredFeature = null;
      this._map.canvas.style.cursor = 'grab';
    }

    if (feature && this._hoveredFeature !== feature) {
      this.fire('mouseover', { originalEvent: e, feature: feature });
      this._hoveredFeature = feature;
      this._map.canvas.style.cursor = 'pointer';
    }

    if (feature) {
      this.fire('mousemove', { originalEvent: e, feature });
    }
  }

  _onMouseOut(e) {
    if (this._hoveredFeature) {
      this.fire('mouseout', { originalEvent: e, feature: this._hoveredFeature });
      this._hoveredFeature = null;
      this._map.canvas.style.cursor = 'grab';
    }
  }

  _onClick(e) {
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const feature = this._hitDetect(x, y);

    if (feature) {
      this.fire('click', { originalEvent: e, feature });
    }
  }

  onAdd() {
    this._features = this._geojson.features || [];
    if (this.options.interactive) {
      this._setupEventDelegation();
    }
    this.fire('add');
  }

  /**
 * NEW: Set up event delegation
 * @private
 */
  _setupEventDelegation() {
    if (!this._map) return;
    // Initialize delegation manager
    this._eventDelegationManager = new EventDelegationManager(this._map.canvas);
    // Set up delegated listeners
    this._eventDelegationManager.on(
      'mousemove',
      '*',
      (e) => this._onMouseMove(e)
    );
    this._eventDelegationManager.on(
      'mouseout',
      '*',
      (e) => this._onMouseOut(e)
    );
    this._eventDelegationManager.on(
      'click',
      '*',
      (e) => this._onClick(e)
    );
  }

  onRemove() {
    // NEW: Clean up event delegation
    if (this._eventDelegationManager) {
      this._eventDelegationManager.destroy();
      this._eventDelegationManager = null;
    }
    this._featureCache.clear();
    this._hitCache.clear();
    this.fire('remove');
  }

  render() {
    if (!this._map) return;

    const ctx = this._map.ctx;
    const needsRebuild = (
      this._lastRenderZoom !== this._map.zoom ||
      this._lastRenderBearing !== this._map.bearing ||
      this._lastRenderCenter?.lon !== this._map.center.lon ||
      this._lastRenderCenter?.lat !== this._map.center.lat
    );

    if (needsRebuild) {
      this._featureCache.clear();
      this._hitCache.clear();
      this._lastRenderZoom = this._map.zoom;
      this._lastRenderBearing = this._map.bearing;
      this._lastRenderCenter = { ...this._map.center };
    }

    for (const feature of this._features) {
      const processed = this._processFeature(feature);
      if (!processed) continue;
      const style = this._getFeatureStyle(feature);

      switch (processed.type) {
        case 'Point':
          this._renderPoint(ctx, processed, style);
          break;
        case 'LineString':
          this._renderLineString(ctx, processed, style);
          break;
        case 'Polygon':
          this._renderPolygon(ctx, processed, style);
          break;
      }
    }
  }

  /**
 * Updates layer data
 *
 * @param {GeoJSON} geojson - New GeoJSON data
 * @returns {this} For method chaining
 * @fires GeoJSONLayer#datachange
 *
 * @example
 * layer.setData(newGeoJSON);
 */
  setData(geojson) {
    if (!this._validator.validate(geojson)) {
      const report = this._validator.getReport();
      console.error('[Atlas] GeoJSON validation failed during setData:', report);
      if (!this.options.autoRepair) {
        throw new Error(`Invalid GeoJSON: ${report.errors[0].message}`);
      }
    }
    geojson = this._validator.repair(geojson);
    this._geojson = this._normalizeGeoJSON(geojson);
    this._features = this._geojson.features || [];
    this._featureCache.clear();
    this._hitCache.clear();
    if (this._map) {
      this._map.render();
    }
  }

  getData() {
    return this._geojson;
  }

  /**
 * NEW: Get validation report
 */
  getValidationReport() {
    return this._validator.getReport();
  }

  /**
 * NEW: Get event delegation stats
 */
  getEventStats() {
    if (!this._eventDelegationManager) {
      return {};
    }
    return {
      delegatedListeners: this._eventDelegationManager.getListenerCount(),
      listenersByType: this._eventDelegationManager.getAllListeners()
    };
  }

  /**
 * Get bounds of all features
 *
 * @returns {Bounds|null} Bounds of all features or null if empty
 */
  getBounds() {
    if (this._features.length === 0) return null;
    const builder = new BoundsBuilder();
    for (const feature of this._features) {
      if (!feature.geometry) continue;
      const coords = this._extractCoordinates(feature.geometry);
      builder.extendArray(coords);
    }
    return builder.build();
  }

  /**
 * Extract all coordinates from geometry
 * @private
 */
  _extractCoordinates(geometry) {
    const coords = [];
    switch (geometry.type) {
      case 'Point':
        coords.push({ lat: geometry.coordinates[1], lon: geometry.coordinates[0] });
        break;
      case 'LineString':
        geometry.coordinates.forEach(c => {
          coords.push({ lat: c[1], lon: c[0] });
        });
        break;
      case 'Polygon':
        geometry.coordinates.forEach(ring => {
          ring.forEach(c => {
            coords.push({ lat: c[1], lon: c[0] });
          });
        });
        break;
      case 'MultiPoint':
        geometry.coordinates.forEach(c => {
          coords.push({ lat: c[1], lon: c[0] });
        });
        break;
      case 'MultiLineString':
        geometry.coordinates.forEach(line => {
          line.forEach(c => {
            coords.push({ lat: c[1], lon: c[0] });
          });
        });
        break;
      case 'MultiPolygon':
        geometry.coordinates.forEach(poly => {
          poly.forEach(ring => {
            ring.forEach(c => {
              coords.push({ lat: c[1], lon: c[0] });
            });
          });
        });
        break;
    }
    return coords;
  }

  /**
 * Fit map to this layer's bounds
 *
 * @param {object} [options={}] - Fit options
 * @returns {void}
 * @example
 * layer.fitMapToBounds();
 */
  fitMapToBounds(options = {}) {
    const bounds = this.getBounds();
    if (!bounds || !this._map) return;
    this._map.fitBounds(bounds, options);
  }
}
