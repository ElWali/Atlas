import { DEFAULT_CONFIG, TILE_SIZE, WHEEL_ZOOM_DURATION, FLYTO_DURATION, EASING, normalizeAngle, shortestAngleDiff, wrapDeltaLon, rot } from '../utils/constants.js';
import { GISUtils } from '../utils/gis.js';
import { DEFAULT_PROJECTION } from '../utils/projection.js';
import { toPoint } from './Point.js';
import { toLatLng } from './LatLng.js';
import { Layer } from '../layers/Layer.js';
import { TileLayer } from '../layers/TileLayer.js';
import { Control } from '../controls/Control.js';
import { ZoomControl } from '../controls/ZoomControl.js';
import { FullscreenControl } from '../controls/FullscreenControl.js';
import { AttributionControl } from '../controls/AttributionControl.js';
import { CompassControl } from '../controls/CompassControl.js';
import { SearchControl } from '../controls/SearchControl.js';
import { GeolocationControl } from '../controls/GeolocationControl.js';
import { ScaleControl } from '../controls/ScaleControl.js';
import { PointerHandler } from '../handlers/PointerHandler.js';
import { ScrollZoomHandler } from '../handlers/ScrollZoomHandler.js';
import { DoubleClickZoomHandler } from '../handlers/DoubleClickZoomHandler.js';
import { KeyboardPanHandler } from '../handlers/KeyboardPanHandler.js';
import { AreaZoomHandler } from '../handlers/AreaZoomHandler.js';
import { Canvas } from '../renderers/Canvas.js';

// Atlas core
export class Atlas {
  constructor(id, options = {}) {
    // do NOT mutate global config; keep instance config
    this._config = { ...DEFAULT_CONFIG, ...options };
    this.canvas = document.getElementById(id);
    this.ctx = this.canvas.getContext("2d");
    this.container = document.getElementById("map-container");
    this.center = { lon: GISUtils.wrapLongitude(this._config.defaultCenter.lon), lat: GISUtils.clampLatitude(this._config.defaultCenter.lat) };
    this.zoom = this._config.defaultZoom;
    this.bearing = 0;
    this.renderScheduled = false;
    this.loadingEl = document.getElementById("loading");
    this.loadingCountEl = document.getElementById("loading-count");
    this._inertiaRAF = null;
    this._layers = [];
    this._baseLayer = null;
    this._events = {};
    this._controls = [];
    this._controlCorners = {};
    this._handlers = {};
    this.projection = DEFAULT_PROJECTION;
    this._lastImmediateRender = 0;
    this._resizeObserver = null;
    this._resizeObserver = new ResizeObserver(() => { this.resize(); });
    this._resizeObserver.observe(this.container);
    // map-level state used by handlers
    this.isDragging = false;
    this.supportsWebP = (
      () => {
        const elem = document.createElement('canvas');
        if (!!(elem.getContext && elem.getContext('2d'))) {
            // was 'image/webp'
            return elem.toDataURL('image/webp').indexOf('data:image/webp') == 0;
        }
        return false;
      }
    )();
    this.isDragging = false;
    this._pixelOrigin = this.getPixelOrigin();
    this._createPane('tooltipPane');
    this._renderer = new Canvas();
    this.addLayer(this._renderer);
    // add handlers (use pointer handler instead of separate drag/touch)
    this.addHandler('pointer', PointerHandler);
    this.addHandler('scrollZoom', ScrollZoomHandler);
    this.addHandler('doubleClickZoom', DoubleClickZoomHandler);
    this.addHandler('keyboardPan', KeyboardPanHandler);
    this.addHandler('areaZoom', AreaZoomHandler);
    this.resize();
    this.addControl(new ZoomControl({ position: 'top-right' }));
    this.addControl(new FullscreenControl({ position: 'top-right' }));
    this.addControl(new AttributionControl({ position: 'bottom-left' }));
    this.addControl(new CompassControl({ position: 'top-right' }));
    this.addControl(new SearchControl({ position: 'top-left' }));
    this.addControl(new GeolocationControl({ position: 'top-right' }));
    this.addControl(new ScaleControl());
    this.updateAttribution();
    this.render();
    this.fire('load');
  }
  debouncedRender(delay = 33) {
    if (this._debounceRenderTimeout) clearTimeout(this._debounceRenderTimeout);
    this._debounceRenderTimeout = setTimeout(() => { this._debounceRenderTimeout = null; this.render(); }, delay);
  }
  on(type, fn) { if (!this._events[type]) this._events[type] = []; this._events[type].push(fn); return this; }
  off(type, fn) { if (!this._events[type]) return this; this._events[type] = this._events[type].filter(cb => cb !== fn); return this; }
  fire(type, data = {}) { if (!this._events[type]) return; data.type = type; data.target = this; this._events[type].forEach(fn => fn(data)); }
  addLayer(layer) {
    if (!(layer instanceof Layer)) throw new Error('Argument must be an instance of Layer');
    if (!this._layers.includes(layer)) {
      this._layers.push(layer);
      layer._map = this;
      layer.onAdd();
      this.render();
      if (!this._baseLayer || (layer instanceof TileLayer && !this._baseLayer)) {
        this._baseLayer = layer;
        this.container.style.background = layer.getBackground();
      }
      this.updateAttribution();
    }
    return this;
  }
  removeLayer(layer) {
    const index = this._layers.indexOf(layer);
    if (index !== -1) {
      this._layers.splice(index, 1);
      layer.onRemove();
      layer._map = null;
      if (this._baseLayer === layer) {
        this._baseLayer = this._layers.find(l => l instanceof TileLayer) || null;
        if (this._baseLayer) this.container.style.background = this._baseLayer.getBackground();
      }
      this.render();
      this.updateAttribution();
    }
    return this;
  }
  setBaseLayer(newLayer) {
    if (!(newLayer instanceof TileLayer)) throw new Error('Argument must be an instance of TileLayer');
    if (this._baseLayer && this._baseLayer !== newLayer) this.removeLayer(this._baseLayer);
    if (!this._layers.includes(newLayer)) this.addLayer(newLayer);
    else {
      this._baseLayer = newLayer;
      this.container.style.background = newLayer.getBackground();
      this.zoom = Math.max(newLayer.getMinZoom(), Math.min(newLayer.getMaxZoom(), this.zoom));
      this.render();
      this.updateAttribution();
    }
    return this;
  }
  getBaseLayer() { return this._baseLayer; }
  addControl(control) {
    if (!(control instanceof Control)) throw new Error('Argument must be an instance of Control');
    this._controls.push(control);
    control.addTo(this);
    return this;
  }
  removeControl(control) {
    const index = this._controls.indexOf(control);
    if (index !== -1) {
      this._controls.splice(index, 1);
      control.remove();
    }
    return this;
  }
  getControls() { return [...this._controls]; }
  addHandler(name, HandlerClass) {
    if (this._handlers[name]) { return this; }
    this._handlers[name] = new HandlerClass(this);
    this._handlers[name].enable();
    return this;
  }
  removeHandler(name) {
    if (!this._handlers[name]) return this;
    this._handlers[name].destroy();
    delete this._handlers[name];
    return this;
  }
  getHandler(name) { return this._handlers[name] || null; }
  enableHandler(name) { const handler = this.getHandler(name); if (handler) handler.enable(); return this; }
  disableHandler(name) { const handler = this.getHandler(name); if (handler) handler.disable(); return this; }
  getHandlers() { return { ...this._handlers }; }
  setZoom(z) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const nz = Math.max(minZoom, Math.min(maxZoom, z));
    if (nz === this.zoom) return;
    this.zoom = nz;
    this.render();
    this.showZoomOverlay();
    this.updateControlsUI();
    this.fire('zoom');
  }
  setBearing(rad) {
    const nr = normalizeAngle(rad);
    if (Math.abs(nr - this.bearing) < 1e-6) return;
    this.bearing = nr;
    this.render();
    this.fire('rotate');
  }
  showZoomOverlay() {}
  stopInertia() { if (this._inertiaRAF) cancelAnimationFrame(this._inertiaRAF); this._inertiaRAF = null; }
  stopAnimations() {
    this.stopInertia();
    if (this._zoomAnim?.raf) cancelAnimationFrame(this._zoomAnim.raf);
    this._zoomAnim = null;
    if (this._flyAnim?.raf) cancelAnimationFrame(this._flyAnim.raf);
    this._flyAnim = null;
  }
  resize() {
    const w = this.container.offsetWidth, h = this.container.offsetHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    // Reset transform to DPR scaling each frame in _draw to avoid accumulation.
    // But keep initial transform for consistent measurement.
    this.ctx.setTransform(this.dpr, 0, 0, 0, this.dpr, 0, 0);
    this.render();
    this.fire('resize');
  }
  scheduleRender() {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this._draw();
    });
  }
  render(immediate = false) {
    if (immediate) {
      const now = performance.now();
      if (!this._lastImmediateRender || (now - this._lastImmediateRender) > 8) {
        this._lastImmediateRender = now;
        this._draw();
      } else {
        requestAnimationFrame(() => this._draw());
      }
    } else {
      if (this.renderScheduled) return;
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderScheduled = false;
        this._draw();
      });
    }
  }
  _draw() {
    // Reset transform at start to DPR scaling to avoid accumulation
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const backgroundColor = this._baseLayer ? this._baseLayer.getBackground() : '#000';
    const w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, w, h);
    for (const layer of this._layers) {
      try {
        layer.render();
      } catch (error) {
        this.fire('rendererror', { layer, error });
      }
    }
    let loadingCount = 0;
    if (this._baseLayer && this._baseLayer instanceof TileLayer) loadingCount = this._baseLayer.loadingTiles.size;
    this.loadingEl.classList.toggle("visible", loadingCount > 0);
    this.loadingCountEl.textContent = loadingCount;
    this.updateControlsUI();
    this.fire('moveend');
  }
  updateAttribution() {
    for (const control of this._controls) {
      if (control instanceof AttributionControl && typeof control._update === 'function') control._update();
    }
  }
  updateControlsUI() {
    for (const control of this._controls) {
      if (typeof control._update === 'function') control._update();
    }
  }
  getCenter() { return { ...this.center }; }
  getZoom() { return this.zoom; }
  getBearing() { return this.bearing; }
  screenToLatLon(ax, ay, zoom = this.zoom, bearing = this.bearing, center = this.center) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const zInt = Math.floor(zoom);
    const ts = TILE_SIZE * Math.pow(2, zoom - zInt);
    const ct = this.projection.latLngToTile(center, zInt);
    const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
    const v = rot(anchorVec.x / ts, anchorVec.y / ts, -bearing);
    const tpt = { x: ct.x + v.x, y: ct.y + v.y };
    const ll = this.projection.tileToLatLng(tpt.x, tpt.y, zInt);
    return { lon: GISUtils.wrapLongitude(ll.lon), lat: GISUtils.clampLatitude(ll.lat) };
  }
  lonLatToTile(lon, lat, z) { return this.projection.latLngToTile({ lat, lon }, z); }
  latLngToContainerPoint(latlng) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const zInt = Math.floor(this.zoom);
    const ts = TILE_SIZE * Math.pow(2, this.zoom - zInt);
    const ct = this.projection.latLngToTile(this.center, zInt);
    const pt = this.projection.latLngToTile(latlng, zInt);
    const trX = (pt.x - ct.x) * ts;
    const trY = (pt.y - ct.y) * ts;
    const anchorVec = rot(trX, trY, this.bearing);
    return { x: w / 2 + anchorVec.x, y: h / 2 + anchorVec.y };
  }
  applyZoomRotateAbout(ax, ay, newZoom, newBearing, anchorLL = null) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
    const currAnchorLL = anchorLL || this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
    const zInt = Math.floor(newZoom);
    const ts = TILE_SIZE * Math.pow(2, newZoom - zInt);
    const Ptile = this.projection.latLngToTile(currAnchorLL, zInt);
    const v = rot(anchorVec.x / ts, anchorVec.y / ts, -newBearing);
    const ctNew = { x: Ptile.x - v.x, y: Ptile.y - v.y };
    const newCenter = this.projection.tileToLatLng(ctNew.x, ctNew.y, zInt);
    this.center = { lon: GISUtils.wrapLongitude(newCenter.lon), lat: GISUtils.clampLatitude(newCenter.lat) };
    this.zoom = newZoom;
    this.bearing = normalizeAngle(newBearing);
  }
  showZoomIndicator(x, y) {
    if (this._zoomIndicator) this.container.removeChild(this._zoomIndicator);
    const indicator = document.createElement("div");
    indicator.style.position = "absolute";
    indicator.style.left = (x - 15) + "px";
    indicator.style.top = (y - 15) + "px";
    indicator.style.width = "30px";
    indicator.style.height = "30px";
    indicator.style.borderRadius = "50%";
    indicator.style.border = "2px solid #333";
    indicator.style.opacity = "0.8";
    indicator.style.pointerEvents = "none";
    indicator.style.zIndex = "100";
    indicator.style.animation = "zoom-indicator 0.6s ease-out forwards";
    this.container.appendChild(indicator);
    this._zoomIndicator = indicator;
    setTimeout(() => {
      if (this._zoomIndicator && this._zoomIndicator.parentNode) {
        this.container.removeChild(this._zoomIndicator);
        this._zoomIndicator = null;
      }
    }, 600);
  }
  showPulseAtLatLng(latlng) {
    const pt = this.latLngToContainerPoint(latlng);
    this.showZoomIndicator(pt.x, pt.y);
  }
  animateZoomRotateAbout(ax, ay, toZoom, toBearing = this.bearing, duration = WHEEL_ZOOM_DURATION, easing = EASING.easeInOutCubic) {
    this.showZoomIndicator(ax, ay);
    this.stopAnimations();
    const startT = performance.now();
    const sZoom = this.zoom;
    const sBear = this.bearing;
    const deltaBear = shortestAngleDiff(sBear, toBearing);
    const anchorLL = this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
    let isAnimating = true;
    const step = (timestamp) => {
      if (!isAnimating) { this._zoomAnim = null; return; }
      const elapsed = timestamp - startT;
      let t = elapsed / Math.max(1, duration);
      if (elapsed >= duration) t = 1;
      const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
      const z = sZoom + (toZoom - sZoom) * p;
      const b = sBear + deltaBear * p;
      this.applyZoomRotateAbout(ax, ay, z, b, anchorLL);
      this.render(true);
      if (t < 1) this._zoomAnim = { raf: requestAnimationFrame(step) };
      else { this._zoomAnim = null; isAnimating = false; this.updateControlsUI(); this.fire('zoomend'); }
    };
    this._zoomAnim = { raf: requestAnimationFrame(step) };
    this.fire('zoomstart');
  }
  smoothZoomAt(ax, ay, deltaZ) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const target = Math.max(minZoom, Math.min(maxZoom, this.zoom + deltaZ));
    this.animateZoomRotateAbout(ax, ay, target, this.bearing, WHEEL_ZOOM_DURATION, EASING.easeInOutCubic);
  }
  flyTo({ center = this.center, zoom = this.zoom, bearing = this.bearing, duration = FLYTO_DURATION, easing = EASING.easeInOutCubic } = {}) {
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const targetZoom = Math.min(maxZoom, Math.max(minZoom, zoom));
    this.stopAnimations();
    const startT = performance.now();
    const sC = { ...this.center };
    const eC = { ...center };
    const dLon = wrapDeltaLon(eC.lon - sC.lon);
    const dLat = eC.lat - sC.lat;
    const sZ = this.zoom, eZ = targetZoom;
    const sB = this.bearing, dB = shortestAngleDiff(sB, bearing);
    let isAnimating = true;
    const step = (timestamp) => {
      if (!isAnimating) { this._flyAnim = null; return; }
      const elapsed = timestamp - startT;
      let t = elapsed / Math.max(1, duration);
      if (elapsed >= duration) t = 1;
      const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
      this.center = { lon: GISUtils.wrapLongitude(sC.lon + dLon * p), lat: GISUtils.clampLatitude(sC.lat + dLat * p) };
      this.zoom = sZ + (eZ - sZ) * p;
      this.bearing = normalizeAngle(sB + dB * p);
      this.render(true);
      if (t < 1) this._flyAnim = { raf: requestAnimationFrame(step) };
      else { this._flyAnim = null; isAnimating = false; this.updateControlsUI(); this.fire('moveend'); }
    };
    this._flyAnim = { raf: requestAnimationFrame(step) };
    this.fire('movestart');
  }
  fitBounds(bounds, options = {}) {
    const { padding = 0.1, maxZoom = 18 } = options;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    const { sw, ne } = bounds;

    const zoomX = Math.log2(w / (ne.lon - sw.lon)) - Math.log2(360 / (2 * Math.PI));
    const zoomY = Math.log2(h / (ne.lat - sw.lat)) - Math.log2(180 / (2 * Math.PI));

    const zoom = Math.min(zoomX, zoomY, maxZoom);

    const center = {
        lon: (sw.lon + ne.lon) / 2,
        lat: (sw.lat + ne.lat) / 2
    };

    this.flyTo({ center, zoom: zoom - padding, ...options });
  }
  flyToQuick({ center = this.center, zoom = this.zoom, bearing = this.bearing, duration = 450, easing = EASING.easeInOutCubic } = {}) {
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const targetZoom = Math.min(maxZoom, Math.max(minZoom, zoom));
    if (this._baseLayer && this._baseLayer.prefetchAround) this._baseLayer.prefetchAround(center, targetZoom, 3, true, 100);
    const previewZoom = targetZoom > 10 ? targetZoom - 2 : targetZoom;
    this.center = { lon: GISUtils.wrapLongitude(center.lon), lat: GISUtils.clampLatitude(center.lat) };
    this.zoom = previewZoom;
    this.render(true);
    this.updateControlsUI();
    this.showPulseAtLatLng(center);
    const delta = Math.abs(targetZoom - previewZoom);
    const refineDuration = Math.max(200, Math.min(duration, 150 + delta * 120));
    requestAnimationFrame(() => {
      this.flyTo({ center, zoom: targetZoom, bearing, duration: refineDuration, easing });
    });
  }
  destroy() {
    this.stopAnimations();
    for (const layer of [...this._layers]) this.removeLayer(layer);
    for (const control of [...this._controls]) this.removeControl(control);
    for (const corner in this._controlCorners) {
      const container = this._controlCorners[corner];
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }
    this._controlCorners = {};
    for (const name in this._handlers) this.removeHandler(name);
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    this.fire('unload');
  }
  getPixelOrigin() {
    return this._pixelOrigin;
  }
  unproject(point, zoom) {
    zoom = zoom === undefined ? this.getZoom() : zoom;
    return this.projection.unproject(this.project(point, zoom));
  }
  project(latlng, zoom) {
    zoom = zoom === undefined ? this.getZoom() : zoom;
    return this.projection.project(toLatLng(latlng), zoom);
  }
  panBy(offset) {
    offset = toPoint(offset).round();
    this.panTo(this.project(this.unproject(this.getPixelOrigin()).add(offset)));
  }
  _createPane(name) {
    const pane = document.createElement('div');
    pane.className = `leaflet-pane leaflet-${name}`;
    this.container.appendChild(pane);
    this[name] = pane;
  }
  locate() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latlng = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          this.fire('locationfound', { latlng });
          this.flyTo({ center: latlng, zoom: 16 });
        },
        (error) => {
          this.fire('locationerror', { message: error.message });
        }
      );
    } else {
      this.fire('locationerror', { message: 'Geolocation is not supported by this browser.' });
    }
  }
}