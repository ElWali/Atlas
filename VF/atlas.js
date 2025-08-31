/*!
 * Atlas.js v0.1 — Lightweight JavaScript mapping library 
 * Author: ElWali ElAlaoui (Atlasian from Tarfaya 🇲🇦)
 * License: MIT
 *
 */
(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Atlas = {}));
})(this, (function(exports) { 'use strict';

/*** Utils ***/
const Utils = {
    extend: Object.assign,

    createElement(tag, className, container, options = {}) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([k, v]) => el.setAttribute(k, v));
        }
        if (options.events) {
            for (const [k, v] of Object.entries(options.events)) {
                el.addEventListener(k, v);
            }
        }
        if (container) container.appendChild(el);
        return el;
    },

    clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    },

    // Converts lat/lng to world pixel coordinates at a given zoom (not tile pixels)
    latLngToPixel(lat, lng, zoom) {
        const tileSize = 256;
        const scale = Math.pow(2, zoom) * tileSize;
        const x = (lng + 180) / 360 * scale;
        const sinLat = Math.sin(lat * Math.PI / 180);
        const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
        return [x, y];
    },

    pixelToLatLng(x, y, zoom) {
        const tileSize = 256;
        const scale = Math.pow(2, zoom) * tileSize;
        const lng = x / scale * 360 - 180;
        const n = Math.PI * (1 - 2 * y / scale);
        const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
        return [lat, lng];
    },

    distance(a, b) {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    },

    now() { return performance.now(); },

    // simple debounce
    debounce(fn, wait = 100) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }
};

/*** EventEmitter ***/
class EventEmitter {
    constructor() {
        this._listeners = new Map();
    }

    on(evt, fn) {
        if (!this._listeners.has(evt)) this._listeners.set(evt, []);
        this._listeners.get(evt).push(fn);
        return this;
    }

    off(evt, fn) {
        if (!this._listeners.has(evt)) return this;
        if (!fn) { this._listeners.delete(evt); return this; }
        this._listeners.set(evt, this._listeners.get(evt).filter(f => f !== fn));
        return this;
    }

    fire(evt, data) {
        const listeners = this._listeners.get(evt);
        if (!listeners) return this;
        listeners.forEach(f => { try { f(data); } catch (e) { console.error(e); } });
        return this;
    }
}

/*** Marker ***/
class Marker {
    constructor(latlng, options = {}) {
        this.latlng = latlng;
        this.options = Utils.extend({
            popup: null,
            draggable: false,
            title: ''
        }, options);
        this._dragging = false;
    }
}

/*** Tile Layer ***/
class TileLayer {
    constructor(urlTemplate, options = {}) {
        this.urlTemplate = urlTemplate;
        this.options = Utils.extend({
            minZoom: 0,
            maxZoom: 18,
            attribution: '',
            subdomains: 'abc',
            detectRetina: true
        }, options);
        this._tiles = new Map();
    }

    addTo(map) {
        if (this.options.attribution && map._attributionControl) {
            map._attributionControl.addAttribution(this.options.attribution);
        }
        return this;
    }

    getTileUrl(x, y, z) {
        const s = this.options.subdomains[Math.abs(x + y) % this.options.subdomains.length];
        return this.urlTemplate
            .replace('{s}', s)
            .replace('{x}', x)
            .replace('{y}', y)
            .replace('{z}', z);
    }
}

/*** GeoJSON Layer ***/
class GeoJSONLayer {
    constructor(features = []) {
        this.features = features;
        this._visible = true;
    }

    setVisible(visible) {
        this._visible = visible;
        return this;
    }

    isVisible() {
        return this._visible;
    }
}

/*** Popup ***/
class Popup {
    constructor(options = {}) {
        this.options = Utils.extend({
            closeButton: true,
            offset: [0, 7]
        }, options);
        this._content = '';
        this._isOpen = false;
    }

    setContent(content) {
        this._content = content;
        if (this._isOpen) this._update();
        return this;
    }

    openOn(map, latlng) {
        this._map = map;
        this._latlng = latlng;
        this._create();
        this._position();
        this._isOpen = true;
        return this;
    }

    close() {
        if (this._container) {
            this._container.remove();
            this._isOpen = false;
            this._container = null;
        }
        return this;
    }

    _create() {
        this._container = Utils.createElement('div', 'atlas-popup', this._map._popupContainer);
        if (this.options.closeButton) {
            const closeBtn = Utils.createElement('button', 'atlas-popup-close', this._container, {
                events: { click: () => this.close() }
            });
            closeBtn.setAttribute('aria-label', 'Close popup');
            closeBtn.innerHTML = '×';
        }
        this._contentNode = Utils.createElement('div', 'atlas-popup-content', this._container);
        this._update();
    }

    _update() {
        if (!this._contentNode) return;
        if (typeof this._content === 'string') {
            this._contentNode.textContent = this._content;
        } else if (this._content instanceof Node) {
            this._contentNode.innerHTML = '';
            this._contentNode.appendChild(this._content);
        } else {
            this._contentNode.textContent = String(this._content);
        }
    }

    _position() {
        if (!this._map || !this._container) return;
        const zoom = this._map.zoom;
        const [px, py] = Utils.latLngToPixel(this._latlng[0], this._latlng[1], zoom);
        const [cx, cy] = Utils.latLngToPixel(this._map.center[0], this._map.center[1], zoom);
        const rect = this._map.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;
        this._container.style.left = (px - cx + halfW + this.options.offset[0]) + 'px';
        this._container.style.top = (py - cy + halfH + this.options.offset[1] - 30) + 'px';
    }
}

/*** Atlas Map ***/
class AtlasMap extends EventEmitter {
    constructor(containerId, options = {}) {
        super();
        const container = (typeof containerId === 'string') ? document.getElementById(containerId) : containerId;
        if (!container) throw new Error(`Container '${containerId}' not found`);
        this.container = container;
        this.options = Utils.extend({
            center: [0, 0],
            zoom: 2,
            minZoom: 0,
            maxZoom: 18,
            edit: false
        }, options);

        this._layers = [];
        this._markers = [];
        this._geoLayers = [];
        this._hooks = Utils.extend({
            onTileLoad: (tile, url) => {},
            onMarkerClick: (marker) => {}
        }, this.options.hooks || {});

        this._renderScheduled = false;
        this._size = { width: 0, height: 0 };

        this._initStructure();
        this._initControls();
        this.setView(this.options.center, this.options.zoom, false);
        this._initInteraction();
        this._bindResize();
        this._render(); // initial render
    }

    _initStructure() {
        this.container.classList.add('atlas-map');
        this._tileContainer = Utils.createElement('div', 'atlas-tile-container', this.container);
        this._layerContainer = Utils.createElement('div', 'atlas-layer-container', this.container);
        this._markerContainer = Utils.createElement('div', 'atlas-marker-container', this.container);
        this._controlContainer = Utils.createElement('div', 'atlas-controls', this.container);
        this._popupContainer = Utils.createElement('div', 'atlas-popup-container', this.container);
    }

    _initControls() {
        this._attributionControl = new Atlas.Control.Attribution();
        this._attributionControl.addTo(this);
    }

    _bindResize() {
        const updateSize = () => {
            const rect = this.container.getBoundingClientRect();
            this._size.width = rect.width;
            this._size.height = rect.height;
            this._render(); // immediate render on size change
        };
        this._onResize = Utils.debounce(updateSize, 80);
        window.addEventListener('resize', this._onResize);
        // initial size
        updateSize();
    }

    _initInteraction() {
        const tileSize = 256;
        let draggingPointerId = null;
        let startClient = [0, 0];
        let startCenterPixel = [0, 0];
        let isDragging = false;

        const supportPointer = !!window.PointerEvent;
        const addListener = (el, evt, handler) => el.addEventListener(evt, handler, { passive: false });

        const getClientXY = e => {
            if (e.touches && e.touches[0]) return [e.touches[0].clientX, e.touches[0].clientY];
            return [e.clientX, e.clientY];
        };

        const pointerDown = e => {
            // ignore right-click
            if (e.button === 2) return;
            const p = getClientXY(e);
            isDragging = true;
            startClient = p;
            startCenterPixel = Utils.latLngToPixel(this.center[0], this.center[1], this.zoom);
            draggingPointerId = e.pointerId || (e.changedTouches ? e.changedTouches[0].identifier : null);
            this.container.classList.add('dragging');
            if (e.preventDefault) e.preventDefault();
            if (supportPointer && e.target && e.target.setPointerCapture) {
                try { e.target.setPointerCapture && e.target.setPointerCapture(draggingPointerId); } catch(e){}
            }
        };

        const pointerMove = e => {
            if (!isDragging) return;
            const p = getClientXY(e);
            const dx = p[0] - startClient[0];
            const dy = p[1] - startClient[1];
            const newCenterPixel = [startCenterPixel[0] - dx, startCenterPixel[1] - dy];
            const newCenter = Utils.pixelToLatLng(newCenterPixel[0], newCenterPixel[1], this.zoom);
            this.setView(newCenter, this.zoom, true);
            if (e.preventDefault) e.preventDefault();
        };

        const pointerUp = e => {
            isDragging = false;
            draggingPointerId = null;
            this.container.classList.remove('dragging');
            if (supportPointer && e.changedTouches && e.changedTouches[0] && e.target && e.target.releasePointerCapture) {
                try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch(e){}
            }
        };

        // attach appropriate events
        if (supportPointer) {
            addListener(this.container, 'pointerdown', pointerDown);
            addListener(window, 'pointermove', pointerMove);
            addListener(window, 'pointerup', pointerUp);
            addListener(window, 'pointercancel', pointerUp);
        } else {
            addListener(this.container, 'mousedown', pointerDown);
            addListener(window, 'mousemove', pointerMove);
            addListener(window, 'mouseup', pointerUp);
            addListener(this.container, 'touchstart', pointerDown);
            addListener(window, 'touchmove', pointerMove);
            addListener(window, 'touchend', pointerUp);
        }

        // wheel zoom centered on pointer
        this.container.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = this.container.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            const worldBefore = Utils.pixelToLatLng(Utils.latLngToPixel(this.center[0], this.center[1], this.zoom)[0] + (clientX - rect.width/2),
                                                     Utils.latLngToPixel(this.center[0], this.center[1], this.zoom)[1] + (clientY - rect.height/2),
                                                     this.zoom);
            const delta = (e.deltaY > 0) ? -1 : 1;
            const newZoom = Utils.clamp(this.zoom + delta, this.options.minZoom, this.options.maxZoom);
            const scale = Math.pow(2, newZoom) / Math.pow(2, this.zoom);
            // compute new center so that the point under the cursor remains roughly the same
            const centerPixel = Utils.latLngToPixel(this.center[0], this.center[1], this.zoom);
            const cursorWorldPixelX = centerPixel[0] + (clientX - rect.width/2);
            const cursorWorldPixelY = centerPixel[1] + (clientY - rect.height/2);
            const newCenterPixelX = cursorWorldPixelX * (scale) - (clientX - rect.width/2);
            const newCenterPixelY = cursorWorldPixelY * (scale) - (clientY - rect.height/2);
            const newCenter = Utils.pixelToLatLng(newCenterPixelX, newCenterPixelY, newZoom);
            this.setView(newCenter, newZoom);
        }, { passive: false });

        // double-click zoom (centered)
        this.container.addEventListener('dblclick', e => {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const latlng = Utils.pixelToLatLng(Utils.latLngToPixel(this.center[0], this.center[1], this.zoom)[0] + (x - rect.width/2),
                                              Utils.latLngToPixel(this.center[0], this.center[1], this.zoom)[1] + (y - rect.height/2),
                                              this.zoom);
            this.setView(latlng, Utils.clamp(this.zoom + 1, this.options.minZoom, this.options.maxZoom));
        });
    }

    setView(center, zoom, render = true) {
        this.center = [Utils.clamp(center[0], -85, 85), ((center[1] + 180) % 360 + 360) % 360 - 180];
        this.zoom = Utils.clamp(Math.round(zoom), this.options.minZoom, this.options.maxZoom);
        if (render) this._render();
        this.fire('viewchange', { center: this.center, zoom: this.zoom });
        return this;
    }

    panBy(offset) {
        // offset: [px, py] in screen pixels
        const centerPixel = Utils.latLngToPixel(this.center[0], this.center[1], this.zoom);
        const newCenterPixel = [centerPixel[0] - offset[0], centerPixel[1] - offset[1]];
        const newCenter = Utils.pixelToLatLng(newCenterPixel[0], newCenterPixel[1], this.zoom);
        this.setView(newCenter, this.zoom);
    }

    fitBounds(bounds) {
        // bounds: [[lat1, lng1], [lat2, lng2]]
        const latDiff = Math.abs(bounds[0][0] - bounds[1][0]);
        const lngDiff = Math.abs(bounds[0][1] - bounds[1][1]);
        const rect = this.container.getBoundingClientRect();
        if (latDiff === 0 && lngDiff === 0) return this.setView([(bounds[0][0]), (bounds[0][1])], this.options.maxZoom);
        const worldTileSize = 256;
        // estimate zoom to fit by comparing degrees vs container size (approx)
        const zoomLat = Math.log2((360 / latDiff) * (rect.height / worldTileSize));
        const zoomLng = Math.log2((360 / lngDiff) * (rect.width / worldTileSize));
        const zoom = Math.floor(Math.min(zoomLat, zoomLng));
        const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        return this.setView(center, Utils.clamp(zoom, this.options.minZoom, this.options.maxZoom));
    }

    addLayer(layer) {
        this._layers.push(layer);
        if (layer.addTo) layer.addTo(this);
        this._render();
        return this;
    }

    addMarker(marker) {
        this._markers.push(marker);
        this._render();
        return this;
    }

    addGeoJSONLayer(layer) {
        this._geoLayers.push(layer);
        this._render();
        return this;
    }

    removeMarker(marker) {
        this._markers = this._markers.filter(m => m !== marker);
        this._render();
        return this;
    }

    scheduleRender() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            this._render();
        });
    }

    _render() {
        if (!this.container) return;
        this._renderTiles();
        this._renderGeoJSON();
        this._renderMarkers();
    }

    _renderTiles() {
        const tileSize = 256;
        const zoom = this.zoom;
        const scaleTiles = Math.pow(2, zoom);
        const [centerX, centerY] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const rect = this.container.getBoundingClientRect();
        const halfWidth = rect.width / 2;
        const halfHeight = rect.height / 2;

        const startX = Math.floor((centerX - halfWidth) / tileSize);
        const endX = Math.floor((centerX + halfWidth) / tileSize);
        const startY = Math.floor((centerY - halfHeight) / tileSize);
        const endY = Math.floor((centerY + halfHeight) / tileSize);

        const tileLayer = this._layers.find(l => l instanceof TileLayer);
        if (!tileLayer) {
            // remove tiles if any
            if (this._tileContainer) this._tileContainer.innerHTML = '';
            return;
        }

        const currentTiles = new Set();

        const dpr = (tileLayer.options.detectRetina && window.devicePixelRatio > 1) ? 2 : 1;
        const tileRenderSize = tileSize; // CSS size; image can be retina

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const tileX = (x % scaleTiles + scaleTiles) % scaleTiles;
                const tileY = Utils.clamp(y, 0, scaleTiles - 1);
                const tileKey = `${zoom}-${tileX}-${tileY}`;
                currentTiles.add(tileKey);

                if (!tileLayer._tiles.has(tileKey)) {
                    const tile = document.createElement('img');
                    tile.className = 'atlas-tile';
                    tile.width = tileRenderSize;
                    tile.height = tileRenderSize;
                    tile.style.position = 'absolute';
                    tile.style.left = (x * tileSize - centerX + halfWidth) + 'px';
                    tile.style.top = (y * tileSize - centerY + halfHeight) + 'px';
                    tile.dataset.key = tileKey;

                    // choose URL (no automatic retina substitution in template, but we allow {r})
                    let url = tileLayer.getTileUrl(tileX, tileY, zoom);
                    if (dpr === 2) url = url.replace('{r}', '@2x'); // optional support
                    tile.src = url;
                    tile.onload = () => {
                        // expose hook
                        try { this._hooks.onTileLoad(tile, url); } catch (e) { console.error(e); }
                    };
                    tile.onerror = () => {
                        // soft fail: keep tile blank or remove
                        tile.style.opacity = '0.6';
                    };
                    tileLayer._tiles.set(tileKey, tile);
                    this._tileContainer.appendChild(tile);
                } else {
                    const tile = tileLayer._tiles.get(tileKey);
                    tile.style.left = (x * tileSize - centerX + halfWidth) + 'px';
                    tile.style.top = (y * tileSize - centerY + halfHeight) + 'px';
                }
            }
        }

        // remove tiles no longer needed
        for (const [key, tile] of tileLayer._tiles.entries()) {
            if (!currentTiles.has(key)) {
                tile.remove();
                tileLayer._tiles.delete(key);
            }
        }
    }

    _renderGeoJSON() {
        this._layerContainer.innerHTML = '';
        const zoom = this.zoom;
        const [cx, cy] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const bounds = this.container.getBoundingClientRect();
        const halfW = bounds.width / 2, halfH = bounds.height / 2;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', bounds.width);
        svg.setAttribute('height', bounds.height);
        this._layerContainer.appendChild(svg);

        this._geoLayers.forEach(layer => {
            if (!layer.isVisible()) return;
            (layer.features || []).forEach(shape => {
                if (!shape.vertices || shape.vertices.length === 0) return;
                const points = shape.vertices.map(v => {
                    const [px, py] = Utils.latLngToPixel(v[0], v[1], zoom);
                    return (px - cx + halfW) + "," + (py - cy + halfH);
                }).join(' ');
                if (shape.type === 'polygon' || shape.type === 'polyline') {
                    const el = document.createElementNS(svgNS, shape.type === 'polygon' ? 'polygon' : 'polyline');
                    el.setAttribute('points', points);
                    el.setAttribute('stroke', shape.options?.stroke || '#3388ff');
                    el.setAttribute('stroke-width', shape.options?.weight || 3);
                    el.setAttribute('fill', shape.type === 'polygon' ? (shape.options?.fill || '#3388ff33') : 'none');
                    svg.appendChild(el);
                }
            });
        });
    }

    _renderMarkers() {
        this._markerContainer.innerHTML = '';
        const zoom = this.zoom;
        const [cx, cy] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const rect = this.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;

        this._markers.forEach(marker => {
            const [px, py] = Utils.latLngToPixel(marker.latlng[0], marker.latlng[1], zoom);
            const div = Utils.createElement('div', 'atlas-marker', this._markerContainer);
            div.style.left = (px - cx + halfW - 10) + 'px';
            div.style.top = (py - cy + halfH - 10) + 'px';
            div.title = marker.options.title || '';
            div.setAttribute('role', 'button');
            div.setAttribute('tabindex', '0');
            div.textContent = '•';

            // click / keyboard handler
            div.addEventListener('click', (ev) => {
                try { this._hooks.onMarkerClick(marker); } catch(e){ console.error(e); }
                if (marker.options.popup) {
                    const popup = new Popup();
                    popup.setContent(marker.options.popup);
                    popup.openOn(this, marker.latlng);
                }
                ev.stopPropagation();
            });
            div.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') { div.click(); ev.preventDefault(); }
            });

            // draggable
            if (marker.options.draggable) {
                let dragging = false;
                let start = null;
                const down = (e) => {
                    dragging = true;
                    start = getClient(e);
                    div.classList.add('dragging');
                    e.preventDefault();
                };
                const move = (e) => {
                    if (!dragging) return;
                    const cur = getClient(e);
                    const dx = cur[0] - start[0], dy = cur[1] - start[1];
                    start = cur;
                    // convert pixel delta to latlng change at current zoom
                    const centerPixel = Utils.latLngToPixel(this.center[0], this.center[1], this.zoom);
                    const markerPixel = Utils.latLngToPixel(marker.latlng[0], marker.latlng[1], this.zoom);
                    const newMarkerPixel = [markerPixel[0] + dx, markerPixel[1] + dy];
                    marker.latlng = Utils.pixelToLatLng(newMarkerPixel[0], newMarkerPixel[1], this.zoom);
                    this.scheduleRender();
                };
                const up = () => { dragging = false; div.classList.remove('dragging'); };
                const getClient = (ev) => ev.touches ? [ev.touches[0].clientX, ev.touches[0].clientY] : [ev.clientX, ev.clientY];

                div.addEventListener('pointerdown', down);
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
                // fallback
                div.addEventListener('touchstart', down, { passive: false });
                window.addEventListener('touchmove', move, { passive: false });
                window.addEventListener('touchend', up);
            }
        });
    }

    getCenter() { return [...this.center]; }
    getZoom() { return this.zoom; }

    destroy() {
        this._layers.forEach(layer => {
            if (layer instanceof TileLayer) layer._tiles.clear();
        });
        window.removeEventListener('resize', this._onResize);
        this.container.innerHTML = '';
        this._layers = [];
        this._markers = [];
        this._geoLayers = [];
    }
}

/*** Controls ***/
class Control {
    constructor(options = {}) {
        this.options = Utils.extend({ position: 'top-right' }, options);
    }
    addTo(map) { this._map = map; this.onAdd(map); return this; }
    onAdd(map) {}
}

Control.Attribution = class extends Control {
    constructor(options = {}) {
        super(Utils.extend({ position: 'bottom-right', prefix: true }, options));
        this._attributions = new Set();
    }

    onAdd(map) {
        this._container = Utils.createElement('div', 'atlas-control atlas-attribution ' + this.options.position, map._controlContainer);
        if (this.options.prefix !== false) this._addAtlasAttribution();
        this._update();
    }

    _addAtlasAttribution() {
        const moroccoFlag = '🇲🇦';
        const attribution = `${moroccoFlag} <a href="https://github.com/elwali-elalaoui/atlas.js" target="_blank" rel="noopener">Atlas.js</a> &copy; Atlasians`;
        this.addAttribution(attribution);
    }

    addAttribution(text) {
        this._attributions.add(text);
        this._update();
    }

    removeAttribution(text) {
        this._attributions.delete(text);
        this._update();
    }

    _update() {
        if (!this._container) return;
        const attributions = Array.from(this._attributions);
        this._container.innerHTML = attributions.join(' | ');
    }
};

// default CSS
const defaultCSS = `
.atlas-map {
    position: relative;
    overflow: hidden;
    background: #e9eef1;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    touch-action: none;
}

.atlas-control { position: absolute; z-index: 1000; }

.atlas-control.top-right { top: 10px; right: 10px; }
.atlas-control.bottom-right { bottom: 0; right: 0; }

.atlas-control.atlas-attribution {
    padding: 6px 10px;
    background: rgba(255,255,255,0.85);
    font-size: 12px;
    color: #333;
    text-align: right;
    border-radius: 4px;
}

.atlas-control.atlas-attribution a { color: #0078A8; text-decoration: none; }
.atlas-control.atlas-attribution a:hover { text-decoration: underline; }

.atlas-tile-container, .atlas-layer-container, .atlas-marker-container, .atlas-popup-container {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none;
}
.atlas-layer-container { pointer-events: none; }
.atlas-marker-container { pointer-events: auto; }

.atlas-tile { position: absolute; transform-origin: 0 0; display:block; }
.atlas-marker {
    position: absolute;
    width: 20px; height: 20px;
    background: #3388ff; border: 2px solid #fff; border-radius: 50%;
    display:flex; align-items:center; justify-content:center;
    color:white; font-weight:bold; cursor:pointer; user-select:none;
    pointer-events: auto;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.atlas-marker.dragging { transform: scale(1.05); }

.atlas-popup {
    position: absolute; background: #fff; border: 1px solid #ccc; border-radius: 4px;
    box-shadow: 0 3px 14px rgba(0,0,0,0.25); padding: 10px; min-width: 120px; z-index: 1100;
    pointer-events: auto;
}
.atlas-popup-close {
    position: absolute; top: 4px; right: 6px; background: none; border: none; font-size: 16px;
    cursor:pointer; padding:0; width: 22px; height:22px; line-height:18px;
}
`;

// inject CSS
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = defaultCSS;
    document.head.appendChild(style);
}

// exports
exports.Map = AtlasMap;
exports.TileLayer = TileLayer;
exports.Marker = Marker;
exports.GeoJSONLayer = GeoJSONLayer;
exports.Popup = Popup;
exports.Control = Control;
exports.Utils = Utils;
exports.EventEmitter = EventEmitter;

// global
global.Atlas = exports;

}));
