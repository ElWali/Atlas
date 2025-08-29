/*!
 * Atlas.js v0.1.2
 * Author: ElWali ElAlaoui
 * License: BSD-2-Clause
 */

;(() => {
  if (typeof document === 'undefined') return;

  const STYLE_ID = 'atlasjs-style-v012';
  if (!document.getElementById(STYLE_ID)) {
    const css = `
:root{
  --atlas-accent:#2563eb;--atlas-bg:#f3f4f6;--atlas-ctrl-bg:#fff;--atlas-ctrl-border:#d1d5db;
  --atlas-ctrl-shadow:0 1px 3px rgba(0,0,0,.15);--atlas-popup-shadow:0 2px 10px rgba(0,0,0,.2);
  --atlas-tile-fade:160ms
}
.atlas-map{position:relative;overflow:hidden;background:var(--atlas-bg);touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent}
.atlas-pane{position:absolute;inset:0}
.atlas-tile-pane{z-index:100}.atlas-overlay-pane{z-index:400;pointer-events:none}.atlas-popup-pane{z-index:500;pointer-events:none}.atlas-controls-pane{z-index:900;pointer-events:none}
.atlas-tile-layer{position:absolute;top:0;left:0;will-change:transform}
.atlas-tile{position:absolute;width:256px;height:256px;image-rendering:pixelated;pointer-events:none;opacity:0;transition:opacity var(--atlas-tile-fade) ease-out}
.atlas-tile-loaded{opacity:1}
.atlas-marker{position:absolute;transform:translate(-50%,-100%);cursor:pointer;pointer-events:auto}
.atlas-marker-pin{width:24px;height:24px;border-radius:50% 50% 50% 0;background:#ef4444;position:absolute;transform:rotate(-45deg);left:50%;top:100%;margin-left:-12px;margin-top:-24px;box-shadow:0 1px 2px rgba(0,0,0,.5)}
.atlas-marker-pin::after{content:'';width:12px;height:12px;margin:6px 0 0 6px;background:#fff;position:absolute;border-radius:50%}
.atlas-popup{position:absolute;transform:translate(-50%,calc(-100% - 10px));background:#fff;padding:8px 10px;border-radius:6px;border:1px solid #e5e7eb;white-space:nowrap;box-shadow:var(--atlas-popup-shadow);pointer-events:auto}
.atlas-popup-close{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;color:#111;display:grid;place-items:center;cursor:pointer;font-size:14px;line-height:1}
.atlas-control-corner{position:absolute;display:flex;flex-direction:column;gap:8px;padding:10px;pointer-events:none}
.atlas-top-left{top:0;left:0}.atlas-top-right{top:0;right:0}.atlas-bottom-left{bottom:0;left:0}.atlas-bottom-right{bottom:0;right:0}
.atlas-control{background:var(--atlas-ctrl-bg);border:1px solid var(--atlas-ctrl-border);border-radius:6px;box-shadow:var(--atlas-ctrl-shadow);pointer-events:auto;overflow:hidden;display:inline-flex;align-items:center}
.atlas-control button{appearance:none;border:0;background:transparent;width:36px;height:36px;display:grid;place-items:center;cursor:pointer;font:inherit}
.atlas-control button:hover{background:#f3f4f6}.atlas-control button:focus{outline:2px solid var(--atlas-accent);outline-offset:-2px}
.atlas-grab{cursor:grab}.atlas-grabbing{cursor:grabbing}
.atlas-control.atlas-attribution{font-size:12px;line-height:1.1;color:#374151;padding:4px 8px}
.atlas-attribution a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border-bottom:1px dotted transparent}
.atlas-attribution a:hover{border-bottom-color:currentColor}
.atlas-attribution .atlas-brand-flag{font-size:13px}
.atlas-attribution .atlas-sep{margin:0 6px;opacity:.6}
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

const Atlas = (() => {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;
  const MERC_MAX_LAT = 85.05112878;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (x, max) => ((x % max) + max) % max;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const now = () => (performance?.now?.() || Date.now());
  const dpr = () => Math.max(1, Math.min(3, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1));

  const project = (lat, lng, zoom, tileSize = 256) => {
    const latC = clamp(lat, -MERC_MAX_LAT, MERC_MAX_LAT);
    const rad = latC * DEG2RAD;
    const n = 2 ** zoom;
    const x = (lng + 180) / 360 * n * tileSize;
    const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * tileSize;
    return { x, y };
  };
  const unproject = (x, y, zoom, tileSize = 256) => {
    const n = 2 ** zoom;
    const lng = (x / (tileSize * n)) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (tileSize * n))));
    return [latRad * RAD2DEG, lng];
  };

  class Emitter {
    constructor() { this._events = new Map(); }
    on(e, fn) { if (!this._events.has(e)) this._events.set(e, new Set()); this._events.get(e).add(fn); return this; }
    once(e, fn) { const w = (...a) => { this.off(e, w); fn(...a); }; return this.on(e, w); }
    off(e, fn) { if (!this._events.has(e)) return this; if (fn) this._events.get(e).delete(fn); else this._events.get(e).clear(); return this; }
    fire(e, p) { const s = this._events.get(e); if (!s) return this; for (const fn of Array.from(s)) try { fn(p); } catch (err) { console.error('[Atlas]', e, err); } return this; }
  }

  class Layer {
    addTo(map) { map.addLayer(this); return this; }
    onAdd(_map) {}
    onRemove(_map) {}
  }

  class Control {
    constructor(position = 'top-right') {
      this.position = position;
      this._map = null;
      this.el = document.createElement('div');
      this.el.className = 'atlas-control';
    }
    addTo(map) {
      if (this._map) return this;
      this._map = map;
      const corner = map._controlCorners[this.position] || map._controlCorners['top-right'];
      corner.appendChild(this.el);
      this.onAdd?.(map);
      return this;
    }
    remove() {
      if (!this._map) return;
      this.onRemove?.(this._map);
      this.el?.parentNode?.removeChild(this.el);
      this._map = null;
    }
  }

  class ZoomControl extends Control {
    constructor(position = 'top-right') {
      super(position);
      const zin = document.createElement('button');
      zin.type = 'button'; zin.title = 'Zoom in'; zin.setAttribute('aria-label', 'Zoom in'); zin.textContent = '+';
      const zout = document.createElement('button');
      zout.type = 'button'; zout.title = 'Zoom out'; zout.setAttribute('aria-label', 'Zoom out'); zout.textContent = '−';
      this.el.append(zin, zout);
      zin.addEventListener('click', () => this._map?.zoomIn({ animate: true }));
      zout.addEventListener('click', () => this._map?.zoomOut({ animate: true }));
    }
  }

  class AttributionControl extends Control {
    constructor(position = 'bottom-right', options = {}) {
      super(position);
      this.el.classList.add('atlas-attribution');
      this._prefix = Object.assign({ text: 'Atlas.js', flag: '🇲🇦', link: 'https://atlasjs.dev', title: 'Atlas.js', ariaFlagLabel: 'Morocco flag' }, options.prefix || {});
      this._items = new Set();
      const items = Array.isArray(options.attribution) ? options.attribution : (options.attribution ? [options.attribution] : []);
      items.forEach(a => this._items.add(a));
      this._brand = document.createElement('span'); this._brand.className = 'atlas-brand';
      this._sep = document.createElement('span'); this._sep.className = 'atlas-sep'; this._sep.textContent = '|';
      this._credits = document.createElement('span'); this._credits.className = 'atlas-credits';
      this.el.append(this._brand, this._sep, this._credits);
    }
    onAdd(map) { this._map = map; this._render(); }
    onRemove() { this._map = null; }
    setPrefix(p) { this._prefix = Object.assign({}, this._prefix, p || {}); this._render(); return this; }
    addAttribution(t) { if (!t) return this; this._items.add(t); this._render(); this._map?.fire('attributionchange', { items: [...this._items] }); return this; }
    removeAttribution(t) { this._items.delete(t); this._render(); this._map?.fire('attributionchange', { items: [...this._items] }); return this; }
    clearAttributions() { this._items.clear(); this._render(); this._map?.fire('attributionchange', { items: [] }); return this; }
    _render() {
      this._brand.innerHTML = '';
      const { text, flag, link, title, ariaFlagLabel } = this._prefix || {};
      if (text) {
        const node = document.createElement(link ? 'a' : 'span');
        if (link) { node.href = link; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
        node.className = 'atlas-brand-link'; node.title = title || text;
        node.append(document.createTextNode(text + ' '));
        if (flag) { const f = document.createElement('span'); f.className = 'atlas-brand-flag'; f.setAttribute('role', 'img'); if (ariaFlagLabel) f.setAttribute('aria-label', ariaFlagLabel); f.textContent = flag; node.append(f); }
        this._brand.appendChild(node);
      }
      this._credits.innerHTML = '';
      if (this._items.size) {
        let first = true;
        for (const entry of this._items) {
          if (!first) this._credits.append(' | ');
          first = false;
          const span = document.createElement('span');
          span.innerHTML = String(entry);
          this._credits.append(span);
        }
      }
      this._sep.style.display = text && this._items.size ? '' : 'none';
    }
  }

  class Marker extends Layer {
    constructor(latlng, options = {}) {
      super();
      this._latlng = latlng;
      this.options = { color: options.color, draggable: !!options.draggable };
      this.el = document.createElement('div');
      this.el.className = 'atlas-marker';
      this.el.setAttribute('role', 'img');
      this.el.setAttribute('aria-label', options.ariaLabel || 'Map marker');
      const pin = document.createElement('div');
      pin.className = 'atlas-marker-pin';
      if (this.options.color) pin.style.background = this.options.color;
      this.el.appendChild(pin);
    }
    onAdd(map) {
      map._overlayPane.appendChild(this.el);
      this._updatePosition();
      if (this.options.draggable) this._bindDrag();
      this._click = e => { e.stopPropagation(); map.fire('marker:click', { marker: this, latlng: this._latlng, domEvent: e }); };
      this.el.addEventListener('click', this._click);
    }
    onRemove(_map) {
      this.el.removeEventListener('click', this._click);
      this.el.parentNode?.removeChild(this.el);
      this._unbindDrag();
    }
    setLatLng(ll) { this._latlng = ll; this._updatePosition(); return this; }
    getLatLng() { return this._latlng; }
    _updatePosition() { if (!this._map) return; const { left, top } = this._map._latLngToPoint(...this._latlng); this.el.style.left = `${left}px`; this.el.style.top = `${top}px`; }
    bindPopup(html, opts = {}) {
      this.el.addEventListener('click', () => new Popup(opts).setLatLng(this._latlng).setContent(html).openOn(this._map));
      this.el.setAttribute('aria-haspopup', 'dialog');
      return this;
    }
    _bindDrag() {
      this._onDown = e => { if (e.button !== 0 && e.pointerType !== 'touch') return; this._pid = e.pointerId; this.el.setPointerCapture(e.pointerId); this._start = { x: e.clientX, y: e.clientY, latlng: this._latlng }; this._map._setDraggingCursor(true); e.preventDefault(); };
      this._onMove = e => { if (e.pointerId !== this._pid) return; const dx = e.clientX - this._start.x, dy = e.clientY - this._start.y; const p0 = this._map._latLngToWorldPoint(...this._start.latlng); const ll = unproject(p0.x + dx, p0.y + dy, this._map.zoom, this._map.options.tileSize); this.setLatLng(ll); this._map.fire('marker:drag', { marker: this, latlng: ll }); };
      this._onUp = e => { if (e.pointerId !== this._pid) return; this._map._setDraggingCursor(false); this.el.releasePointerCapture(e.pointerId); this._map.fire('marker:dragend', { marker: this, latlng: this._latlng }); };
      this.el.addEventListener('pointerdown', this._onDown);
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
    }
    _unbindDrag() {
      if (!this._onDown) return;
      this.el.removeEventListener('pointerdown', this._onDown);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      this._onDown = this._onMove = this._onUp = null;
    }
  }

  class Popup extends Layer {
    constructor(options = {}) {
      super();
      this.options = { closeButton: options.closeButton !== false };
      this.el = document.createElement('div');
      this.el.className = 'atlas-popup';
      this.el.setAttribute('role', 'dialog');
      this.el.setAttribute('aria-modal', 'false');
      if (this.options.closeButton) {
        const btn = document.createElement('button');
        btn.className = 'atlas-popup-close'; btn.setAttribute('aria-label', 'Close'); btn.innerHTML = '×';
        btn.addEventListener('click', () => this.close());
        this.el.appendChild(btn);
      }
      this._content = document.createElement('div');
      this.el.appendChild(this._content);
    }
    setLatLng(ll) { this._latlng = ll; this._updatePosition(); return this; }
    setContent(h) {
      if (typeof h === 'string') this._content.innerHTML = h; else if (h instanceof Node) { this._content.innerHTML = ''; this._content.appendChild(h); }
      const t = this._content.textContent || ''; this.el.setAttribute('aria-label', t.substring(0, 120)); return this;
    }
    openOn(map) { this.addTo(map); return this; }
    onAdd(map) { map._popupPane.appendChild(this.el); this._updatePosition(); this._clickAway = e => { if (!this.el.contains(e.target)) this.close(); }; map.container.addEventListener('click', this._clickAway); }
    onRemove(map) { map.container.removeEventListener('click', this._clickAway); this.el.parentNode?.removeChild(this.el); }
    _updatePosition() { if (!this._map || !this._latlng) return; const { left, top } = this._map._latLngToPoint(...this._latlng); this.el.style.left = `${left}px`; this.el.style.top = `${top}px`; }
    close() { this._map && this._map.removeLayer(this); }
  }

  class Map extends Emitter {
    constructor(container, options = {}) {
      super();

      this.container = typeof container === 'string' ? (document.getElementById(container) || document.querySelector(container)) : container;
      if (!this.container) throw new Error('Atlas: container not found');
      this.container.classList.add('atlas-map', 'atlas-grab');
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-label', options.ariaLabel || 'Interactive map');

      this.options = Object.assign({
        center: [0, 0],
        zoom: 2,
        minZoom: 0,
        maxZoom: 20,
        tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}{r}.png',
        tileSize: 256,
        subdomains: [],
        tileRetina: false,
        tileCrossOrigin: 'anonymous',
        wrapX: true,
        wheelZoom: true,
        doubleClickZoom: true,
        draggable: true,
        inertia: true,
        zoomDelta: 1,
        attribution: '© OpenStreetMap contributors',
        attributionControl: true,
        keyboard: true,
        brandName: 'Atlas.js',
        brandFlag: '🇲🇦',
        brandLink: 'https://atlasjs.dev',
        showBrand: true
      }, options);

      this.center = this.options.center;
      this.zoom = this.options.zoom;

      this._tilePane = document.createElement('div'); this._tilePane.className = 'atlas-pane atlas-tile-pane';
      this._overlayPane = document.createElement('div'); this._overlayPane.className = 'atlas-pane atlas-overlay-pane';
      this._popupPane = document.createElement('div'); this._popupPane.className = 'atlas-pane atlas-popup-pane';

      this.tileLayer = document.createElement('div'); this.tileLayer.className = 'atlas-tile-layer'; this._tilePane.appendChild(this.tileLayer);

      this._controlsPane = document.createElement('div'); this._controlsPane.className = 'atlas-pane atlas-controls-pane';
      this._controlCorners = {};
      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
        const c = document.createElement('div'); c.className = `atlas-control-corner atlas-${pos}`;
        this._controlsPane.appendChild(c); this._controlCorners[pos] = c;
      });

      this.container.append(this._tilePane, this._overlayPane, this._popupPane, this._controlsPane);

      this._layers = new Set();
      this._controls = new Set();
      this._renderScheduled = false;
      this._activeTiles = new Map();
      this._pointers = new Map();
      this._drag = { active: false, last: [] };

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => this._scheduleRender());
        this._resizeObserver.observe(this.container);
      } else {
        this._onWinResize = () => this._scheduleRender();
        window.addEventListener('resize', this._onWinResize);
      }

      this._bindCoreEvents();

      if (this.options.attributionControl) {
        this.attributionControl = new AttributionControl('bottom-right', {
          prefix: this.options.showBrand ? { text: this.options.brandName, flag: this.options.brandFlag, link: this.options.brandLink, title: this.options.brandName, ariaFlagLabel: 'Morocco flag' } : { text: '' },
          attribution: this.options.attribution
        });
        this.addControl(this.attributionControl);
      }
      this.addControl(new ZoomControl('top-right'));

      this._scheduleRender();
      this.fire('ready', { map: this });
    }

    destroy() {
      for (const l of [...this._layers]) this.removeLayer(l);
      for (const c of [...this._controls]) c.remove();
      this._resizeObserver?.disconnect();
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      this._unbindCoreEvents();
      cancelAnimationFrame(this._animRAF);
      cancelAnimationFrame(this._animPanRAF);
      [this._tilePane, this._overlayPane, this._popupPane, this._controlsPane].forEach(p => p?.parentNode?.removeChild(p));
      for (const [, img] of this._activeTiles) img.parentNode?.removeChild(img);
      this._activeTiles.clear();
      this._pointers.clear();
      this.fire('destroy');
    }

    setView(center, zoom, opts = {}) {
      this.center = center;
      if (typeof zoom === 'number') this.zoom = clamp(zoom, this.options.minZoom, this.options.maxZoom);
      this._scheduleRender();
      if (opts.animate) this.fire('move');
      return this;
    }
    setCenter(center, opts = {}) { return this.setView(center, undefined, opts); }
    setZoom(zoom, opts = {}) { return this.setView(this.center, zoom, opts); }
    zoomIn(opts = {}) { return this.setZoom(this.zoom + (opts.delta || this.options.zoomDelta), opts); }
    zoomOut(opts = {}) { return this.setZoom(this.zoom - (opts.delta || this.options.zoomDelta), opts); }

    panTo(center, opts = {}) { return opts.animate ? this._animatePan(center, opts) : this.setCenter(center); }
    flyTo(center, zoom = this.zoom, opts = {}) {
      const s = { c: this.center, z: this.zoom, t: now() }, dur = Math.max(250, Math.min(1500, opts.duration || 800));
      const step = () => {
        const k = clamp((now() - s.t) / dur, 0, 1), e = easeOutCubic(k);
        this.center = [s.c[0] + (center[0] - s.c[0]) * e, s.c[1] + (center[1] - s.c[1]) * e];
        this.zoom = s.z + (zoom - s.z) * e;
        this._scheduleRender();
        if (k < 1) this._animRAF = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._animRAF);
      this._animRAF = requestAnimationFrame(step);
      return this;
    }

    fitBounds(bounds, padding = 20) {
      const [[s, w], [n, e]] = bounds;
      let z = this.options.maxZoom;
      const size = this._size(), ts = this.options.tileSize;
      while (z >= this.options.minZoom) {
        const pSW = project(s, w, z, ts), pNE = project(n, e, z, ts);
        if (Math.abs(pNE.x - pSW.x) + 2 * padding <= size.w && Math.abs(pSW.y - pNE.y) + 2 * padding <= size.h) break;
        z--;
      }
      return this.setView([(s + n) / 2, (w + e) / 2], z);
    }

    screenToLatLng(x, y) {
      const rect = this.container.getBoundingClientRect();
      const c = project(...this.center, this.zoom, this.options.tileSize);
      const worldX = c.x - this._size().w / 2 + (x - rect.left);
      const worldY = c.y - this._size().h / 2 + (y - rect.top);
      return unproject(worldX, worldY, this.zoom, this.options.tileSize);
    }

    addLayer(layer) { if (layer._map === this) return this; layer._map = this; this._layers.add(layer); layer.onAdd?.(this); this._scheduleRender(); this.fire('layeradd', { layer }); return this; }
    removeLayer(layer) { if (layer._map !== this) return this; layer.onRemove?.(this); this._layers.delete(layer); layer._map = null; this._scheduleRender(); this.fire('layerremove', { layer }); return this; }
    addControl(control) { if (control._map === this) return this; control.addTo(this); this._controls.add(control); return this; }
    removeControl(control) { if (control._map !== this) return this; control.remove(); this._controls.delete(control); return this; }

    addAttribution(t) { this.attributionControl?.addAttribution(t); return this; }
    removeAttribution(t) { this.attributionControl?.removeAttribution(t); return this; }
    clearAttributions() { this.attributionControl?.clearAttributions(); return this; }
    setBrand(p) { this.attributionControl?.setPrefix(p); return this; }

    _size() { return { w: this.container.clientWidth || 0, h: this.container.clientHeight || 0 }; }
    _latLngToWorldPoint(lat, lng) { return project(lat, lng, this.zoom, this.options.tileSize); }
    _latLngToPoint(lat, lng) {
      const pt = this._latLngToWorldPoint(lat, lng), c = project(...this.center, this.zoom, this.options.tileSize), s = this._size();
      return { left: s.w / 2 + (pt.x - c.x), top: s.h / 2 + (pt.y - c.y) };
    }

    _scheduleRender() { if (this._renderScheduled) return; this._renderScheduled = true; requestAnimationFrame(() => this._render()); }

    _render() {
      this._renderScheduled = false;
      const z = Math.round(this.zoom), ts = this.options.tileSize, wt = 2 ** z, ws = wt * ts, s = this._size();
      const c = project(...this.center, z, ts);
      const ox = c.x - s.w / 2, oy = c.y - s.h / 2;
      const next = new Map(), buf = 1;
      const sx = Math.floor(ox / ts) - buf, sy = Math.floor(oy / ts) - buf, ex = Math.floor((ox + s.w) / ts) + buf, ey = Math.floor((oy + s.h) / ts) + buf;

      for (let ty = sy; ty <= ey; ty++) {
        if (ty < 0 || ty >= wt) continue;
        for (let tx = sx; tx <= ex; tx++) {
          const nx = this.options.wrapX ? wrap(tx, wt) : tx;
          if (nx < 0 || nx >= wt) continue;
          const leftBase = tx * ts - ox, top = ty * ts - oy;
          const mStart = this.options.wrapX ? Math.floor((-ts - leftBase) / ws) : 0;
          const mEnd = this.options.wrapX ? Math.ceil((s.w + ts - leftBase) / ws) : 0;
          for (let m = mStart; m <= mEnd; m++) {
            const left = leftBase + m * ws, key = `${z}_${nx}_${ty}_${m}`;
            let img = this._activeTiles.get(key);
            if (!img) { img = this._createTile(z, nx, ty); this.tileLayer.appendChild(img); }
            img.style.left = `${left}px`; img.style.top = `${top}px`;
            next.set(key, img);
          }
        }
      }
      for (const [k, img] of this._activeTiles) if (!next.has(k)) img.remove();
      this._activeTiles = next;

      for (const layer of this._layers) layer._updatePosition?.();

      this.fire('render', { center: this.center, zoom: this.zoom });
    }

    _createTile(z, x, y) {
      const img = document.createElement('img');
      img.className = 'atlas-tile';
      img.setAttribute('draggable', 'false');
      if (this.options.tileCrossOrigin != null) img.crossOrigin = this.options.tileCrossOrigin;

      const subs = Array.isArray(this.options.subdomains) ? this.options.subdomains : (typeof this.options.subdomains === 'string' ? this.options.subdomains.split('') : []);
      const sd = subs.length ? subs[(x + y) % subs.length] : '';
      const retina = this.options.tileRetina === 'auto' ? dpr() > 1 : !!this.options.tileRetina;
      const r = retina ? '@2x' : '';

      const url = this.options.tileUrl.replace('{s}', sd).replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', r);
      img.src = url;
      img.addEventListener('load', () => { img.classList.add('atlas-tile-loaded'); this.fire('tileload', { z, x, y, img }); }, { once: true });
      img.addEventListener('error', () => { img.classList.add('atlas-tile-loaded'); this.fire('tileerror', { z, x, y, img }); }, { once: true });
      img.style.width = `${this.options.tileSize}px`;
      img.style.height = `${this.options.tileSize}px`;
      return img;
    }

    _bindCoreEvents() {
      this._onPointerDown = e => {
        if (!this.options.draggable) return;
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.container.setPointerCapture(e.pointerId);
        if (this._pointers.size === 1) { this._drag.active = true; this._drag.last = [{ t: now(), x: e.clientX, y: e.clientY }]; this._setDraggingCursor(true); this.fire('movestart', { domEvent: e }); }
        e.preventDefault();
      };
      this._onPointerMove = e => {
        if (!this._pointers.has(e.pointerId)) return;
        const prev = this._pointers.get(e.pointerId);
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pointers.size === 1 && this._drag.active) {
          const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
          this._panBy(-dx, -dy);
          const t = now(); this._drag.last.push({ t, x: e.clientX, y: e.clientY }); if (this._drag.last.length > 6) this._drag.last.shift();
          this.fire('move', { domEvent: e, center: this.center });
        } else if (this._pointers.size === 2) {
          const pts = Array.from(this._pointers.values());
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (!this._pinchStart) this._pinchStart = { dist: d, mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
          else {
            const r = d / this._pinchStart.dist;
            if (r > 1.25) { this._zoomAbout(this._pinchStart.mid, +1); this._pinchStart.dist = d; }
            else if (r < 0.8) { this._zoomAbout(this._pinchStart.mid, -1); this._pinchStart.dist = d; }
          }
        }
      };
      this._onPointerUp = e => {
        if (this._pointers.has(e.pointerId)) { this._pointers.delete(e.pointerId); this.container.releasePointerCapture(e.pointerId); }
        if (this._pointers.size < 2) this._pinchStart = null;
        if (this._drag.active && this._pointers.size === 0) {
          this._drag.active = false; this._setDraggingCursor(false);
          if (this.options.inertia && this._drag.last.length >= 2) {
            const a = this._drag.last.at(-2), b = this._drag.last.at(-1), dt = Math.max(1, b.t - a.t);
            this._kineticPan((b.x - a.x) / dt, (b.y - a.y) / dt);
          }
          this.fire('moveend', { domEvent: e, center: this.center });
        }
      };
      this.container.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove, { passive: false });
      window.addEventListener('pointerup', this._onPointerUp);

      this._onWheel = e => {
        if (!this.options.wheelZoom) return;
        e.preventDefault();
        const dir = (e.deltaY || 0) > 0 ? -1 : 1;
        this._zoomAbout({ x: e.clientX, y: e.clientY }, dir);
      };
      this.container.addEventListener('wheel', this._onWheel, { passive: false });

      this._onDblClick = e => { if (this.options.doubleClickZoom) this._zoomAbout({ x: e.clientX, y: e.clientY }, +1); };
      this.container.addEventListener('dblclick', this._onDblClick);

      this._onClick = e => { const ll = this.screenToLatLng(e.clientX, e.clientY); this.fire('click', { latlng: ll, domEvent: e }); };
      this.container.addEventListener('click', this._onClick);

      this._onKey = e => {
        if (!this.options.keyboard) return;
        const step = 60;
        if (e.key === 'ArrowUp') this._panBy(0, step);
        else if (e.key === 'ArrowDown') this._panBy(0, -step);
        else if (e.key === 'ArrowLeft') this._panBy(step, 0);
        else if (e.key === 'ArrowRight') this._panBy(-step, 0);
        else if (e.key === '+' || e.key === '=') this.zoomIn({ animate: true });
        else if (e.key === '-' || e.key === '_') this.zoomOut({ animate: true });
      };
      this.container.tabIndex = 0;
      this.container.addEventListener('keydown', this._onKey);
    }

    _unbindCoreEvents() {
      this.container.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      this.container.removeEventListener('wheel', this._onWheel);
      this.container.removeEventListener('dblclick', this._onDblClick);
      this.container.removeEventListener('click', this._onClick);
      this.container.removeEventListener('keydown', this._onKey);
    }

    _setDraggingCursor(a) { this.container.classList.toggle('atlas-grabbing', a); this.container.classList.toggle('atlas-grab', !a); }
    _panBy(dx, dy) { const c = project(...this.center, this.zoom, this.options.tileSize); this.center = unproject(c.x + dx, c.y + dy, this.zoom, this.options.tileSize); this._scheduleRender(); }
    _kineticPan(vx, vy) {
      const t0 = now(), dur = 600;
      const step = () => {
        const t = (now() - t0) / dur; if (t >= 1) return;
        const e = easeOutCubic(1 - t); this._panBy(-vx * 200 * e, -vy * 200 * e);
        this._animPanRAF = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._animPanRAF);
      this._animPanRAF = requestAnimationFrame(step);
    }
    _zoomAbout(screenPt, dir) {
      const rect = this.container.getBoundingClientRect(), { w, h } = this._size();
      const anchor = { x: screenPt.x - rect.left, y: screenPt.y - rect.top };
      const anchorLL = this.screenToLatLng(screenPt.x, screenPt.y);
      const nz = clamp(Math.round(this.zoom + dir * this.options.zoomDelta), this.options.minZoom, this.options.maxZoom);
      if (nz === this.zoom) return;
      const p = project(...anchorLL, nz, this.options.tileSize);
      const cx = p.x - (anchor.x - w / 2), cy = p.y - (anchor.y - h / 2);
      this.setView(unproject(cx, cy, nz, this.options.tileSize), nz);
      this.fire('zoom', { zoom: nz, center: this.center });
      this.fire('zoomend', { zoom: nz, center: this.center });
    }
    _animatePan(center, opts) {
      const s = { lat: this.center[0], lng: this.center[1], t: now() }, dur = Math.max(250, Math.min(1200, opts.duration || 600));
      const step = () => {
        const k = clamp((now() - s.t) / dur, 0, 1), e = easeOutCubic(k);
        this.center = [s.lat + (center[0] - s.lat) * e, s.lng + (center[1] - s.lng) * e];
        this._scheduleRender();
        if (k < 1) this._animRAF = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._animRAF);
      this._animRAF = requestAnimationFrame(step);
      return this;
    }
  }

  const installed = new Set();
  const AtlasNS = {
    version: '0.1.2',
    Map, Marker, Popup, Control, Layer,
    controls: { Zoom: ZoomControl, Attribution: AttributionControl },
    utils: { project, unproject, clamp, wrap, easeOutCubic },
    use(plugin, options) {
      if (!plugin || installed.has(plugin)) return this;
      if (typeof plugin.install === 'function') plugin.install(AtlasNS, options || {});
      else if (typeof plugin === 'function') plugin(AtlasNS, options || {});
      installed.add(plugin);
      return this;
    }
  };

  return AtlasNS;
})();

export default Atlas;
