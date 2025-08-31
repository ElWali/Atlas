/*!
 * Atlas.js v3.5 — Advanced Modular Mapping Engine
 * Author: ElWali ElAlaoui (Atlasian from Tarfaya)
 * License: MIT
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
    
    latLngToPixel(lat, lng, zoom) {
        const scale = Math.pow(2, zoom) * 256;
        const x = (lng + 180) / 360 * scale;
        const sinLat = Math.sin(lat * Math.PI / 180);
        const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
        return [x, y];
    },
    
    pixelToLatLng(x, y, zoom) {
        const scale = Math.pow(2, zoom) * 256;
        const lng = x / scale * 360 - 180;
        const n = Math.PI * (1 - 2 * y / scale);
        const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
        return [lat, lng];
    },
    
    distance(a, b) {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
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
    }
    
    off(evt, fn) {
        if (this._listeners.has(evt)) {
            this._listeners.set(evt, this._listeners.get(evt).filter(f => f !== fn));
        }
    }
    
    fire(evt, data) {
        const listeners = this._listeners.get(evt);
        if (!listeners) return;
        listeners.forEach(f => f(data));
    }
}

/*** Marker ***/
class Marker {
    constructor(latlng, options = {}) {
        this.latlng = latlng;
        this.options = Utils.extend({
            popup: null,
            draggable: false
        }, options);
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
            subdomains: 'abc'
        }, options);
        this._tiles = new Map();
    }
    
    addTo(map) {
        if (this.options.attribution && map._attributionControl) {
            map._attributionControl.addAttribution(this.options.attribution);
        }
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
        if (this._isOpen) {
            this._update();
        }
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
        }
        return this;
    }
    
    _create() {
        this._container = Utils.createElement('div', 'atlas-popup', this._map._popupContainer);
        
        if (this.options.closeButton) {
            const closeBtn = Utils.createElement('button', 'atlas-popup-close', this._container, {
                events: { click: () => this.close() }
            });
            closeBtn.innerHTML = '×';
        }
        
        this._contentNode = Utils.createElement('div', 'atlas-popup-content', this._container);
        this._update();
    }
    
    _update() {
        if (this._contentNode) {
            this._contentNode.textContent = this._content;
        }
    }
    
    _position() {
        const [px, py] = Utils.latLngToPixel(this._latlng[0], this._latlng[1], this._map.zoom);
        const [cx, cy] = Utils.latLngToPixel(this._map.center[0], this._map.center[1], this._map.zoom);
        const rect = this._map.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;
        
        this._container.style.left = (px - cx + halfW) + 'px';
        this._container.style.top = (py - cy + halfH - 30) + 'px';
    }
}

/*** Atlas Map ***/
class AtlasMap extends EventEmitter {
    constructor(containerId, options = {}) {
        super();
        
        const container = document.getElementById(containerId);
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
        this._hooks = {
            onTileLoad: () => {},
            onMarkerClick: () => {}
        };
        
        this._initStructure();
        this._initControls();
        this.setView(this.options.center, this.options.zoom);
        this._initInteraction();
    }
    
    _initStructure() {
        this.container.className = 'atlas-map';
        this._tileContainer = Utils.createElement('div', 'atlas-tile-container', this.container);
        this._layerContainer = Utils.createElement('div', 'atlas-layer-container', this.container);
        this._markerContainer = Utils.createElement('div', 'atlas-marker-container', this.container);
        this._controlContainer = Utils.createElement('div', 'atlas-controls', this.container);
        this._popupContainer = Utils.createElement('div', 'atlas-popup-container', this.container);
    }
    
    _initControls() {
        // Initialize default attribution control
        this._attributionControl = new Atlas.Control.Attribution();
        this._attributionControl.addTo(this);
    }
    
    _initInteraction() {
        let isDragging = false, start = [0, 0], startCenter = [0, 0];
        const getClientXY = e => (e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY]);
        
        const startHandler = e => {
            isDragging = true;
            start = getClientXY(e);
            startCenter = [...this.center];
            this.container.classList.add('dragging');
        };
        
        this.container.addEventListener('mousedown', startHandler);
        this.container.addEventListener('touchstart', startHandler);
        
        const moveHandler = e => {
            if (!isDragging) return;
            const [mx, my] = getClientXY(e);
            const scale = Math.pow(2, this.zoom) * 256;
            const deltaX = (mx - start[0]) / scale * 360;
            const deltaY = (my - start[1]) / scale * 360;
            this.setView([startCenter[0] - deltaY, startCenter[1] - deltaX], this.zoom, false);
        };
        
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('touchmove', moveHandler);
        
        const endHandler = () => {
            isDragging = false;
            this.container.classList.remove('dragging');
        };
        
        window.addEventListener('mouseup', endHandler);
        window.addEventListener('touchend', endHandler);
        
        this.container.addEventListener('wheel', e => {
            e.preventDefault();
            const newZoom = Utils.clamp(this.zoom + (e.deltaY > 0 ? -1 : 1), this.options.minZoom, this.options.maxZoom);
            this.setView(this.center, newZoom);
        });
        
        // Double click zoom
        this.container.addEventListener('dblclick', e => {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const latlng = Utils.pixelToLatLng(x, y, this.zoom);
            this.setView(latlng, this.zoom + 1);
        });
    }
    
    setView(center, zoom, render = true) {
        this.center = center;
        this.zoom = Utils.clamp(zoom, this.options.minZoom, this.options.maxZoom);
        if (render) this._render();
        this.fire('viewchange', { center: this.center, zoom: this.zoom });
    }
    
    panBy(offset) {
        const scale = Math.pow(2, this.zoom) * 256;
        const deltaX = offset[0] / scale * 360;
        const deltaY = offset[1] / scale * 360;
        this.setView([
            this.center[0] - deltaY,
            this.center[1] - deltaX
        ], this.zoom);
    }
    
    fitBounds(bounds) {
        const latDiff = Math.abs(bounds[0][0] - bounds[1][0]);
        const lngDiff = Math.abs(bounds[0][1] - bounds[1][1]);
        const zoom = Math.floor(Math.log2(360 / Math.max(latDiff, lngDiff)));
        const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        this.setView(center, zoom);
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
    
    _render() {
        this._renderTiles();
        this._renderGeoJSON();
        this._renderMarkers();
    }
    
    _renderTiles() {
        const currentTiles = new Set();
        const tileSize = 256;
        const zoom = this.zoom;
        const scale = Math.pow(2, zoom);
        
        const [centerX, centerY] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const containerRect = this.container.getBoundingClientRect();
        const halfWidth = containerRect.width / 2;
        const halfHeight = containerRect.height / 2;
        
        const startX = Math.floor((centerX - halfWidth) / tileSize);
        const endX = Math.floor((centerX + halfWidth) / tileSize);
        const startY = Math.floor((centerY - halfHeight) / tileSize);
        const endY = Math.floor((centerY + halfHeight) / tileSize);
        
        const tileLayer = this._layers.find(l => l instanceof TileLayer);
        if (!tileLayer) return;
        
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const maxIndex = scale - 1;
                const tileX = (x % scale + scale) % scale;
                const tileY = Utils.clamp(y, 0, maxIndex);
                const tileKey = `${zoom}-${tileX}-${tileY}`;
                currentTiles.add(tileKey);
                
                if (!tileLayer._tiles.has(tileKey)) {
                    const tile = document.createElement('img');
                    tile.className = 'atlas-tile';
                    tile.width = tileSize;
                    tile.height = tileSize;
                    tile.src = tileLayer.getTileUrl(tileX, tileY, zoom);
                    tile.style.position = 'absolute';
                    tile.style.left = (x * tileSize - centerX + halfWidth) + 'px';
                    tile.style.top = (y * tileSize - centerY + halfHeight) + 'px';
                    tile.dataset.key = tileKey;
                    tile.onload = () => this._hooks.onTileLoad(tile);
                    tileLayer._tiles.set(tileKey, tile);
                    this._tileContainer.appendChild(tile);
                } else {
                    const tile = tileLayer._tiles.get(tileKey);
                    tile.style.left = (x * tileSize - centerX + halfWidth) + 'px';
                    tile.style.top = (y * tileSize - centerY + halfHeight) + 'px';
                }
            }
        }
        
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
            layer.features.forEach(shape => {
                if (shape.vertices.length === 0) return;
                const points = shape.vertices.map(v => {
                    const [px, py] = Utils.latLngToPixel(v[0], v[1], zoom);
                    return (px - cx + halfW) + "," + (py - cy + halfH);
                }).join(' ');
                
                if (shape.type === 'polygon' || shape.type === 'polyline') {
                    const el = document.createElementNS(svgNS, 'polyline');
                    el.setAttribute('points', points);
                    el.setAttribute('stroke', shape.options.stroke || '#3388ff');
                    el.setAttribute('stroke-width', shape.options.weight || 3);
                    el.setAttribute('fill', shape.type === 'polygon' ? (shape.options.fill || '#3388ff33') : 'none');
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
            const div = Utils.createElement('div', 'atlas-marker', this._markerContainer, {
                events: {
                    click: () => {
                        this._hooks.onMarkerClick(marker);
                        if (marker.options.popup) {
                            const popup = new Popup();
                            popup.setContent(marker.options.popup);
                            popup.openOn(this, marker.latlng);
                        }
                    }
                }
            });
            div.style.left = (px - cx + halfW) + 'px';
            div.style.top = (py - cy + halfH) + 'px';
            div.textContent = '•';
        });
    }
    
    getCenter() {
        return [...this.center];
    }
    
    getZoom() {
        return this.zoom;
    }
    
    destroy() {
        this._layers.forEach(layer => {
            if (layer instanceof TileLayer) {
                layer._tiles.clear();
            }
        });
        
        this.container.innerHTML = '';
        this._layers = [];
        this._markers = [];
        this._geoLayers = [];
    }
}

/*** Controls ***/
class Control {
    constructor(options = {}) {
        this.options = Utils.extend({
            position: 'top-right'
        }, options);
    }
    
    addTo(map) {
        this._map = map;
        this.onAdd(map);
        return this;
    }
    
    onAdd(map) {}
}

Control.Attribution = class extends Control {
    constructor(options = {}) {
        super(Utils.extend({
            position: 'bottom-right',
            prefix: true
        }, options));
        this._attributions = new Set();
    }
    
    onAdd(map) {
        this._container = Utils.createElement('div', 'atlas-control atlas-attribution ' + this.options.position, map._controlContainer);
        
        if (this.options.prefix !== false) {
            this._addAtlasAttribution();
        }
        
        this._update();
    }
    
    _addAtlasAttribution() {
        const moroccoFlag = '🇲🇦';
        const attribution = `${moroccoFlag} <a href="https://github.com/elwali-elalaoui/atlas.js">Atlas.js</a> &copy; Atlasians`;
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
        if (attributions.length === 0) {
            this._container.innerHTML = '';
            return;
        }
        
        this._container.innerHTML = attributions.join(' | ');
    }
};

// Add default CSS
const defaultCSS = `
.atlas-map {
    position: relative;
    overflow: hidden;
    background: #ddd;
}

.atlas-control {
    position: absolute;
    z-index: 1000;
}

.atlas-control.top-right {
    top: 10px;
    right: 10px;
}

.atlas-control.bottom-right {
    bottom: 0;
    right: 0;
}

.atlas-control.atlas-attribution {
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    line-height: 1.4;
    color: #333;
    text-align: right;
}

.atlas-control.atlas-attribution a {
    color: #0078A8;
    text-decoration: none;
}

.atlas-control.atlas-attribution a:hover {
    text-decoration: underline;
}

.atlasians {
    font-weight: bold;
    color: #d32f2f;
}

.atlas-tile-container,
.atlas-layer-container,
.atlas-marker-container,
.atlas-popup-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.atlas-tile {
    position: absolute;
    transform-origin: 0 0;
}

.atlas-marker {
    position: absolute;
    width: 20px;
    height: 20px;
    background: #3388ff;
    border: 2px solid #fff;
    border-radius: 50%;
    text-align: center;
    line-height: 16px;
    font-weight: bold;
    color: white;
    cursor: pointer;
    user-select: none;
}

.atlas-popup {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 3px 14px rgba(0,0,0,0.4);
    padding: 10px;
    min-width: 100px;
    max-width: 300px;
    z-index: 1100;
}

.atlas-popup-close {
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    border: none;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 18px;
    text-align: center;
}
`;

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = defaultCSS;
    document.head.appendChild(style);
}

// Export classes
exports.Map = AtlasMap;
exports.TileLayer = TileLayer;
exports.Marker = Marker;
exports.GeoJSONLayer = GeoJSONLayer;
exports.Popup = Popup;
exports.Control = Control;
exports.Utils = Utils;
exports.EventEmitter = EventEmitter;

// Global export
global.Atlas = exports;

}));
