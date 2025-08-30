/*!
 * Atlas.js v0.1.6 (Stability Cut)
 * Author: ElWali ElAlaoui
 * License: BSD-2-Clause
 * Description: A tiny, modern, pluggable web map engine with Google Maps–style markers
 * Notes:
 * - ESM module (default export)
 * - No dependencies
 * - Accessible, extensible, and community-friendly
 */

;(() => {
  if (typeof document === 'undefined') return;

  const STYLE_ID = 'atlasjs-style-v016';
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
.atlas-tile-layer{position:absolute;top:0;left:0;will-change:transform;transform-origin:0 0}
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

/**
 * @typedef {[number, number]} LatLng
 * @description A latitude/longitude tuple in degrees: [lat, lng]
 *
 * @typedef {[[number, number],[number, number]]} Bounds
 * @description SW/NE bounds in degrees: [[south, west], [north, east]]
 *
 * @typedef {'top-left'|'top-right'|'bottom-left'|'bottom-right'} ControlPosition
 *
 * @typedef {Object} AttributionPrefix
 * @property {string} [text='Atlas.js'] Displayed brand text
 * @property {string} [flag='🇲🇦'] Emoji flag shown next to the brand
 * @property {string} [link='https://atlasjs.dev'] External link for the brand
 * @property {string} [title='Atlas.js'] Tooltip for the brand link
 * @property {string} [ariaFlagLabel='Morocco flag'] Accessible label for the flag emoji
 *
 * @typedef {Object} AttributionOptions
 * @property {AttributionPrefix} [prefix] Brand prefix options
 * @property {string|string[]} [attribution] Provider credits, e.g., '© OpenStreetMap contributors'
 *
 * @typedef {Object} MarkerOptions
 * @property {string} [color] CSS color for pin
 * @property {boolean} [draggable=false] Enable drag interaction
 * @property {string} [ariaLabel='Map marker'] ARIA label for accessibility
 *
 * @typedef {Object} PopupOptions
 * @property {boolean} [closeButton=true] Show close button
 *
 * @typedef {Object} MapOptions
 * @property {LatLng} [center=[0,0]] Initial center
 * @property {number} [zoom=2] Initial zoom
 * @property {number} [minZoom=0] Min zoom
 * @property {number} [maxZoom=20] Max zoom
 * @property {string} [tileUrl='https://tile.openstreetmap.org/{z}/{x}/{y}{r}.png'] Tile URL template
 * @property {number} [tileSize=256] Tile size
 * @property {string|string[]} [subdomains=[]] Tile subdomains for load balancing
 * @property {'auto'|boolean} [tileRetina='auto'] Retina tiles: auto detect DPR, or force true/false
 * @property {null|string} [tileCrossOrigin='anonymous'] crossOrigin attribute for tile images
 * @property {boolean} [wrapX=true] Enable horizontal world wrap
 * @property {boolean} [wheelZoom=true] Enable wheel zoom
 * @property {boolean} [doubleClickZoom=true] Enable double-click zoom
 * @property {boolean} [draggable=true] Enable dragging
 * @property {boolean} [inertia=true] Inertial panning
 * @property {number} [zoomDelta=1] Zoom step amount
 * @property {string|string[]} [attribution='© OpenStreetMap contributors'] Initial attributions
 * @property {boolean} [attributionControl=true] Show attribution control
 * @property {boolean} [keyboard=true] Enable arrow keys and +/- zoom
 * @property {string} [ariaLabel='Interactive map'] ARIA label for the map region
 * @property {string} [brandName='Atlas.js'] Brand text in attribution
 * @property {string} [brandFlag='🇲🇦'] Brand flag emoji in attribution
 * @property {string} [brandLink='https://atlasjs.dev'] Brand link in attribution
 * @property {boolean} [showBrand=true] Toggle brand prefix display
 * @property {boolean} [fractionalZoom=true] Enable smooth fractional zoom rendering
 * @property {Bounds|null} [maxBounds=null] Restrict center within bounds (simple clamp)
 */

const Atlas = (() => {
  'use strict';

  /* ========== Utilities ========== */

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;
  const MERC_MAX_LAT = 85.05112878;

  /** Clamp a number */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  /** Wrap integer to [0, max) */
  const wrap = (x, max) => ((x % max) + max) % max;
  /** Easing ease-out cubic */
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  /** Monotonic time in ms */
  const now = () => (performance?.now?.() || Date.now());
  /** High-DPI factor [1,3] */
  const dpr = () => Math.max(1, Math.min(3, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1));
  /** Normalize longitude to [-180, 180) */
  const normalizeLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;

  /**
   * Project a LatLng to world pixel coordinates in Web Mercator.
   * @param {number} lat
   * @param {number} lng
   * @param {number} zoom
   * @param {number} [tileSize=256]
   * @returns {{x:number,y:number}}
   */
  const project = (lat, lng, zoom, tileSize = 256) => {
    const latC = clamp(lat, -MERC_MAX_LAT, MERC_MAX_LAT);
    const rad = latC * DEG2RAD;
    const n = 2 ** zoom;
    const x = (lng + 180) / 360 * n * tileSize;
    const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * tileSize;
    return { x, y };
  };

  /**
   * Unproject world pixel coordinates to LatLng in Web Mercator.
   * @param {number} x
   * @param {number} y
   * @param {number} zoom
   * @param {number} [tileSize=256]
   * @returns {LatLng}
   */
  const unproject = (x, y, zoom, tileSize = 256) => {
    const n = 2 ** zoom;
    const lng = (x / (tileSize * n)) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (tileSize * n))));
    return [latRad * RAD2DEG, lng];
  };

  /* ========== Enhanced Event Emitter (stabilized) ========== */

  /**
   * @typedef {Object} EventListenerOptions
   * @property {boolean} [once=false]
   * @property {number} [priority=0]
   * @property {any} [context]
   *
   * @typedef {Object} AtlasEvent
   * @property {string} type
   * @property {string[]} namespaces
   * @property {any} target
   * @property {number} timeStamp
   * @property {any} data
   * @property {boolean} defaultPrevented
   * @property {boolean} propagationStopped
   * @property {boolean} immediatePropagationStopped
   * @property {()=>void} preventDefault
   * @property {()=>void} stopPropagation
   * @property {()=>void} stopImmediatePropagation
   */

  class Emitter {
    constructor() {
      /** @type {Map<string, Array<{fn:Function,once:boolean,priority:number,ctx:any,ns:string[],i:number}>>} */
      this._events = new Map();
      /** @type {Array<{fn:Function,once:boolean,priority:number,ctx:any,ns:string[],i:number}>} */
      this._any = [];
      this._dirty = new Set();
      this._maxListeners = 64;
      this._seq = 0;
      this._queue = [];
      this._flushScheduled = false;
    }

    eventNames() { return Array.from(this._events.keys()); }
    setMaxListeners(n) { this._maxListeners = n > 0 ? n : Infinity; }

    /**
     * Subscribe to events (supports namespaces: 'move.ui')
     * @param {string|string[]} event
     * @param {(payload:any, evt:AtlasEvent)=>void} fn
     * @param {EventListenerOptions} [opts]
     * @returns {this}
     */
    on(event, fn, opts = {}) {
      if (Array.isArray(event)) { event.forEach(e => this.on(e, fn, opts)); return this; }
      const { type, ns } = this._parse(event);
      const rec = { fn, once: !!opts.once, priority: opts.priority || 0, ctx: opts.context, ns, i: this._seq++ };
      if (type === '*') { this._any.push(rec); this._dirty.add('*'); return this; }
      const arr = this._events.get(type) || [];
      arr.push(rec);
      this._events.set(type, arr);
      this._dirty.add(type);
      if (arr.length > this._maxListeners) {
        console.warn(`[Atlas] '${type}' has ${arr.length} listeners (max ${this._maxListeners}). Consider setMaxListeners().`);
      }
      return this;
    }

    /** Subscribe once */
    once(event, fn, opts = {}) { return this.on(event, fn, Object.assign({}, opts, { once: true })); }

    /** Subscribe to all events */
    onAny(fn, opts = {}) {
      const rec = { fn, once: !!opts.once, priority: opts.priority || 0, ctx: opts.context, ns: [], i: this._seq++ };
      this._any.push(rec);
      this._dirty.add('*');
      return this;
    }
    /** Remove handlers */
    offAny(fn) { if (!fn) this._any.length = 0; else this._any = this._any.filter(r => r.fn !== fn); return this; }

    /**
     * Unsubscribe
     * - off() => remove all
     * - off(fn) => remove function from all events
     * - off('move') => clear all 'move' listeners
     * - off('move.ui') => remove 'move' listeners with namespace 'ui'
     * - off('.ui') => remove listeners with namespace 'ui' on all events
     * - off('move', fn) => remove that function for 'move'
     * @param {string|Function} [eventOrFn]
     * @param {Function} [fn]
     * @returns {this}
     */
    off(eventOrFn, fn) {
      if (!eventOrFn && !fn) { this._events.clear(); this._any.length = 0; this._dirty.clear(); return this; }
      if (typeof eventOrFn === 'function' && !fn) { this._removeFnEverywhere(eventOrFn); return this; }
      if (typeof eventOrFn === 'string') { this._removeBySpec(this._parse(eventOrFn), fn); return this; }
      if (!eventOrFn && typeof fn === 'function') { this._removeFnEverywhere(fn); }
      return this;
    }

    /**
     * Emit (sync)
     * @param {string} event
     * @param {any} [payload]
     * @returns {this}
     */
    emit(event, payload) {
      const { type, ns } = this._parse(event);
      const evt = this._createEvent(type, ns, payload);
      const sortIfDirty = (key, arr) => {
        if (!arr || arr.length === 0) return arr;
        if (this._dirty.has(key)) { arr.sort((a, b) => (b.priority - a.priority) || (a.i - b.i)); this._dirty.delete(key); }
        return arr;
      };
      const any = sortIfDirty('*', this._any)?.slice() || [];
      for (const rec of any) {
        rec.fn.call(rec.ctx || this, payload, evt);
        if (rec.once) this._removeRecord('*', rec.fn, rec.ns);
        if (evt.immediatePropagationStopped) return this;
      }
      const arr = sortIfDirty(type, this._events.get(type))?.slice() || [];
      for (const rec of arr) {
        if (!this._nsIncludes(rec.ns, ns)) continue;
        rec.fn.call(rec.ctx || this, payload, evt);
        if (rec.once) this._removeRecord(type, rec.fn, rec.ns);
        if (evt.immediatePropagationStopped) return this;
      }
      return this;
    }
    /** Alias for emit */
    fire(event, payload) { return this.emit(event, payload); }

    /**
     * Emit asynchronously (batched on microtask)
     * @param {string} event
     * @param {any} [payload]
     * @returns {this}
     */
    emitAsync(event, payload) {
      this._queue.push([event, payload]);
      if (this._flushScheduled) return this;
      this._flushScheduled = true;
      const flush = () => {
        this._flushScheduled = false;
        while (this._queue.length) {
          const batch = this._queue.splice(0, this._queue.length);
          for (const [e, p] of batch) this.emit(e, p);
        }
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(flush);
      else Promise.resolve().then(flush);
      return this;
    }
    /** Alias for emitAsync */
    fireAsync(event, payload) { return this.emitAsync(event, payload); }

    listenerCount(event) {
      if (!event) { let total = this._any.length; for (const a of this._events.values()) total += a.length; return total; }
      const { type, ns } = this._parse(event);
      if (type === '*') return ns && ns.length ? this._any.filter(r => this._nsIncludes(r.ns, ns)).length : this._any.length;
      const arr = this._events.get(type) || [];
      return ns && ns.length ? arr.filter(r => this._nsIncludes(r.ns, ns)).length : arr.length;
    }
    listeners(event) {
      const { type, ns } = this._parse(event);
      if (type === '*') return (ns && ns.length ? this._any.filter(r => this._nsIncludes(r.ns, ns)) : this._any).map(r => r.fn);
      const arr = this._events.get(type) || [];
      return (ns && ns.length ? arr.filter(r => this._nsIncludes(r.ns, ns)) : arr).map(r => r.fn);
    }

    /**
     * Pipe events to another emitter.
     * @param {Emitter} target
     * @param {{events?:string[]|'*', prefix?:string}} [opt]
     * @returns {()=>void} unpipe
     */
    pipeTo(target, opt = {}) {
      const { events = '*', prefix = '' } = opt;
      if (events === '*') {
        const h = (p, e) => target.emit(prefix ? `${prefix}${e.type}` : e.type, p);
        this.onAny(h);
        return () => this.offAny(h);
      }
      const handlers = [];
      for (const ev of events) {
        const h = p => target.emit(prefix ? `${prefix}${ev}` : ev, p);
        this.on(ev, h);
        handlers.push([ev, h]);
      }
      return () => handlers.forEach(([ev, h]) => this.off(ev, h));
    }

    /* Internals */

    _parse(spec) {
      const s = String(spec || '').trim();
      const parts = s.split('.').filter(Boolean);
      let type = parts[0] || '';
      let ns = parts.slice(1);
      if (s.startsWith('.')) { type = '*'; ns = parts; }
      if (type === '*') ns = parts.slice(1);
      ns.sort();
      return { type: type || '*', ns };
    }
    _nsIncludes(listenerNs, emitNs) { if (!emitNs || emitNs.length === 0) return true; return emitNs.every(n => listenerNs.includes(n)); }
    _removeFnEverywhere(fn) {
      this._any = this._any.filter(r => r.fn !== fn);
      for (const [type, arr] of this._events) {
        const kept = arr.filter(r => r.fn !== fn);
        if (kept.length === 0) this._events.delete(type); else this._events.set(type, kept);
      }
    }
    _removeBySpec(spec, fn) {
      if (spec.type === '*') {
        if (fn) this._any = this._any.filter(r => r.fn !== fn || (spec.ns.length && !this._nsIncludes(r.ns, spec.ns)));
        else if (spec.ns.length) this._any = this._any.filter(r => !this._nsIncludes(r.ns, spec.ns));
        else this._any.length = 0;
        for (const [type, arr] of this._events) {
          const kept = arr.filter(r => {
            if (fn && r.fn !== fn) return true;
            if (spec.ns.length && !this._nsIncludes(r.ns, spec.ns)) return true;
            return false;
          });
          if (kept.length === 0) this._events.delete(type); else this._events.set(type, kept);
        }
        return;
      }
      const arr = this._events.get(spec.type) || [];
      if (!arr.length) return;
      const kept = arr.filter(r => {
        if (fn && r.fn !== fn) return true;
        if (spec.ns.length && !this._nsIncludes(r.ns, spec.ns)) return true;
        return false;
      });
      if (kept.length === 0) this._events.delete(spec.type); else this._events.set(spec.type, kept);
    }
    _removeRecord(type, fn, ns) {
      if (type === '*') { this._any = this._any.filter(r => !(r.fn === fn && this._nsIncludes(r.ns, ns))); return; }
      const arr = this._events.get(type); if (!arr) return;
      const kept = arr.filter(r => !(r.fn === fn && this._nsIncludes(r.ns, ns)));
      if (kept.length === 0) this._events.delete(type); else this._events.set(type, kept);
    }
    _createEvent(type, namespaces, payload) {
      return {
        type, namespaces, target: this, timeStamp: now(), data: payload,
        defaultPrevented: false, propagationStopped: false, immediatePropagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        stopImmediatePropagation() { this.immediatePropagationStopped = true; this.propagationStopped = true; }
      };
    }
  }

  /* ========== Base Layer and Control ========== */

  class Layer {
    /** @param {Map} map */ onAdd(_map) {}
    /** @param {Map} map */ onRemove(_map) {}
    /** Add to map */ addTo(map) { map.addLayer(this); return this; }
    /** Remove from map */ remove() { this._map?.removeLayer(this); }
  }

  class Control {
    /**
     * @param {ControlPosition} [position='top-right']
     */
    constructor(position = 'top-right') {
      this.position = position;
      this._map = null;
      this.el = document.createElement('div');
      this.el.className = 'atlas-control';
    }
    /** @param {Map} _map */ onAdd(_map) {}
    /** @param {Map} _map */ onRemove(_map) {}
    /** Add to map */
    addTo(map) {
      if (this._map) return this;
      this._map = map;
      const corner = map._controlCorners[this.position] || map._controlCorners['top-right'];
      corner.appendChild(this.el);
      this.onAdd?.(map);
      return this;
    }
    /** Remove from map */
    remove() {
      if (!this._map) return;
      this.onRemove?.(this._map);
      this.el?.parentNode?.removeChild(this.el);
      this._map = null;
    }
  }

  /* ========== Built-in Controls ========== */

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
    /**
     * @param {ControlPosition} [position='bottom-right']
     * @param {AttributionOptions} [options]
     */
    constructor(position = 'bottom-right', options = {}) {
      super(position);
      this.el.classList.add('atlas-attribution');
      this._prefix = Object.assign(
        { text: 'Atlas.js', flag: '🇲🇦', link: 'https://atlasjs.dev', title: 'Atlas.js', ariaFlagLabel: 'Morocco flag' },
        options.prefix || {}
      );
      this._items = new Set();
      const items = Array.isArray(options.attribution) ? options.attribution : (options.attribution ? [options.attribution] : []);
      items.forEach(a => this._items.add(a));
      this._brand = document.createElement('span'); this._brand.className = 'atlas-brand';
      this._sep = document.createElement('span'); this._sep.className = 'atlas-sep'; this._sep.textContent = '|';
      this._credits = document.createElement('span'); this._credits.className = 'atlas-credits';
      this.el.append(this._brand, this._sep, this._credits);
    }
    /** @param {Map} map */ onAdd(map) { this._map = map; this._render(); }
    onRemove() { this._map = null; }
    /** Update brand prefix */ setPrefix(prefix) { this._prefix = Object.assign({}, this._prefix, prefix || {}); this._render(); return this; }
    /** Add a credit (HTML allowed) */ addAttribution(text) { if (!text) return this; this._items.add(text); this._render(); this._map?.fire('attributionchange', { items: [...this._items] }); return this; }
    /** Remove a credit */ removeAttribution(text) { this._items.delete(text); this._render(); this._map?.fire('attributionchange', { items: [...this._items] }); return this; }
    /** Clear credits */ clearAttributions() { this._items.clear(); this._render(); this._map?.fire('attributionchange', { items: [] }); return this; }
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

  /* ========== Marker & Popup ========== */

  class Marker extends Layer {
    /**
     * @param {LatLng} latlng
     * @param {MarkerOptions} [options]
     */
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
      this._pid = undefined;
      this._start = undefined;
      this._popupBound = false;
    }
    /** @param {Map} map */
    onAdd(map) {
      map._overlayPane.appendChild(this.el);
      this._updatePosition();
      if (this.options.draggable) this._bindDrag();
      this._click = e => { e.stopPropagation(); map.fire('marker:click', { marker: this, latlng: this._latlng, domEvent: e }); };
      this.el.addEventListener('click', this._click);
    }
    /** @param {Map} map */
    onRemove(map) {
      this.el.removeEventListener('click', this._click);
      this.el.parentNode?.removeChild(this.el);
      this._unbindDrag();
    }
    /** Set position */ setLatLng(latlng) { this._latlng = latlng; this._updatePosition(); return this; }
    /** Get position */ getLatLng() { return this._latlng; }
    /** Update DOM position */
    _updatePosition() { if (!this._map) return; const { left, top } = this._map._latLngToPoint(...this._latlng); this.el.style.left = `${left}px`; this.el.style.top = `${top}px`; }
    /**
     * Bind a popup (idempotent)
     * @param {string|Node} html
     * @param {PopupOptions} [opts]
     * @returns {this}
     */
    bindPopup(html, opts = {}) {
      if (this._popupBound) { return this; }
      this._popupBound = true;
      this.el.addEventListener('click', () => new Popup(opts).setLatLng(this._latlng).setContent(html).openOn(this._map));
      this.el.setAttribute('aria-haspopup', 'dialog');
      return this;
    }
    _bindDrag() {
      this._onDown = e => { if (e.button !== 0 && e.pointerType !== 'touch') return; this._pid = e.pointerId; this.el.setPointerCapture(e.pointerId); this._start = { x: e.clientX, y: e.clientY, latlng: this._latlng }; this._map._setDraggingCursor(true); e.preventDefault(); };
      this._onMove = e => { if (e.pointerId !== this._pid) return; const dx = e.clientX - this._start.x, dy = e.clientY - this._start.y; const p0 = this._map._latLngToWorldPoint(...this._start.latlng); const ll = unproject(p0.x + dx, p0.y + dy, this._map.zoom, this._map.options.tileSize); this.setLatLng(ll); this._map.fire('marker:drag', { marker: this, latlng: ll }); };
      this._onUp = e => { if (e.pointerId !== this._pid) return; this._map._setDraggingCursor(false); this.el.releasePointerCapture(e.pointerId); this._map.fire('marker:dragend', { marker: this, latlng: this._latlng }); };
      this.el.addEventListener('pointerdown', this._onDown);
      window.addEventListener('pointermove', this._onMove, { passive: false });
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);
    }
    _unbindDrag() {
      if (!this._onDown) return;
      this.el.removeEventListener('pointerdown', this._onDown);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
      this._onDown = this._onMove = this._onUp = null;
    }
  }

  class Popup extends Layer {
    /**
     * @param {PopupOptions} [options]
     */
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
      this._latlng = undefined;
    }
    /** Set position */ setLatLng(latlng) { this._latlng = latlng; this._updatePosition(); return this; }
    /** Set content */ setContent(html) {
      if (typeof html === 'string') this._content.innerHTML = html;
      else if (html instanceof Node) { this._content.innerHTML = ''; this._content.appendChild(html); }
      const t = this._content.textContent || '';
      this.el.setAttribute('aria-label', t.substring(0, 120));
      return this;
    }
    /** Open on map */ openOn(map) { this.addTo(map); return this; }
    /** @param {Map} map */ onAdd(map) {
      map._popupPane.appendChild(this.el);
      this._updatePosition();
      this._clickAway = e => { if (!this.el.contains(e.target)) this.close(); };
      map.container.addEventListener('click', this._clickAway);
    }
    /** @param {Map} map */ onRemove(map) {
      map.container.removeEventListener('click', this._clickAway);
      this.el.parentNode?.removeChild(this.el);
    }
    _updatePosition() { if (!this._map || !this._latlng) return; const { left, top } = this._map._latLngToPoint(...this._latlng); this.el.style.left = `${left}px`; this.el.style.top = `${top}px`; }
    close() { this._map && this._map.removeLayer(this); }
  }

  /* ========== Map ========== */

  class Map extends Emitter {
    /**
     * @param {string|HTMLElement} container
     * @param {MapOptions} [options]
     */
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
        tileRetina: 'auto',
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
        showBrand: true,
        fractionalZoom: true,
        maxBounds: null
      }, options);

      this.center = this._applyConstraints(this.options.center);
      this.zoom = this.options.zoom;

      // Panes
      this._tilePane = document.createElement('div'); this._tilePane.className = 'atlas-pane atlas-tile-pane';
      this._overlayPane = document.createElement('div'); this._overlayPane.className = 'atlas-pane atlas-overlay-pane';
      this._popupPane = document.createElement('div'); this._popupPane.className = 'atlas-pane atlas-popup-pane';

      // Tiles root
      this.tileLayer = document.createElement('div'); this.tileLayer.className = 'atlas-tile-layer'; this._tilePane.appendChild(this.tileLayer);

      // Controls corners
      this._controlsPane = document.createElement('div'); this._controlsPane.className = 'atlas-pane atlas-controls-pane';
      this._controlCorners = {
        'top-left': document.createElement('div'),
        'top-right': document.createElement('div'),
        'bottom-left': document.createElement('div'),
        'bottom-right': document.createElement('div')
      };
      Object.entries(this._controlCorners).forEach(([pos, el]) => { el.className = `atlas-control-corner atlas-${pos}`; this._controlsPane.appendChild(el); });

      // Mount
      this.container.append(this._tilePane, this._overlayPane, this._popupPane, this._controlsPane);

      // State
      this._layers = new Set();
      this._controls = new Set();
      this._renderScheduled = false;
      this._activeTiles = new Map();
      this._pointers = new Map();
      this._pinchStart = null;
      this._drag = { active: false, last: [], moved: false };
      this._suppressClick = false;
      this._batchDepth = 0;
      this._needsRender = false;
      this._wheelDelta = 0;
      this._wheelFrame = null;

      // Resize observe
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => this._scheduleRender());
        this._resizeObserver.observe(this.container);
      } else {
        this._onWinResize = () => this._scheduleRender();
        window.addEventListener('resize', this._onWinResize);
      }

      this._bindCoreEvents();

      // Controls
      if (this.options.attributionControl) {
        this.attributionControl = new AttributionControl('bottom-right', {
          prefix: this.options.showBrand
            ? { text: this.options.brandName, flag: this.options.brandFlag, link: this.options.brandLink, title: this.options.brandName, ariaFlagLabel: 'Morocco flag' }
            : { text: '' },
          attribution: this.options.attribution
        });
        this.addControl(this.attributionControl);
      }
      this.addControl(new ZoomControl('top-right'));

      this._scheduleRender();
      this.fire('ready', { map: this });
    }

    /** Destroy the map instance and cleanup resources */
    destroy() {
      for (const l of [...this._layers]) this.removeLayer(l);
      for (const c of [...this._controls]) c.remove();
      this._resizeObserver?.disconnect();
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      this._unbindCoreEvents();
      cancelAnimationFrame(this._animRAF);
      cancelAnimationFrame(this._animPanRAF);
      cancelAnimationFrame(this._wheelFrame);
      [this._tilePane, this._overlayPane, this._popupPane, this._controlsPane].forEach(p => p?.parentNode?.removeChild(p));
      for (const [, img] of this._activeTiles) img.parentNode?.removeChild(img);
      this._activeTiles.clear();
      this._pointers.clear();
      this.fire('destroy');
    }

    /** Set center and zoom */
    setView(center, zoom, opts = {}) {
      this.center = this._applyConstraints(center);
      if (typeof zoom === 'number') this.zoom = clamp(zoom, this.options.minZoom, this.options.maxZoom);
      this._scheduleRender();
      if (opts.animate) this.fire('move');
      return this;
    }
    /** Set center only */ setCenter(center, opts = {}) { return this.setView(center, undefined, opts); }
    /** Set zoom only */ setZoom(zoom, opts = {}) { return this.setView(this.center, zoom, opts); }
    /** Get current center */ getCenter() { return this.center; }
    /** Get current zoom */ getZoom() { return this.zoom; }

    /** Get viewport bounds */
    getBounds() {
      const s = this._size();
      const c = project(...this.center, this.zoom, this.options.tileSize);
      const sw = unproject(c.x - s.w / 2, c.y + s.h / 2, this.zoom, this.options.tileSize);
      const ne = unproject(c.x + s.w / 2, c.y - s.h / 2, this.zoom, this.options.tileSize);
      return [[sw[0], sw[1]], [ne[0], ne[1]]];
    }

    /** Apply wrap and maxBounds constraints */
    _applyConstraints(c) {
      let [lat, lng] = c;
      lat = clamp(lat, -MERC_MAX_LAT, MERC_MAX_LAT);
      if (this.options.wrapX) lng = normalizeLng(lng);
      else lng = clamp(lng, -180, 180);
      const mb = this.options.maxBounds;
      if (mb) {
        const [[s, w], [n, e]] = mb;
        lat = clamp(lat, s, n);
        if (w <= e) lng = this.options.wrapX ? normalizeLng(clamp(lng, w, e)) : clamp(lng, w, e);
      }
      return [lat, lng];
    }

    /** Update tile source and refresh */
    setTileSource(src = {}) {
      Object.assign(this.options, src);
      for (const [, img] of this._activeTiles) img.parentNode?.removeChild(img);
      this._activeTiles.clear();
      this._scheduleRender();
      return this;
    }

    /** Set or clear max bounds */
    setMaxBounds(bounds) {
      this.options.maxBounds = bounds || null;
      this.center = this._applyConstraints(this.center);
      this._scheduleRender();
      return this;
    }

    /** Batch updates and render once */
    batch(fn) {
      this._batchDepth++;
      try { fn(this); } finally {
        this._batchDepth--;
        if (this._batchDepth === 0 && this._needsRender) { this._needsRender = false; this._scheduleRender(); }
      }
      return this;
    }

    /** Cancel ongoing animations */
    cancelAnimations() { cancelAnimationFrame(this._animRAF); cancelAnimationFrame(this._animPanRAF); return this; }

    zoomIn(opts = {}) { return this.setZoom(this.zoom + (opts.delta || this.options.zoomDelta), opts); }
    zoomOut(opts = {}) { return this.setZoom(this.zoom - (opts.delta || this.options.zoomDelta), opts); }

    /** Pan to center (optionally animated) */
    panTo(center, opts = {}) { return opts.animate ? this._animatePan(center, opts) : this.setCenter(center); }

    /** Smooth pan+zoom */
    flyTo(center, zoom = this.zoom, opts = {}) {
      const s = { c: this.center, z: this.zoom, t: now() }, dur = Math.max(250, Math.min(1500, opts.duration || 800));
      const step = () => {
        if (opts.signal?.aborted) return;
        const k = clamp((now() - s.t) / dur, 0, 1), e = easeOutCubic(k);
        this.center = this._applyConstraints([s.c[0] + (center[0] - s.c[0]) * e, s.c[1] + (center[1] - s.c[1]) * e]);
        this.zoom = s.z + (zoom - s.z) * e;
        this._scheduleRender();
        if (k < 1) this._animRAF = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._animRAF);
      this._animRAF = requestAnimationFrame(step);
      return this;
    }

    /** Fit view to bounds */
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

    /** Screen to LatLng */
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

    _scheduleRender() {
      if (this._batchDepth > 0) { this._needsRender = true; return; }
      if (this._renderScheduled) return;
      this._renderScheduled = true;
      requestAnimationFrame(() => this._render());
    }

    _render() {
      this._renderScheduled = false;

      // Fractional zoom rendering
      const ts = this.options.tileSize;
      const tileZ = this.options.fractionalZoom ? Math.floor(this.zoom) : Math.round(this.zoom);
      const scale = this.options.fractionalZoom ? Math.pow(2, this.zoom - tileZ) : 1;

      const worldTiles = 2 ** tileZ;
      const ws = worldTiles * ts;
      const s = this._size();
      const c0 = project(...this.center, tileZ, ts);
      const visW = s.w / scale;
      const visH = s.h / scale;
      const ox = c0.x - visW / 2;
      const oy = c0.y - visH / 2;

      // Tiles
      const next = new Map(), buf = 1;
      const sx = Math.floor(ox / ts) - buf, sy = Math.floor(oy / ts) - buf, ex = Math.floor((ox + visW) / ts) + buf, ey = Math.floor((oy + visH) / ts) + buf;

      for (let ty = sy; ty <= ey; ty++) {
        if (ty < 0 || ty >= worldTiles) continue;
        for (let tx = sx; tx <= ex; tx++) {
          const nx = this.options.wrapX ? wrap(tx, worldTiles) : tx;
          if (nx < 0 || nx >= worldTiles) continue;
          const leftBase = tx * ts - ox, top = ty * ts - oy;
          const mStart = this.options.wrapX ? Math.floor((-ts - leftBase) / ws) : 0;
          const mEnd = this.options.wrapX ? Math.ceil((visW + ts - leftBase) / ws) : 0;
          for (let m = mStart; m <= mEnd; m++) {
            const left = leftBase + m * ws, key = `${tileZ}_${nx}_${ty}_${m}`;
            let img = this._activeTiles.get(key);
            if (!img) { img = this._createTile(tileZ, nx, ty); this.tileLayer.appendChild(img); }
            img.style.left = `${left}px`; img.style.top = `${top}px`;
            next.set(key, img);
          }
        }
      }
      for (const [k, img] of this._activeTiles) if (!next.has(k)) img.remove();
      this._activeTiles = next;

      // Scale tiles for fractional zoom
      this.tileLayer.style.transform = scale !== 1 ? `scale(${scale})` : 'none';

      // Refresh overlays
      for (const layer of this._layers) layer._updatePosition?.();

      this.fire('render', { center: this.center, zoom: this.zoom });
      this.fireAsync('idle');
    }

    _createTile(z, x, y) {
      const img = document.createElement('img');
      img.className = 'atlas-tile';
      img.setAttribute('draggable', 'false');
      img.decoding = 'async';
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
        if (this._pointers.size === 1) {
          this._drag.active = true; this._drag.last = [{ t: now(), x: e.clientX, y: e.clientY }]; this._drag.moved = false;
          this._setDraggingCursor(true);
          this.fire('movestart', { domEvent: e });
        }
        e.preventDefault();
      };
      this._onPointerMove = e => {
        if (!this._pointers.has(e.pointerId)) return;
        const prev = this._pointers.get(e.pointerId);
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pointers.size === 1 && this._drag.active) {
          const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
          if (!this._drag.moved && (Math.abs(dx) + Math.abs(dy) > 2)) this._drag.moved = true;
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
            const a = this._drag.last[this._drag.last.length - 2], b = this._drag.last[this._drag.last.length - 1], dt = Math.max(1, b.t - a.t);
            this._kineticPan((b.x - a.x) / dt, (b.y - a.y) / dt);
          }
          if (this._drag.moved) this._suppressClick = true;
          this.fire('moveend', { domEvent: e, center: this.center });
        }
      };
      this.container.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove, { passive: false });
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);

      this._onWheel = e => {
        if (!this.options.wheelZoom) return;
        e.preventDefault();
        this._wheelDelta += (e.deltaY || 0);
        const pt = { x: e.clientX, y: e.clientY };
        if (this._wheelFrame) return;
        this._wheelFrame = requestAnimationFrame(() => {
          const dir = this._wheelDelta > 0 ? -1 : 1;
          this._wheelDelta = 0;
          this._wheelFrame = null;
          this._zoomAbout(pt, dir);
        });
      };
      this.container.addEventListener('wheel', this._onWheel, { passive: false });

      this._onDblClick = e => { if (this.options.doubleClickZoom) { this._suppressClick = true; this._zoomAbout({ x: e.clientX, y: e.clientY }, +1); } };
      this.container.addEventListener('dblclick', this._onDblClick);

      this._onClick = e => {
        if (this._suppressClick) { this._suppressClick = false; return; }
        const ll = this.screenToLatLng(e.clientX, e.clientY);
        this.fire('click', { latlng: ll, domEvent: e });
      };
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
      window.removeEventListener('pointercancel', this._onPointerUp);
      this.container.removeEventListener('wheel', this._onWheel);
      this.container.removeEventListener('dblclick', this._onDblClick);
      this.container.removeEventListener('click', this._onClick);
      this.container.removeEventListener('keydown', this._onKey);
    }

    _setDraggingCursor(active) { this.container.classList.toggle('atlas-grabbing', active); this.container.classList.toggle('atlas-grab', !active); }
    _panBy(dx, dy) {
      const c = project(...this.center, this.zoom, this.options.tileSize);
      this.center = this._applyConstraints(unproject(c.x + dx, c.y + dy, this.zoom, this.options.tileSize));
      this._scheduleRender();
    }
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
        if (opts.signal?.aborted) return;
        const k = clamp((now() - s.t) / dur, 0, 1), e = easeOutCubic(k);
        this.center = this._applyConstraints([s.lat + (center[0] - s.lat) * e, s.lng + (center[1] - s.lng) * e]);
        this._scheduleRender();
        if (k < 1) this._animRAF = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._animRAF);
      this._animRAF = requestAnimationFrame(step);
      return this;
    }
  }

  /* ========== Namespace & Plugin API ========== */

  /**
   * @typedef {(AtlasNS:any, options?:any)=>void|{install?:(AtlasNS:any, options?:any)=>void}} AtlasPlugin
   */

  const AtlasNS = {
    version: '0.1.6',
    Map, Marker, Popup, Control, Layer,
    controls: { Zoom: ZoomControl, Attribution: AttributionControl },
    utils: { project, unproject, clamp, wrap, easeOutCubic },
    /**
     * Install a plugin (once)
     * @param {AtlasPlugin} plugin
     * @param {any} [options]
     */
    use(plugin, options) {
      if (!plugin) return this;
      const key = plugin.install || plugin;
      if (!this._installed) this._installed = new Set();
      if (this._installed.has(key)) return this;
      if (typeof plugin.install === 'function') plugin.install(AtlasNS, options || {});
      else if (typeof plugin === 'function') plugin(AtlasNS, options || {});
      this._installed.add(key);
      return this;
    }
  };

  return AtlasNS;
})();

export default Atlas;
