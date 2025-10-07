/* Atlas.js is a lightweight JavaScript library for mobile-friendly interactive maps 🇲🇦 */
/*  © ElWali */
(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?
      factory(exports) :
      typeof define === 'function' && define.amd ?
      define(['exports'], factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis :
           global || self, factory(global.atlas = {}));
})(this, (function(exports) {
'use strict';

// Constants & helpers
const EARTH_RADIUS = 6378137;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;
const MAX_LATITUDE = 85.05112878;
const MIN_LATITUDE = -85.05112878;
const TILE_SIZE = 256;
const TILE_TTL = 86400000;
const TILE_LOAD_TIMEOUT_MS = 8000;
const INERTIA_DECEL = 0.0025;
const INERTIA_STOP_SPEED = 0.02;
const VELOCITY_WINDOW_MS = 120;
const DOUBLE_TAP_MAX_DELAY = 300;
const DOUBLE_TAP_MAX_MOVE = 16;
const TWO_FINGER_TAP_MAX_DELAY = 250;
const TWO_FINGER_TAP_MOVE_THRESH = 5;
const ROTATE_MOVE_THRESH_RAD = 0.05;
const WHEEL_ZOOM_STEP = 0.25;
const WHEEL_ZOOM_DURATION = 220;
const TAP_ZOOM_DURATION = 280;
const SNAP_DURATION = 300;
const FLYTO_DURATION = 800;
const LAYERS = {
  OSM: {
    name: "OpenStreetMap",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    background: "#e6e6e6", supportsRetina: true, maxCacheSize: 800
  },
  ESRI: {
    name: "Esri Satellite",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: 'Tiles © <a href="https://services.arcgisonline.com">Esri</a>',
    background: "#000", supportsRetina: false, maxCacheSize: 600
  },
  ESRI_TOPO: {
    name: "Esri Topographic",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
    attribution: 'Tiles © <a href="https://services.arcgisonline.com">Esri</a>',
    background: "#f5f5f0", supportsRetina: false, maxCacheSize: 600
  }
};
const DEFAULT_CONFIG = {
  defaultLayer: "OSM",
  defaultCenter: { lon: 0, lat: 0 },
  defaultZoom: 3,
  debug: new URLSearchParams(window.location.search).has('debug')
};
const EASING = {
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  linear: t => t
};
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
function normalizeAngle(rad) { return Math.atan2(Math.sin(rad), Math.cos(rad)); }
function shortestAngleDiff(from, to) { return normalizeAngle(to - from); }
function wrapDeltaLon(delta) { delta = ((delta + 180) % 360 + 360) % 360 - 180; return delta; }
function rot(x, y, ang) { const c = Math.cos(ang), s = Math.sin(ang); return { x: x * c - y * s, y: x * s + y * c }; }

// GIS utilities
class GISUtils {
  static wrapLongitude(l) { while (l > 180) l -= 360; while (l < -180) l += 360; return l; }
  static clampLatitude(lat) { return Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, lat)); }
  // meters per pixel at given latitude & zoom
  static getResolution(lat, z) { return (EARTH_CIRCUMFERENCE * Math.cos(lat * DEG2RAD)) / (Math.pow(2, z) * TILE_SIZE); }
  static formatDistance(m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km"; }
}

class Evented {
	constructor() {
		this._events = {};
	}

	on(types, fn, context) {
		if (typeof types === 'object') {
			for (const type in types) {
				this._on(type, types[type], fn);
			}
		} else {
			types = types.split(' ');
			for (let i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}
		return this;
	}

	off(types, fn, context) {
		if (!types) {
			delete this._events;
		} else if (typeof types === 'object') {
			for (const type in types) {
				this._off(type, types[type], fn);
			}
		} else {
			types = types.split(' ');
			for (let i = 0, len = types.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}
		return this;
	}

	_on(type, fn, context) {
		this._events = this._events || {};
		let typeListeners = this._events[type];
		if (!typeListeners) {
			typeListeners = [];
			this._events[type] = typeListeners;
		}
		if (context === this) {
			context = undefined;
		}
		const newListener = {fn: fn, ctx: context};
		for (let i = 0, len = typeListeners.length; i < len; i++) {
			if (typeListeners[i].fn === fn && typeListeners[i].ctx === context) {
				return;
			}
		}
		typeListeners.push(newListener);
	}

	_off(type, fn, context) {
		let listeners,
		    i,
		    len;
		if (!this._events) { return; }
		listeners = this._events[type];
		if (!listeners) { return; }
		if (!fn) {
			this.fire(type, {type: `${type}:removed`});
			delete this._events[type];
			return;
		}
		if (context === this) {
			context = undefined;
		}
		if (listeners) {
			for (i = 0, len = listeners.length; i < len; i++) {
				const l = listeners[i];
				if (l.ctx !== context) { continue; }
				if (l.fn === fn) {
					l.fn = function () {};
					this._firingCount = this._firingCount + 1;
					this.fire(type, {
						type: `${type}:removed`,
						listener: l.fn
					});
					this._firingCount = this._firingCount - 1;
					return;
				}
			}
		}
	}

	fire(type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }
		const event = {
			type: type,
			target: this,
			sourceTarget: data && data.sourceTarget || this
		};
		if (data) {
			for (const i in data) {
				event[i] = data[i];
			}
		}
		if (this._events) {
			const listeners = this._events[type];
			if (listeners) {
				this._firingCount = (this._firingCount || 0) + 1;
				for (let i = 0, len = listeners.length; i < len; i++) {
					const l = listeners[i];
					l.fn.call(l.ctx || this, event);
				}
				this._firingCount--;
			}
		}
		if (propagate) {
			this._propagateEvent(event);
		}
		return this;
	}

	listens(type, propagate) {
		const listeners = this._events && this._events[type];
		if (listeners && listeners.length > 0) { return true; }
		if (propagate) {
			for (const id in this._eventParents) {
				if (this._eventParents[id].listens(type, propagate)) { return true; }
			}
		}
		return false;
	}

	once(types, fn, context) {
		if (typeof types === 'object') {
			for (const type in types) {
				this.once(type, types[type], fn);
			}
			return this;
		}
		const once = (...args) => {
			this
			    .off(types, fn, context)
			    .off(types, once, context);
			return fn.apply(context || this, args);
		};
		once.fn = fn;
		return this
		    .on(types, once, context);
	}

	addEventParent(obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[obj._atlas_id] = obj;
		return this;
	}

	removeEventParent(obj) {
		if (this._eventParents) {
			delete this._eventParents[obj._atlas_id];
		}
		return this;
	}

	_propagateEvent(e) {
		for (const id in this._eventParents) {
			this._eventParents[id].fire(e.type, e, true);
		}
	}
}

function toPoint(x, y, round) {
	if (x instanceof Point) {
		return x;
	}
	if (Array.isArray(x)) {
		return new Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	if (typeof x === 'object' && 'x' in x && 'y' in x) {
		return new Point(x.x, x.y);
	}
	return new Point(x, y, round);
}

class Point {
	constructor(x, y, round) {
		this.x = (round ? Math.round(x) : x);
		this.y = (round ? Math.round(y) : y);
	}

	clone() {
		return new Point(this.x, this.y);
	}

	add(other) {
		return this.clone()._add(toPoint(other));
	}

	_add(other) {
		this.x += other.x;
		this.y += other.y;
		return this;
	}

	subtract(other) {
		return this.clone()._subtract(toPoint(other));
	}

	_subtract(other) {
		this.x -= other.x;
		this.y -= other.y;
		return this;
	}

	divideBy(num) {
		return this.clone()._divideBy(num);
	}

	_divideBy(num) {
		this.x /= num;
		this.y /= num;
		return this;
	}

	multiplyBy(num) {
		return this.clone()._multiplyBy(num);
	}

	_multiplyBy(num) {
		this.x *= num;
		this.y *= num;
		return this;
	}

	scaleBy(scale) {
		return new Point(this.x * scale.x, this.y * scale.y);
	}

	unscaleBy(scale) {
		return new Point(this.x / scale.x, this.y / scale.y);
	}

	round() {
		return this.clone()._round();
	}

	_round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	floor() {
		return this.clone()._floor();
	}

	_floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	ceil() {
		return this.clone()._ceil();
	}

	_ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	distanceTo(other) {
		other = toPoint(other);
		const x = other.x - this.x;
		const y = other.y - this.y;
		return Math.sqrt(x * x + y * y);
	}

	equals(other) {
		other = toPoint(other);
		return other.x === this.x &&
		       other.y === this.y;
	}

	contains(other) {
		other = toPoint(other);
		return Math.abs(other.x) <= Math.abs(this.x) &&
		       Math.abs(other.y) <= Math.abs(this.y);
	}

	toString() {
		return `Point(${this.x}, ${this.y})`;
	}
}

function toLatLng(a, b) {
	if (a instanceof LatLng) {
		return a;
	}
	if (Array.isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new LatLng(a, b);
}

class LatLng {
	constructor(lat, lng, alt) {
		if (isNaN(lat) || isNaN(lng)) {
			throw new Error(`Invalid LatLng object: (${lat}, ${lng})`);
		}
		this.lat = +lat;
		this.lng = +lng;
		if (alt !== undefined) {
			this.alt = +alt;
		}
	}

	equals(other, maxMargin) {
		if (!other) { return false; }
		other = toLatLng(other);
		const margin = Math.max(
		        Math.abs(this.lat - other.lat),
		        Math.abs(this.lng - other.lng));
		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	}

	toString() {
		return `LatLng(${this.lat}, ${this.lng})`;
	}

	distanceTo(other) {
		other = toLatLng(other);
		const R = EARTH_RADIUS;
		const dLat = (other.lat - this.lat) * (Math.PI / 180);
		const dLon = (other.lng - this.lng) * (Math.PI / 180);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.lat * (Math.PI / 180)) * Math.cos(other.lat * (Math.PI / 180)) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	wrap() {
		const lng = this.lng;
		this.lng = (lng + 180) % 360;
		if (this.lng < 0) {
			this.lng += 360;
		}
		this.lng -= 180;
		return this;
	}

	clone() {
		return new LatLng(this.lat, this.lng, this.alt);
	}
}

function toLatLngBounds(a, b) {
	if (!a || a instanceof LatLngBounds) {
		return a;
	}
	return new LatLngBounds(a, b);
}

class LatLngBounds {
	constructor(corner1, corner2) {
		if (corner1) {
			for (let i = 0, len = corner1.length; i < len; i++) {
				this.extend(corner1[i]);
			}
		}
		if (corner2) {
			this.extend(corner2);
		}
	}

	extend(obj) {
		const latLng = toLatLng(obj);
		if (latLng) {
			if (!this._southWest && !this._northEast) {
				this._southWest = new LatLng(latLng.lat, latLng.lng);
				this._northEast = new LatLng(latLng.lat, latLng.lng);
			} else {
				this._southWest.lat = Math.min(latLng.lat, this._southWest.lat);
				this._southWest.lng = Math.min(latLng.lng, this._southWest.lng);
				this._northEast.lat = Math.max(latLng.lat, this._northEast.lat);
				this._northEast.lng = Math.max(latLng.lng, this._northEast.lng);
			}
		} else if (obj instanceof LatLngBounds) {
			this.extend(obj._southWest);
			this.extend(obj._northEast);
		}
		return this;
	}

	getCenter() {
		return new LatLng(
			(this._southWest.lat + this._northEast.lat) / 2,
			(this._southWest.lng + this._northEast.lng) / 2
		);
	}

	getSouthWest() {
		return this._southWest;
	}

	getNorthEast() {
		return this._northEast;
	}

	getNorthWest() {
		return new LatLng(this.getNorth(), this.getWest());
	}

	getSouthEast() {
		return new LatLng(this.getSouth(), this.getEast());
	}

	getWest() {
		return this._southWest.lng;
	}

	getSouth() {
		return this._southWest.lat;
	}

	getEast() {
		return this._northEast.lng;
	}

	getNorth() {
		return this._northEast.lat;
	}

	contains(obj) {
		let latLng = toLatLng(obj);
		if (latLng) {
			return (
				(latLng.lat >= this._southWest.lat) && (latLng.lat <= this._northEast.lat) &&
				(latLng.lng >= this._southWest.lng) && (latLng.lng <= this._northEast.lng)
			);
		}

		latLng = toLatLngBounds(obj);
		if (latLng) {
			return this.contains(latLng._southWest) && this.contains(latLng._northEast);
		}

		return false;
	}

	intersects(other) {
		other = toLatLngBounds(other);
		const sw = this._southWest,
		      ne = this._northEast,
		      sw2 = other._southWest,
		      ne2 = other._northEast;
		const latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat);
		const lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);
		return latIntersects && lngIntersects;
	}

	equals(other, maxMargin) {
		if (!other) { return false; }
		other = toLatLngBounds(other);
		return this._southWest.equals(other.getSouthWest(), maxMargin) &&
		       this._northEast.equals(other.getNorthEast(), maxMargin);
	}

	toBBoxString() {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	}

	isValid() {
		return !!(this._southWest && this._northEast);
	}
}

// Projection classes
class Projection {
  project(latlng) { throw new Error('project() must be implemented'); }
  unproject(point) { throw new Error('unproject() must be implemented'); }
}
class WebMercatorProjection extends Projection {
  project(latlng) {
    const d = EARTH_RADIUS;
    const lat = Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, latlng.lat));
    const sin = Math.sin(lat * DEG2RAD);
    return { x: d * latlng.lon * DEG2RAD, y: d * Math.log((1 + sin) / (1 - sin)) / 2 };
  }
  unproject(point) {
    const d = EARTH_RADIUS;
    return { lon: (point.x / d) * RAD2DEG, lat: (2 * Math.atan(Math.exp(point.y / d)) - Math.PI / 2) * RAD2DEG };
  }
  latLngToTile(latlng, zoom) {
    const scale = Math.pow(2, zoom);
    const p = this.project(latlng);
    return { x: (p.x + Math.PI * EARTH_RADIUS) / (2 * Math.PI * EARTH_RADIUS) * scale, y: (Math.PI * EARTH_RADIUS - p.y) / (2 * Math.PI * EARTH_RADIUS) * scale };
  }
  tileToLatLng(x, y, zoom) {
    const scale = Math.pow(2, zoom);
    const p = { x: x / scale * 2 * Math.PI * EARTH_RADIUS - Math.PI * EARTH_RADIUS, y: Math.PI * EARTH_RADIUS - y / scale * 2 * Math.PI * EARTH_RADIUS };
    return this.unproject(p);
  }
}
const DEFAULT_PROJECTION = new WebMercatorProjection();

// Base Layer class
class Layer extends Evented {
  constructor(options = {}) {
		super();
		this.options = options;
		this._map = null;
		this._domListeners = [];
	}
  addTo(map) { if (this._map) this._map.removeLayer(this); this._map = map; map.addLayer(this); return this; }
  remove() { if (this._map) { this._map.removeLayer(this); this._map = null; } return this; }
  on(type, fn) { if (!this._events[type]) this._events[type] = []; this._events[type].push(fn); return this; }
  off(type, fn) { if (!this._events[type]) return this; this._events[type] = this._events[type].filter(cb => cb !== fn); return this; }
  fire(type, data = {}) { if (!this._events[type]) return; data.type = type; data.target = this; this._events[type].forEach(fn => fn(data)); }
  onAdd() {}
  onRemove() {}
  render() {}
  // DOM listener helpers (store added listeners so we can remove them reliably)
  addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
    return this._domListeners[this._domListeners.length - 1];
  }
  removeDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (err) {}
    }
    this._domListeners.length = 0;
  }

  bindTooltip(content, options) {
    if (this._tooltip) {
      this.unbindTooltip();
    }
    this._tooltip = new Tooltip(options, this);
    this._tooltip.setContent(content);
    this.on('remove', this.unbindTooltip, this);
    return this;
  }

  unbindTooltip() {
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
      this.off('remove', this.unbindTooltip, this);
    }
    return this;
  }
}

// Control base (with DOM listener helpers)
class Control {
  constructor(options = {}) { this.options = { position: options.position || 'top-left' }; this._map = null; this._container = null; this._events = {}; this._domListeners = []; }
  on(type, fn) { if (!this._events[type]) this._events[type] = []; this._events[type].push(fn); return this; }
  off(type, fn) { if (!this._events[type]) return this; this._events[type] = this._events[type].filter(cb => cb !== fn); return this; }
  fire(type, data = {}) { if (!this._events[type]) return; data.type = type; data.target = this; this._events[type].forEach(fn => fn(data)); }
  onAdd() { return document.createElement('div'); }
  onRemove() {}
  addTo(map) { this.remove(); this._map = map; this._container = this.onAdd(); this._container.controlInstance = this; this._addToContainer(); return this; }
  remove() { if (!this._map) return this; this.onRemove(); if (this._container && this._container.parentNode) this._container.parentNode.removeChild(this._container); this._removeDomListeners(); this._map = null; this._container = null; return this; }
  getContainer() { return this._container; }
  _addToContainer() {
    if (!this._map || !this._container) return;
    const position = this.options.position;
    let container = this._map._controlCorners[position];
    if (!container) {
      container = document.createElement('div');
      container.className = `atlas-control-container atlas-control-${position}`;
      if (position.includes('top') || position.includes('bottom')) container.classList.add('atlas-control-vertical');
      this._map.container.appendChild(container);
      this._map._controlCorners[position] = container;
    }
    container.appendChild(this._container);
  }
  // dom listener helpers
  _addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
  }
  _removeDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (e) {}
    }
    this._domListeners.length = 0;
  }
}

// Fullscreen control
class FullscreenControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, title: options.title || 'Toggle fullscreen' }; }
  _requestFullscreen(elem) {
    if (elem.requestFullscreen) return elem.requestFullscreen();
    if (elem.webkitRequestFullscreen) return elem.webkitRequestFullscreen();
    if (elem.msRequestFullscreen) return elem.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen not supported'));
  }
  _exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.reject(new Error('Fullscreen not supported'));
  }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-fullscreen-control';
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'control-btn';
    fullscreenBtn.title = this.options.title;
    fullscreenBtn.setAttribute('aria-label', this.options.title);
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.tabIndex = 0;
    const handler = async () => {
      try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
          await this._requestFullscreen(this._map.container);
        } else {
          await this._exitFullscreen();
        }
      } catch (err) {}
    };
    fullscreenBtn.addEventListener('click', handler);
    fullscreenBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    container.appendChild(fullscreenBtn);
    this._fullscreenBtn = fullscreenBtn;
    this._addDomListener(fullscreenBtn, 'click', handler);
    return container;
  }
  onRemove() {}
}

// Attribution control (no duplicate id)
class AttributionControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, prefix: options.prefix || '' }; }
  onAdd() {
    let container = this._map ? this._map.container.querySelector('.atlas-attribution-control') : null;
    if (!container) {
      container = document.createElement('div');
      container.className = 'atlas-attribution-control';
    } else {
      container.classList.add('atlas-attribution-control');
    }
    this._container = container;
    return container;
  }
  onRemove() {}
  _update() {
    if (!this._map || !this._container) return;
    const attributions = [];
    const baseLayer = this._map.getBaseLayer();
    if (baseLayer && baseLayer instanceof TileLayer) {
      const baseAttr = baseLayer.getAttribution();
      if (baseAttr) attributions.push(baseAttr);
    }
    for (const layer of this._map._layers) {
      if (layer instanceof TileLayer && layer !== baseLayer) {
        const attr = layer.getAttribution();
        if (attr && !attributions.includes(attr)) attributions.push(attr);
      }
    }
    attributions.push('<a href="https://github.com/your-org/atlasjs" target="_blank">Atlas.js</a>');
    this._container.innerHTML = attributions.join(' | ');
  }
}

// Compass control
class CompassControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, title: options.title || 'Reset North' }; }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-compass-control';
    const compassBtn = document.createElement('button');
    compassBtn.id = 'compass';
    compassBtn.className = 'control-btn';
    compassBtn.title = this.options.title;
    compassBtn.setAttribute('aria-label', this.options.title);
    compassBtn.textContent = 'N';
    compassBtn.style.display = 'none';
    compassBtn.tabIndex = 0;
    const handler = () => {
      if (this._map) {
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION);
      }
    };
    compassBtn.addEventListener('click', handler);
    compassBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    container.appendChild(compassBtn);
    this._compassBtn = compassBtn;
    this._addDomListener(compassBtn, 'click', handler);
    return container;
  }
  onRemove() {}
  _update() {
    if (!this._compassBtn || !this._map) return;
    const visible = Math.abs(this._map.getBearing()) > 0.001;
    this._compassBtn.style.display = visible ? "block" : "none";
    this._compassBtn.style.transform = `rotate(${-this._map.getBearing() * RAD2DEG}deg)`;
  }
}

// Search provider base and Nominatim provider (with retry/backoff and email param)
class SearchProvider {
  constructor(options = {}) { this.options = options || {}; }
  async search(query) { throw new Error('search() must be implemented'); }
  formatResult(result) { throw new Error('formatResult() must be implemented'); }
  getBoundingBox(result) { return null; }
}
class NominatimProvider extends SearchProvider {
  constructor(options = {}) {
    super(options);
    this.options = { format: 'json', limit: 5, email: options.email || '', ...options };
    this._cache = new Map();
  }
  async _fetchWithTimeout(url, timeout = 8000, retries = 2) {
    let attempt = 0;
    const doFetch = async (delay = 0) => {
      if (delay) await new Promise(r => setTimeout(r, delay));
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
        clearTimeout(id);
        if (res.status === 429 || res.status === 503) {
          if (attempt < retries) {
            attempt++;
            const backoff = Math.pow(2, attempt) * 200 + Math.random() * 200;
            return doFetch(backoff);
          } else {
            throw new Error('Rate limited');
          }
        }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      } catch (err) {
        clearTimeout(id);
        if (err.name === 'AbortError') throw err;
        if (attempt < retries) {
          attempt++;
          const backoff = Math.pow(2, attempt) * 200 + Math.random() * 200;
          return doFetch(backoff);
        }
        throw err;
      }
    };
    return doFetch();
  }
  async search(query) {
    if (!query) return [];
    if (this._cache.has(query)) return this._cache.get(query);
    const params = { q: query, format: this.options.format, limit: this.options.limit };
    if (this.options.email) params.email = this.options.email;
    const queryString = new URLSearchParams(params).toString();
    const url = `https://nominatim.openstreetmap.org/search?${queryString}`;
    const data = await this._fetchWithTimeout(url, 8000, 2);
    this._cache.set(query, data);
    return data;
  }
  formatResult(result) {
    return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name || `${result.lat}, ${result.lon}`,
        type: result.type,
        osm_id: result.osm_id,
        osm_type: result.osm_type
    };
  }
  getBoundingBox(result) {
    if (!result.boundingbox || result.boundingbox.length !== 4) return null;
    return {
        sw: { lat: parseFloat(result.boundingbox[0]), lon: parseFloat(result.boundingbox[2]) },
        ne: { lat: parseFloat(result.boundingbox[1]), lon: parseFloat(result.boundingbox[3]) }
    };
  }
}
// Search control - Enhanced with marker icons and fly-to with popup
class SearchControl extends Control {
  constructor(options = {}) {
    super(options);
    this.options = {
      position: options.position || 'top-left',
      placeholder: options.placeholder || 'Search for a place...',
      noResultsMessage: options.noResultsMessage || 'No results found.',
      messageHideDelay: options.messageHideDelay || 3000,
      provider: options.provider || new NominatimProvider(options.providerOptions || {}),
      providerOptions: options.providerOptions || {}
    };
    this._input = null;
    this._resultsContainer = null;
    this._messageContainer = null;
    this._liveRegion = null;
    this._activeResultIndex = -1;
    this._currentResults = [];
    this._debounceTimer = null;
    this._abortController = null;
    this._resultItemCleanup = [];
    this._onInputChangeBound = this._onInputChange.bind(this);
    this._onInputKeyDownBound = this._onInputKeyDown.bind(this);
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
    this._activeMarker = null; // Track the currently active marker for cleanup
  }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-search-control';

    const form = document.createElement('form');
    form.className = 'atlas-search-form';
    form.setAttribute('role', 'search');

    const searchContainer = document.createElement('div');
    searchContainer.className = 'atlas-search-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'atlas-search-input';
    input.placeholder = this.options.placeholder;
    input.setAttribute('aria-label', this.options.placeholder);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'atlas-search-clear';
    clearButton.setAttribute('aria-label', 'Clear search');
    clearButton.innerHTML = '&times;';

    searchContainer.appendChild(input);
    searchContainer.appendChild(clearButton);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'atlas-search-submit';
    submitButton.setAttribute('aria-label', 'Search');
    submitButton.innerHTML = '<span class="atlas-search-icon">🔍</span>';

    form.appendChild(searchContainer);
    form.appendChild(submitButton);

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'atlas-search-results';
    resultsContainer.style.position = 'absolute';
    resultsContainer.style.top = '100%';
    resultsContainer.style.left = '0';
    resultsContainer.style.right = '0';
    resultsContainer.style.zIndex = '1001';
    resultsContainer.style.backgroundColor = 'rgba(255,255,255,0.95)';
    resultsContainer.style.border = '1px solid #ccc';
    resultsContainer.style.borderTop = 'none';
    resultsContainer.style.borderRadius = '0 0 4px 4px';
    resultsContainer.style.maxHeight = '200px';
    resultsContainer.style.overflowY = 'auto';
    resultsContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';
    resultsContainer.style.display = 'none';
    const messageContainer = document.createElement('div');
    messageContainer.className = 'atlas-search-message';
    messageContainer.style.position = 'absolute';
    messageContainer.style.top = '100%';
    messageContainer.style.left = '0';
    messageContainer.style.right = '0';
    messageContainer.style.zIndex = '1001';
    messageContainer.style.backgroundColor = 'rgba(255,255,255,0.95)';
    messageContainer.style.border = '1px solid #ccc';
    messageContainer.style.borderTop = 'none';
    messageContainer.style.borderRadius = '0 0 4px 4px';
    messageContainer.style.padding = '6px 8px';
    messageContainer.style.fontSize = '12px';
    messageContainer.style.color = '#666';
    messageContainer.style.textAlign = 'center';
    messageContainer.style.display = 'none';
    const liveRegion = document.createElement('div');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    container.appendChild(form);
    container.appendChild(resultsContainer);
    container.appendChild(messageContainer);
    container.appendChild(liveRegion);
    this._container = container;
    this._input = input;
    this._submitButton = submitButton;
    this._clearButton = clearButton;
    this._resultsContainer = resultsContainer;
    this._messageContainer = messageContainer;
    this._liveRegion = liveRegion;

    const onSubmit = (e) => { e.preventDefault(); this._performSearch(this._input.value.trim()); };
    const onClear = () => {
        this._input.value = '';
        this._input.focus();
        this._hideResults();
        this._hideMessage();
        clearButton.classList.remove('visible');
    };
    const onInput = () => {
        if (this._input.value.length > 0) {
            clearButton.classList.add('visible');
        } else {
            clearButton.classList.remove('visible');
        }
    };

    form.addEventListener('submit', onSubmit);
    this._addDomListener(form, 'submit', onSubmit);

    this._input.addEventListener('input', this._onInputChangeBound);
    this._addDomListener(this._input, 'input', this._onInputChangeBound);
    this._input.addEventListener('input', onInput);
    this._addDomListener(this._input, 'input', onInput);

    this._input.addEventListener('keydown', this._onInputKeyDownBound);
    this._addDomListener(this._input, 'keydown', this._onInputKeyDownBound);

    clearButton.addEventListener('click', onClear);
    this._addDomListener(clearButton, 'click', onClear);

    document.addEventListener('click', this._onDocumentClickBound);
    this._domListeners.push({ el: document, type: 'click', handler: this._onDocumentClickBound, options: false });

    return container;
  }
  onRemove() {
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
    if (this._input) {
      this._input.removeEventListener('input', this._onInputChangeBound);
      this._input.removeEventListener('keydown', this._onInputKeyDownBound);
    }
    document.removeEventListener('click', this._onDocumentClickBound);
    if (this._resultItemCleanup) {
      this._resultItemCleanup.forEach(cleanup => cleanup());
      this._resultItemCleanup = [];
    }
    if (this._debounceTimer) { clearTimeout(this._debounceTimer); this._debounceTimer = null; }
    if (this._resultsContainer) this._resultsContainer.style.display = 'none';
    if (this._messageContainer) this._messageContainer.style.display = 'none';
    // Clean up active marker if exists
    if (this._activeMarker) {
      this._activeMarker.remove();
      this._activeMarker = null;
    }
    // remove stored DOM listeners
    this._removeDomListeners();
  }
  _onDocumentClick(event) { if (!this._container.contains(event.target)) { this._hideResults(); this._hideMessage(); } }
  _onInputChange(event) {
    const query = event.target.value.trim();
    if (query.length === 0) { this._hideResults(); this._hideMessage(); return; }
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._performSearch(query), 300);
  }
  _onInputKeyDown(event) {
    const key = event.key;
    if (key === 'ArrowDown') { event.preventDefault(); this._activeResultIndex = Math.min(this._activeResultIndex + 1, this._currentResults.length - 1); this._updateResultHighlight(); }
    else if (key === 'ArrowUp') { event.preventDefault(); this._activeResultIndex = Math.max(this._activeResultIndex - 1, -1); this._updateResultHighlight(); }
    else if (key === 'Enter' && this._activeResultIndex >= 0) { event.preventDefault(); this._selectResult(this._currentResults[this._activeResultIndex]); }
    else if (key === 'Escape') { this._input.blur(); this._hideResults(); this._hideMessage(); }
  }
  _updateResultHighlight() {
    const resultItems = this._resultsContainer.querySelectorAll('.atlas-search-result-item');
    resultItems.forEach((item, index) => {
        if (index === this._activeResultIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
  }
  _performSearch(query) {
    if (!query) return;
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    this._submitButton.classList.add('loading');
    this._showMessage('Searching...');

    this.options.provider.search(query)
      .then(data => {
        if (this._abortController.signal.aborted) return;
        this._displayResults(data);
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        this._showMessage('Search error');
      })
      .finally(() => {
        this._submitButton.classList.remove('loading');
        if (!this._currentResults || this._currentResults.length === 0) {
            this._hideMessage();
        }
      });
  }
  _displayResults(results) {
    this._currentResults = results;
    this._activeResultIndex = -1;
    if (this._resultItemCleanup) { this._resultItemCleanup.forEach(cleanup => cleanup()); this._resultItemCleanup = []; }
    if (!results || results.length === 0) {
      this._liveRegion.textContent = this.options.noResultsMessage;
      this._showMessage(this.options.noResultsMessage);
      this._hideResults();
      return;
    }
    this._liveRegion.textContent = `${results.length} search results available.`;
    this._resultsContainer.innerHTML = '';
    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'atlas-search-result-item';
      item.style.padding = '8px 10px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid #eee';
      item.style.fontSize = '13px';
      item.tabIndex = 0;
      const onMouseEnter = () => { this._activeResultIndex = index; this._updateResultHighlight(); };
      const onClick = () => { this._selectResult(result); };
      const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._selectResult(result);
        }
      };
      item.onmouseenter = onMouseEnter;
      item.onclick = onClick;
      item.onkeydown = onKeyDown;
      const formatted = this.options.provider.formatResult(result);

      // Create a container for the marker icon and text
      const markerIconContainer = document.createElement('div');
      markerIconContainer.style.display = 'flex';
      markerIconContainer.style.alignItems = 'center';
      markerIconContainer.style.gap = '8px'; // Space between icon and text

      // Create the marker icon element (using the same SVG as AtlasMarker)
      const markerIcon = document.createElement('div');
      markerIcon.className = 'search-marker-icon';
      markerIcon.innerHTML = `
            <svg width="16" height="24" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0zm0 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill="#d50000"/>
              <circle cx="12" cy="12" r="2" fill="#ffffff"/>
            </svg>
          `;

      // Create a text element for the display name
      const textSpan = document.createElement('span');
      textSpan.textContent = formatted.displayName;

      // Assemble the item content
      markerIconContainer.appendChild(markerIcon);
      markerIconContainer.appendChild(textSpan);
      item.appendChild(markerIconContainer);

      this._resultsContainer.appendChild(item);
      this._resultItemCleanup.push(() => {
        item.onmouseenter = null;
        item.onclick = null;
        item.onkeydown = null;
      });
    });
    const lastItem = this._resultsContainer.lastElementChild;
    if (lastItem) lastItem.style.borderBottom = 'none';
    this._resultsContainer.style.display = 'block';
  }
  _selectResult(result) {
    if (!result || !this._map) return;
    const formatted = this.options.provider.formatResult(result);
    const lat = parseFloat(formatted.lat);
    const lon = parseFloat(formatted.lng);
    if (isNaN(lat) || isNaN(lon)) { return; }

    // Clean up previous marker if exists
    if (this._activeMarker) {
      this._activeMarker.remove();
    }

    // Create a new AtlasMarker at the selected location
    const newMarker = new AtlasMarker({ lat: lat, lon: lon }, {
        title: formatted.displayName
    }).addTo(this._map);

    // Bind and open a popup with the location name
    newMarker.bindPopup(`
            <h4>${formatted.displayName}</h4>
            <p>Type: ${formatted.type}</p>
            <a href="https://www.openstreetmap.org/${formatted.osm_type}/${formatted.osm_id}" target="_blank">View on OSM</a>
        `).openPopup();

    // Store reference to active marker for cleanup
    this._activeMarker = newMarker;

    const boundingBox = this.options.provider.getBoundingBox(result);

    if (boundingBox) {
        this._map.fitBounds(boundingBox, {
            padding: 0.1,
            duration: 800,
            easing: EASING.easeInOutQuint
        });
    } else {
        // Fly to the location
        this._liveRegion.textContent = `Navigating to ${formatted.displayName}.`;
        if (typeof this._map.flyToQuick === 'function') {
            this._map.flyToQuick({
                center: { lat: lat, lon: lon },
                zoom: 14,
                duration: 420,
                easing: EASING.easeInOutQuint
            });
        } else {
            this._map.flyTo({
                center: { lat: lat, lon: lon },
                zoom: 14,
                duration: 420,
                easing: EASING.easeInOutQuint
            });
        }
    }

    // Clear the search input and hide results
    this._input.value = '';
    this._hideResults();
    this._hideMessage();

    // Fire the select event
    this.fire('search:select', { result: formatted, latlng: { lat: lat, lon: lon } });
  }
  _showMessage(text) {
    this._hideResults();
    this._liveRegion.textContent = text;
    this._messageContainer.textContent = text;
    this._messageContainer.style.display = 'block';
    setTimeout(() => { this._hideMessage(); }, this.options.messageHideDelay);
  }
  _hideMessage() { this._messageContainer.style.display = 'none'; this._liveRegion.textContent = ''; }
  _hideResults() { this._resultsContainer.style.display = 'none'; this._activeResultIndex = -1; }
}

// Zoom control
class ZoomControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, zoomInTitle: options.zoomInTitle || 'Zoom in', zoomOutTitle: options.zoomOutTitle || 'Zoom out' }; }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-zoom-control';
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'control-btn';
    zoomInBtn.title = this.options.zoomInTitle;
    zoomInBtn.setAttribute('aria-label', this.options.zoomInTitle);
    zoomInBtn.textContent = '+';
    zoomInBtn.tabIndex = 0;
    const zoomInHandler = () => { if (this._map) { this._map.stopAnimations(); this._map.setZoom(this._map.getZoom() + 1); } };
    zoomInBtn.addEventListener('click', zoomInHandler);
    zoomInBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomInHandler(); } });
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'control-btn';
    zoomOutBtn.title = this.options.zoomOutTitle;
    zoomOutBtn.setAttribute('aria-label', this.options.zoomOutTitle);
    zoomOutBtn.textContent = '−';
    zoomOutBtn.tabIndex = 0;
    const zoomOutHandler = () => { if (this._map) { this._map.stopAnimations(); this._map.setZoom(this._map.getZoom() - 1); } };
    zoomOutBtn.addEventListener('click', zoomOutHandler);
    zoomOutBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomOutHandler(); } });
    container.appendChild(zoomInBtn);
    container.appendChild(zoomOutBtn);
    this._zoomInBtn = zoomInBtn;
    this._zoomOutBtn = zoomOutBtn;
    // store for removal
    this._addDomListener(zoomInBtn, 'click', zoomInHandler);
    this._addDomListener(zoomOutBtn, 'click', zoomOutHandler);
    return container;
  }
  onRemove() {}
  _update() {
    if (!this._map || !this._zoomInBtn || !this._zoomOutBtn) return;
    const minZoom = this._map.getBaseLayer() ? this._map.getBaseLayer().getMinZoom() : 0;
    const maxZoom = this._map.getBaseLayer() ? this._map.getBaseLayer().getMaxZoom() : 18;
    const currentZoom = this._map.getZoom();
    this._zoomInBtn.disabled = currentZoom >= maxZoom;
    this._zoomOutBtn.disabled = currentZoom <= minZoom;
  }
}

// Geolocation control
class GeolocationControl extends Control {
  constructor(options = {}) {
    super(options);
    this.options = {
      ...this.options,
      title: options.title || 'My location',
      markerOptions: options.markerOptions || {
        title: 'My Location',
        draggable: false,
      },
    };
    this._marker = null;
  }

  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-geolocation-control';

    const geolocateBtn = document.createElement('button');
    geolocateBtn.className = 'control-btn';
    geolocateBtn.title = this.options.title;
    geolocateBtn.setAttribute('aria-label', this.options.title);
    geolocateBtn.innerHTML = '&#9737;'; // Target symbol
    geolocateBtn.tabIndex = 0;

    const handler = () => {
      if (this._map) {
        this._map.locate();
      }
    };

    geolocateBtn.addEventListener('click', handler);
    geolocateBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });

    container.appendChild(geolocateBtn);
    this._geolocateBtn = geolocateBtn;
    this._addDomListener(geolocateBtn, 'click', handler);

    this._map.on('locationfound', (e) => {
      this.onLocationFound(e);
    });

    this._map.on('locationerror', (e) => {
      this.onLocationError(e);
    });

    return container;
  }

  onLocationFound(e) {
    if (this._marker) {
      this._marker.setLatLng(e.latlng);
    } else {
      this._marker = new AtlasMarker(e.latlng, this.options.markerOptions).addTo(this._map);
    }
  }

  onLocationError(e) {
    // You can handle location errors here, e.g., by showing a message to the user.
    console.error(e.message);
  }

  onRemove() {
    if (this._marker) {
      this._marker.remove();
      this._marker = null;
    }
  }
}

class Canvas extends Layer {
	onAdd() {
		this._container = document.createElement('canvas');
		this._ctx = this._container.getContext('2d');
		this._map.on('moveend', this._update, this);
		this._update();
	}

	onRemove() {
		this._map.off('moveend', this._update, this);
	}

	_update() {
		if (this._map._animatingZoom) { return; }
		this._container.width = this._map.getSize().x;
		this._container.height = this._map.getSize().y;
		this._ctx.clearRect(0, 0, this._container.width, this._container.height);
		const layers = this._map.getLayers();
		for (let i = 0; i < layers.length; i++) {
			if (layers[i].options.renderer === this) {
				layers[i]._update();
			}
		}
	}

	updatePoly(layer) {
		const points = layer._points;
		if (points.length === 0) { return; }
		this._ctx.beginPath();
		this._ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			this._ctx.lineTo(points[i].x, points[i].y);
		}
		this._setStyle(layer);
	}

	updatePolygon(layer) {
		const points = layer._points;
		if (points.length === 0) { return; }
		this._ctx.beginPath();
		this._ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			this._ctx.lineTo(points[i].x, points[i].y);
		}
		this._ctx.closePath();
		this._setStyle(layer, true);
	}

	updateCircle(layer) {
		const point = layer._point;
		const radius = layer._radius;
		if (point && radius) {
			this._ctx.beginPath();
			this._ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
			this._setStyle(layer, true);
		}
	}

	_setStyle(layer, filled) {
		const options = layer.options;
		if (options.stroke) {
			this._ctx.strokeStyle = options.color;
			this._ctx.lineWidth = options.weight;
			this._ctx.globalAlpha = options.opacity;
			if (options.dashArray) {
				this._ctx.setLineDash(options.dashArray);
			}
			if (options.dashOffset) {
				this._ctx.lineDashOffset = options.dashOffset;
			}
			this._ctx.stroke();
		}
		if (filled && options.fill) {
			this._ctx.fillStyle = options.fillColor || options.color;
			this._ctx.globalAlpha = options.fillOpacity;
			this._ctx.fill(options.fillRule || 'evenodd');
		}
	}

	bringToFront(layer) {
		// Not implemented for Canvas renderer
	}

	bringToBack(layer) {
		// Not implemented for Canvas renderer
	}
}

// Handler base class with DOM listener tracking
class Handler {
  constructor(map) { this._map = map; this._enabled = false; this._eventListeners = {}; this._domListeners = []; }
  enable() { if (this._enabled) return this; this._enabled = true; this._addEvents(); return this; }
  disable() { if (!this._enabled) return this; this._enabled = false; this._removeEvents(); return this; }
  toggle() { return this._enabled ? this.disable() : this.enable(); }
  isEnabled() { return this._enabled; }
  _addEvents() {}
  _removeEvents() {}
  destroy() { this.disable(); this._eventListeners = {}; this._removeAllDomListeners(); }
  // DOM helper
  _addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
  }
  _removeAllDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (e) {}
    }
    this._domListeners.length = 0;
  }
}