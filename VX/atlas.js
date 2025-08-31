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

/*** Internationalization System ***/
class I18n {
    constructor(locale = 'en') {
        this.locale = locale;
        this.translations = {
            en: {
                zoomIn: 'Zoom in',
                zoomOut: 'Zoom out',
                close: 'Close',
                marker: 'Marker',
                markers: 'markers',
                mapScale: 'Map scale',
                zoomControls: 'Zoom controls',
                mapAttribution: 'Map attribution',
                markerInformation: 'Marker information',
                toggleFullscreen: 'Toggle fullscreen',
                moveShape: 'Move shape',
                vertex: 'Vertex',
                of: 'of',
                closePopup: 'Close popup'
            },
            es: {
                zoomIn: 'Acercar',
                zoomOut: 'Alejar',
                close: 'Cerrar',
                marker: 'Marcador',
                markers: 'marcadores',
                mapScale: 'Escala del mapa',
                zoomControls: 'Controles de zoom',
                mapAttribution: 'Atribución del mapa',
                markerInformation: 'Información del marcador',
                toggleFullscreen: 'Alternar pantalla completa',
                moveShape: 'Mover forma',
                vertex: 'Vértice',
                of: 'de',
                closePopup: 'Cerrar ventana emergente'
            },
            fr: {
                zoomIn: 'Zoom avant',
                zoomOut: 'Zoom arrière',
                close: 'Fermer',
                marker: 'Marqueur',
                markers: 'marqueurs',
                mapScale: 'Échelle de la carte',
                zoomControls: 'Contrôles de zoom',
                mapAttribution: 'Attribution de la carte',
                markerInformation: 'Informations sur le marqueur',
                toggleFullscreen: 'Basculer en plein écran',
                moveShape: 'Déplacer la forme',
                vertex: 'Sommet',
                of: 'de',
                closePopup: 'Fermer la popup'
            },
            de: {
                zoomIn: 'Vergrößern',
                zoomOut: 'Verkleinern',
                close: 'Schließen',
                marker: 'Marker',
                markers: 'Marker',
                mapScale: 'Kartenskala',
                zoomControls: 'Zoom-Steuerung',
                mapAttribution: 'Kartenattribuierung',
                markerInformation: 'Marker-Informationen',
                toggleFullscreen: 'Vollbild umschalten',
                moveShape: 'Form bewegen',
                vertex: 'Eckpunkt',
                of: 'von',
                closePopup: 'Popup schließen'
            },
            zh: {
                zoomIn: '放大',
                zoomOut: '缩小',
                close: '关闭',
                marker: '标记',
                markers: '标记',
                mapScale: '地图比例尺',
                zoomControls: '缩放控制',
                mapAttribution: '地图归属',
                markerInformation: '标记信息',
                toggleFullscreen: '切换全屏',
                moveShape: '移动形状',
                vertex: '顶点',
                of: '的',
                closePopup: '关闭弹窗'
            },
            ar: {
                zoomIn: 'تكبير',
                zoomOut: 'تصغير',
                close: 'إغلاق',
                marker: 'علامة',
                markers: 'علامات',
                mapScale: 'مقياس الخريطة',
                zoomControls: 'عناصر التحكم في التكبير',
                mapAttribution: 'إسناد الخريطة',
                markerInformation: 'معلومات العلامة',
                toggleFullscreen: 'تبديل ملء الشاشة',
                moveShape: 'تحريك الشكل',
                vertex: 'رأس',
                of: 'من',
                closePopup: 'إغلاق النافذة المنبثقة'
            }
        };
    }
    
    setLocale(locale) {
        if (typeof locale !== 'string') {
            throw new TypeError('Locale must be a string');
        }
        
        if (!this.translations[locale]) {
            console.warn(`Locale '${locale}' not found, falling back to English`);
            this.locale = 'en';
        } else {
            this.locale = locale;
        }
        return this;
    }
    
    t(key) {
        if (typeof key !== 'string') {
            throw new TypeError('Translation key must be a string');
        }
        
        const translation = this.translations[this.locale][key] || this.translations['en'][key] || key;
        return translation;
    }
    
    addTranslations(locale, translations) {
        if (typeof locale !== 'string') {
            throw new TypeError('Locale must be a string');
        }
        
        if (typeof translations !== 'object') {
            throw new TypeError('Translations must be an object');
        }
        
        if (!this.translations[locale]) {
            this.translations[locale] = {};
        }
        
        Object.assign(this.translations[locale], translations);
        return this;
    }
    
    getAvailableLocales() {
        return Object.keys(this.translations);
    }
    
    getCurrentLocale() {
        return this.locale;
    }
}

// Global i18n instance
const i18n = new I18n();

/*** Utils ***/
const Utils = {
    extend: Object.assign,
    
    createElement(tag, className, container, options = {}) {
        if (typeof tag !== 'string') throw new TypeError('Tag must be a string');
        if (container && !(container instanceof Element)) throw new TypeError('Container must be a DOM element');
        
        const el = document.createElement(tag);
        if (className) el.className = className;
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([k, v]) => el.setAttribute(k, v));
        }
        
        if (options.events) {
            for (const [k, v] of Object.entries(options.events)) {
                if (typeof v !== 'function') throw new TypeError(`Event handler for ${k} must be a function`);
                el.addEventListener(k, v);
            }
        }
        
        if (container) container.appendChild(el);
        return el;
    },
    
    clamp(v, min, max) {
        if (typeof v !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
            throw new TypeError('All parameters must be numbers');
        }
        return Math.max(min, Math.min(max, v));
    },
    
    latLngToPixel(lat, lng, zoom) {
        if (!Array.isArray([lat, lng]) || typeof zoom !== 'number') {
            throw new TypeError('Invalid coordinates or zoom level');
        }
        
        const scale = Math.pow(2, zoom) * 256;
        const x = (lng + 180) / 360 * scale;
        const sinLat = Math.sin(lat * Math.PI / 180);
        const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
        return [x, y];
    },
    
    pixelToLatLng(x, y, zoom) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') {
            throw new TypeError('All parameters must be numbers');
        }
        
        const scale = Math.pow(2, zoom) * 256;
        const lng = x / scale * 360 - 180;
        const n = Math.PI * (1 - 2 * y / scale);
        const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
        return [lat, lng];
    },
    
    distance(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2) {
            throw new TypeError('Parameters must be arrays of [x, y]');
        }
        
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    getScaleDenominator(lat, zoom) {
        if (typeof lat !== 'number' || typeof zoom !== 'number') {
            throw new TypeError('Parameters must be numbers');
        }
        
        const earthRadius = 6378137;
        const equatorLength = 2 * Math.PI * earthRadius;
        const resolution = equatorLength * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
        return Math.round(resolution * 39.37 * 96);
    },
    
    sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    },
    
    debounce(func, wait) {
        if (typeof func !== 'function' || typeof wait !== 'number') {
            throw new TypeError('Invalid debounce parameters');
        }
        
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

/*** EventEmitter ***/
class EventEmitter {
    constructor() {
        this._listeners = new Map();
    }
    
    on(evt, fn) {
        if (typeof evt !== 'string' || typeof fn !== 'function') {
            throw new TypeError('Event name must be string and handler must be function');
        }
        
        if (!this._listeners.has(evt)) this._listeners.set(evt, []);
        this._listeners.get(evt).push(fn);
        return this;
    }
    
    off(evt, fn) {
        if (typeof evt !== 'string') throw new TypeError('Event name must be string');
        if (this._listeners.has(evt)) {
            if (fn) {
                this._listeners.set(evt, this._listeners.get(evt).filter(f => f !== fn));
            } else {
                this._listeners.delete(evt);
            }
        }
        return this;
    }
    
    fire(evt, data) {
        if (typeof evt !== 'string') throw new TypeError('Event name must be string');
        const listeners = this._listeners.get(evt);
        if (!listeners) return this;
        
        listeners.forEach(f => {
            try {
                f(data);
            } catch (e) {
                console.error(`Error in event listener for ${evt}:`, e);
            }
        });
        return this;
    }
    
    once(evt, fn) {
        const onceWrapper = (data) => {
            fn(data);
            this.off(evt, onceWrapper);
        };
        return this.on(evt, onceWrapper);
    }
}

/*** State Manager ***/
class StateManager {
    constructor(map) {
        this.map = map;
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 50;
    }
    
    save() {
        const state = {
            center: [...this.map.center],
            zoom: this.map.zoom,
            timestamp: Date.now()
        };
        
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(state);
        this.currentIndex++;
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }
    }
    
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this._restore(this.history[this.currentIndex]);
            return true;
        }
        return false;
    }
    
    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            this._restore(this.history[this.currentIndex]);
            return true;
        }
        return false;
    }
    
    _restore(state) {
        this.map.setView(state.center, state.zoom, true);
    }
    
    canUndo() {
        return this.currentIndex > 0;
    }
    
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
}

/*** Marker ***/
class Marker {
    constructor(latlng, options = {}) {
        if (!Array.isArray(latlng) || latlng.length !== 2) {
            throw new TypeError('LatLng must be an array of [lat, lng]');
        }
        
        this.latlng = latlng;
        this.options = Utils.extend({
            popup: null,
            draggable: false,
            title: '',
            alt: ''
        }, options);
        this._popup = null;
        this._element = null;
    }
}

/*** Editable Shape ***/
class EditableShape {
    constructor(type, options = {}) {
        if (typeof type !== 'string') throw new TypeError('Type must be a string');
        
        this.type = type;
        this.vertices = [];
        this.options = Utils.extend({
            stroke: '#3388ff',
            fill: '#3388ff33',
            weight: 2,
            handle: '#ff0000',
            snapDistance: 10,
            grid: null,
            editable: true
        }, options);
        this._undoStack = [];
        this._redoStack = [];
    }
    
    addVertex(latlng) {
        if (!Array.isArray(latlng) || latlng.length !== 2) {
            throw new TypeError('LatLng must be an array of [lat, lng]');
        }
        
        if (!this.options.editable) return this;
        this.vertices.push(latlng);
        this._saveState();
        return this;
    }
    
    moveVertex(index, latlng) {
        if (typeof index !== 'number' || !Array.isArray(latlng) || latlng.length !== 2) {
            throw new TypeError('Invalid parameters');
        }
        
        if (!this.options.editable) return this;
        this.vertices[index] = latlng;
        this._saveState();
        return this;
    }
    
    moveShape(deltaLat, deltaLng) {
        if (typeof deltaLat !== 'number' || typeof deltaLng !== 'number') {
            throw new TypeError('Delta values must be numbers');
        }
        
        if (!this.options.editable) return this;
        this.vertices = this.vertices.map(v => [v[0] + deltaLat, v[1] + deltaLng]);
        this._saveState();
        return this;
    }
    
    undo() {
        if (!this.options.editable || this._undoStack.length <= 1) return this;
        this._redoStack.push(this._undoStack.pop());
        this.vertices = [...this._undoStack[this._undoStack.length - 1]];
        return this;
    }
    
    redo() {
        if (!this.options.editable || this._redoStack.length === 0) return this;
        this.vertices = [...this._redoStack.pop()];
        this._undoStack.push([...this.vertices]);
        return this;
    }
    
    _saveState() {
        this._undoStack.push([...this.vertices]);
        if (this._undoStack.length > 50) this._undoStack.shift();
    }
    
    setEditable(editable) {
        if (typeof editable !== 'boolean') throw new TypeError('Editable must be boolean');
        this.options.editable = editable;
        return this;
    }
    
    getType() {
        return this.type;
    }
    
    getVertices() {
        return [...this.vertices];
    }
}

/*** GeoJSON Layer ***/
class GeoJSONLayer {
    constructor(features = []) {
        if (!Array.isArray(features)) throw new TypeError('Features must be an array');
        
        this.features = features;
        this._visible = true;
        this._id = Math.random().toString(36).substr(2, 9);
    }
    
    setVisible(visible) {
        if (typeof visible !== 'boolean') throw new TypeError('Visible must be boolean');
        this._visible = visible;
        return this;
    }
    
    isVisible() {
        return this._visible;
    }
    
    addFeature(feature) {
        if (!(feature instanceof EditableShape)) {
            throw new TypeError('Feature must be an EditableShape instance');
        }
        this.features.push(feature);
        return this;
    }
    
    removeFeature(feature) {
        const index = this.features.indexOf(feature);
        if (index > -1) {
            this.features.splice(index, 1);
        }
        return this;
    }
    
    getId() {
        return this._id;
    }
}

/*** Popup System ***/
class Popup {
    constructor(options = {}) {
        this.options = Utils.extend({
            closeButton: true,
            className: '',
            offset: [0, 7],
            maxWidth: 300,
            autoClose: true
        }, options);
        this._content = '';
        this._isOpen = false;
        this._map = null;
    }
    
    setContent(content) {
        if (typeof content !== 'string' && !(content instanceof Element)) {
            throw new TypeError('Content must be string or DOM element');
        }
        
        this._content = content;
        if (this._isOpen) {
            this._update();
        }
        return this;
    }
    
    openOn(map, latlng) {
        if (!(map instanceof AtlasMap)) throw new TypeError('Map must be AtlasMap instance');
        if (!Array.isArray(latlng) || latlng.length !== 2) {
            throw new TypeError('LatLng must be array of [lat, lng]');
        }
        
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
            this._map = null;
        }
        return this;
    }
    
    _create() {
        if (this._container) this._container.remove();
        
        this._container = Utils.createElement('div', 'atlas-popup ' + this.options.className, this._map._popupContainer);
        this._container.style.maxWidth = this.options.maxWidth + 'px';
        
        if (this.options.closeButton) {
            const closeBtn = Utils.createElement('button', 'atlas-popup-close', this._container, {
                events: { click: () => this.close() },
                attributes: { 'aria-label': i18n.t('closePopup') }
            });
            closeBtn.innerHTML = '×';
        }
        
        this._contentNode = Utils.createElement('div', 'atlas-popup-content', this._container);
        this._update();
    }
    
    _update() {
        if (this._contentNode) {
            if (typeof this._content === 'string') {
                this._contentNode.innerHTML = Utils.sanitizeHTML(this._content);
            } else {
                this._contentNode.innerHTML = '';
                this._contentNode.appendChild(this._content.cloneNode(true));
            }
        }
    }
    
    _position() {
        if (!this._map || !this._latlng) return;
        
        const [px, py] = Utils.latLngToPixel(this._latlng[0], this._latlng[1], this._map.zoom);
        const [cx, cy] = Utils.latLngToPixel(this._map.center[0], this._map.center[1], this._map.zoom);
        const rect = this._map.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;
        
        this._container.style.left = (px - cx + halfW + this.options.offset[0]) + 'px';
        this._container.style.top = (py - cy + halfH - this.options.offset[1]) + 'px';
    }
    
    isOpen() {
        return this._isOpen;
    }
}

/*** Tile Layer ***/
class TileLayer {
    constructor(urlTemplate, options = {}) {
        if (typeof urlTemplate !== 'string') throw new TypeError('URL template must be string');
        
        this.urlTemplate = urlTemplate;
        this.options = Utils.extend({
            minZoom: 0,
            maxZoom: 20,
            attribution: '',
            subdomains: 'abc',
            tileSize: 256,
            opacity: 1.0,
            zIndex: 1
        }, options);
        this._tiles = new Map();
        this._loading = new Set();
    }
    
    addTo(map) {
        if (!(map instanceof AtlasMap)) throw new TypeError('Map must be AtlasMap instance');
        
        // Only add attribution if explicitly provided
        if (this.options.attribution) {
            // Let the map's attribution control handle this
            if (map._attributionControl) {
                map._attributionControl.addAttribution(this.options.attribution);
            }
        }
        return this;
    }
    
    getTileUrl(x, y, z) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
            throw new TypeError('Tile coordinates must be numbers');
        }
        
        const s = this.options.subdomains[Math.abs(x + y) % this.options.subdomains.length];
        return this.urlTemplate
            .replace('{s}', s)
            .replace('{x}', x)
            .replace('{y}', y)
            .replace('{z}', z);
    }
    
    setOpacity(opacity) {
        if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
            throw new RangeError('Opacity must be between 0 and 1');
        }
        
        this.options.opacity = opacity;
        this._tiles.forEach(tile => {
            tile.style.opacity = opacity;
        });
        return this;
    }
    
    getOpacity() {
        return this.options.opacity;
    }
    
    setZIndex(zIndex) {
        if (typeof zIndex !== 'number') throw new TypeError('zIndex must be a number');
        this.options.zIndex = zIndex;
        return this;
    }
    
    getZIndex() {
        return this.options.zIndex;
    }
}

/*** Atlas Map ***/
class AtlasMap extends EventEmitter {
    constructor(containerId, options = {}) {
        super();
        
        if (typeof containerId !== 'string') throw new TypeError('Container ID must be a string');
        
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container '${containerId}' not found`);
        
        this.container = container;
        this.options = Utils.extend({
            center: [0, 0],
            zoom: 2,
            minZoom: 0,
            maxZoom: 20,
            cluster: true,
            clusterSize: 80,
            edit: true,
            animate: true,
            theme: null,
            keyboard: true,
            doubleClickZoom: true,
            touchZoom: true,
            inertia: true,
            inertiaDeceleration: 3000,
            maxBounds: null,
            locale: 'en'
        }, options);
        
        // Set locale
        i18n.setLocale(this.options.locale);
        
        // Validate options
        this._validateOptions();
        
        this._layers = [];
        this._markers = [];
        this._clusteredMarkers = [];
        this._geoLayers = [];
        this._hooks = {
            onTileLoad: () => {},
            onMarkerClick: () => {},
            onShapeEdit: () => {},
            onShapeMove: () => {},
            onClusterUpdate: () => {}
        };
        
        this._stateManager = new StateManager(this);
        this._initStructure();
        this._initControls();
        this.setView(this.options.center, this.options.zoom);
        this._initInteraction();
        this._applyTheme(this.options.theme);
        if (this.options.keyboard) this._initKeyboard();
        
        // Save initial state
        this._stateManager.save();
    }
    
    _validateOptions() {
        if (!Array.isArray(this.options.center) || this.options.center.length !== 2) {
            throw new TypeError('Center must be an array of [lat, lng]');
        }
        
        if (typeof this.options.zoom !== 'number' || this.options.zoom < 0) {
            throw new RangeError('Zoom must be a positive number');
        }
        
        if (this.options.maxBounds && 
            (!Array.isArray(this.options.maxBounds) || this.options.maxBounds.length !== 2)) {
            throw new TypeError('Max bounds must be an array of two [lat, lng] arrays');
        }
    }
    
    // i18n methods
    setLocale(locale) {
        i18n.setLocale(locale);
        this.options.locale = locale;
        // Re-render controls to update text
        this._renderControls();
        return this;
    }
    
    addTranslations(locale, translations) {
        i18n.addTranslations(locale, translations);
        return this;
    }
    
    getAvailableLocales() {
        return i18n.getAvailableLocales();
    }
    
    getCurrentLocale() {
        return i18n.getCurrentLocale();
    }
    
    onTileLoad(fn) {
        if (typeof fn !== 'function') throw new TypeError('Handler must be a function');
        this._hooks.onTileLoad = fn;
        return this;
    }
    
    onMarkerClick(fn) {
        if (typeof fn !== 'function') throw new TypeError('Handler must be a function');
        this._hooks.onMarkerClick = fn;
        return this;
    }
    
    onShapeEdit(fn) {
        if (typeof fn !== 'function') throw new TypeError('Handler must be a function');
        this._hooks.onShapeEdit = fn;
        return this;
    }
    
    onShapeMove(fn) {
        if (typeof fn !== 'function') throw new TypeError('Handler must be a function');
        this._hooks.onShapeMove = fn;
        return this;
    }
    
    onClusterUpdate(fn) {
        if (typeof fn !== 'function') throw new TypeError('Handler must be a function');
        this._hooks.onClusterUpdate = fn;
        return this;
    }
    
    _applyTheme(theme) {
        if (!theme) return;
        if (typeof theme !== 'object') throw new TypeError('Theme must be an object');
        
        Object.entries(theme).forEach(([k, v]) => {
            this.container.style.setProperty(`--${k}`, v);
        });
    }
    
    _initStructure() {
        this.container.className = 'atlas-map';
        this.container.setAttribute('tabindex', '0');
        this.container.setAttribute('role', 'application');
        this.container.setAttribute('aria-label', 'Interactive map');
        
        this._tileContainer = Utils.createElement('div', 'atlas-tile-container', this.container);
        this._layerContainer = Utils.createElement('div', 'atlas-layer-container', this.container);
        this._markerContainer = Utils.createElement('div', 'atlas-marker-container', this.container);
        this._controlContainer = Utils.createElement('div', 'atlas-controls', this.container);
        this._popupContainer = Utils.createElement('div', 'atlas-popup-container', this.container);
        this._editorLayer = Utils.createElement('div', 'atlas-editor-layer', this.container);
    }
    
    _initControls() {
        new Atlas.Control.Zoom().addTo(this);
        new Atlas.Control.Scale().addTo(this);
        // Initialize default attribution control
        this._attributionControl = new Atlas.Control.Attribution();
        this._attributionControl.addTo(this);
    }
    
    _renderControls() {
        // This would re-render controls with new locale
        // In a real implementation, controls would listen to locale changes
    }
    
    _initKeyboard() {
        this.container.addEventListener('keydown', e => {
            switch (e.key) {
                case '+':
                case '=':
                    this.setView(this.center, this.zoom + 1);
                    break;
                case '-':
                case '_':
                    this.setView(this.center, this.zoom - 1);
                    break;
                case 'ArrowUp':
                    this.panBy([0, -50]);
                    break;
                case 'ArrowDown':
                    this.panBy([0, 50]);
                    break;
                case 'ArrowLeft':
                    this.panBy([-50, 0]);
                    break;
                case 'ArrowRight':
                    this.panBy([50, 0]);
                    break;
                case 'z':
                case 'Z':
                    if (e.ctrlKey) this._stateManager.undo();
                    break;
                case 'y':
                case 'Y':
                    if (e.ctrlKey) this._stateManager.redo();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });
    }
    
    _initInteraction() {
        let isDragging = false, start = [0, 0], startCenter = [0, 0];
        let lastTouchDistance = 0;
        let lastTouchMidpoint = [0, 0];
        let velocity = { x: 0, y: 0 };
        let lastMoveTime = 0;
        let lastMovePos = [0, 0];
        
        const getClientXY = e => (e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY]);
        
        const startHandler = e => {
            isDragging = true;
            start = getClientXY(e);
            startCenter = [...this.center];
            this.container.classList.add('dragging');
            lastMovePos = [...start];
            lastMoveTime = Date.now();
            velocity = { x: 0, y: 0 };
        };
        
        this.container.addEventListener('mousedown', startHandler);
        this.container.addEventListener('touchstart', e => {
            if (e.touches.length === 2 && this.options.touchZoom) {
                lastTouchDistance = Utils.distance(
                    [e.touches[0].clientX, e.touches[0].clientY],
                    [e.touches[1].clientX, e.touches[1].clientY]
                );
                lastTouchMidpoint = [
                    (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    (e.touches[0].clientY + e.touches[1].clientY) / 2
                ];
            } else {
                startHandler(e);
            }
        }, { passive: false });
        
        const moveHandler = e => {
            if (e.touches && e.touches.length === 2 && this.options.touchZoom) {
                const currentDistance = Utils.distance(
                    [e.touches[0].clientX, e.touches[0].clientY],
                    [e.touches[1].clientX, e.touches[1].clientY]
                );
                const currentMidpoint = [
                    (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    (e.touches[0].clientY + e.touches[1].clientY) / 2
                ];
                
                const scaleChange = currentDistance / lastTouchDistance;
                if (Math.abs(scaleChange - 1) > 0.01) {
                    const newZoom = this.zoom + Math.log2(scaleChange);
                    this.setView(this.center, Utils.clamp(newZoom, this.options.minZoom, this.options.maxZoom));
                }
                
                const deltaX = currentMidpoint[0] - lastTouchMidpoint[0];
                const deltaY = currentMidpoint[1] - lastTouchMidpoint[1];
                if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                    const scale = Math.pow(2, this.zoom) * 256;
                    const deltaLng = deltaX / scale * 360;
                    const deltaLat = -deltaY / scale * 360;
                    this.setView([
                        this.center[0] - deltaLat,
                        this.center[1] - deltaLng
                    ], this.zoom, false);
                    lastTouchMidpoint = currentMidpoint;
                }
                
                lastTouchDistance = currentDistance;
                return;
            }
            
            const [mx, my] = getClientXY(e);
            
            // Calculate velocity for inertia
            if (isDragging && this.options.inertia) {
                const now = Date.now();
                const dt = now - lastMoveTime;
                if (dt > 0) {
                    velocity.x = (mx - lastMovePos[0]) / dt;
                    velocity.y = (my - lastMovePos[1]) / dt;
                }
                lastMovePos = [mx, my];
                lastMoveTime = now;
            }
            
            if (this._draggingVertex) {
                let latlng = Utils.pixelToLatLng(mx - this._dragOffset[0], my - this._dragOffset[1], this.zoom);
                if (this._draggingVertex.shape.options.grid) {
                    const grid = this._draggingVertex.shape.options.grid;
                    latlng[0] = Math.round(latlng[0] / grid) * grid;
                    latlng[1] = Math.round(latlng[1] / grid) * grid;
                }
                this._geoLayers.flatMap(l => l.features).forEach(s => {
                    if (s === this._draggingVertex.shape) return;
                    s.vertices.forEach(v => {
                        if (Utils.distance(
                            Utils.latLngToPixel(...v, this.zoom),
                            Utils.latLngToPixel(...latlng, this.zoom)
                        ) < this._draggingVertex.shape.options.snapDistance)
                            latlng = [...v];
                    });
                });
                this._draggingVertex.shape.moveVertex(this._draggingVertex.index, latlng);
                this._hooks.onShapeEdit(this._draggingVertex.shape);
                this._render();
                return;
            }
            
            if (this._movingShape) {
                const deltaX = mx - start[0], deltaY = my - start[1];
                const [latStart, lngStart] = startCenter;
                const [latEnd, lngEnd] = Utils.pixelToLatLng(deltaX, deltaY, this.zoom);
                const deltaLat = latEnd - latStart, deltaLng = lngEnd - lngStart;
                this._movingShape.shape.moveShape(deltaLat, deltaLng);
                this._hooks.onShapeMove(this._movingShape.shape);
                this._render();
                return;
            }
            
            if (!isDragging) return;
            const scale = Math.pow(2, this.zoom) * 256;
            const deltaX = (mx - start[0]) / scale * 360;
            const deltaY = (my - start[1]) / scale * 360;
            this.setView([startCenter[0] - deltaY, startCenter[1] - deltaX], this.zoom, false);
        };
        
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        
        const endHandler = () => {
            if (isDragging && this.options.inertia) {
                const decel = this.options.inertiaDeceleration;
                const scale = Math.pow(2, this.zoom) * 256;
                const factor = decel / 1000;
                
                const animateInertia = () => {
                    velocity.x *= 0.95;
                    velocity.y *= 0.95;
                    
                    if (Math.abs(velocity.x) > 0.01 || Math.abs(velocity.y) > 0.01) {
                        const deltaX = velocity.x * factor / scale * 360;
                        const deltaY = velocity.y * factor / scale * 360;
                        this.setView([
                            this.center[0] - deltaY,
                            this.center[1] - deltaX
                        ], this.zoom, false);
                        requestAnimationFrame(animateInertia);
                    }
                };
                
                if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) {
                    requestAnimationFrame(animateInertia);
                }
            }
            
            isDragging = false;
            this._draggingVertex = null;
            this._movingShape = null;
            this.container.classList.remove('dragging');
            
            // Save state after interaction
            this._stateManager.save();
        };
        
        window.addEventListener('mouseup', endHandler);
        window.addEventListener('touchend', endHandler);
        
        this.container.addEventListener('wheel', e => {
            e.preventDefault();
            const newZoom = Utils.clamp(this.zoom + (e.deltaY > 0 ? -1 : 1), this.options.minZoom, this.options.maxZoom);
            this.setView(this.center, newZoom);
        }, { passive: false });
        
        if (this.options.doubleClickZoom) {
            this.container.addEventListener('dblclick', e => {
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const latlng = Utils.pixelToLatLng(x, y, this.zoom);
                this.setView(latlng, this.zoom + 1);
            });
        }
    }
    
    setView(center, zoom, render = true) {
        if (!Array.isArray(center) || center.length !== 2) {
            throw new TypeError('Center must be an array of [lat, lng]');
        }
        
        if (typeof zoom !== 'number') throw new TypeError('Zoom must be a number');
        
        // Apply bounds constraints
        if (this.options.maxBounds) {
            center[0] = Utils.clamp(center[0], this.options.maxBounds[0][0], this.options.maxBounds[1][0]);
            center[1] = Utils.clamp(center[1], this.options.maxBounds[0][1], this.options.maxBounds[1][1]);
        }
        
        this.center = center;
        this.zoom = Utils.clamp(zoom, this.options.minZoom, this.options.maxZoom);
        
        if (render) this._render();
        this.fire('viewchange', { center: this.center, zoom: this.zoom });
        return this;
    }
    
    panBy(offset) {
        if (!Array.isArray(offset) || offset.length !== 2) {
            throw new TypeError('Offset must be an array of [x, y]');
        }
        
        const scale = Math.pow(2, this.zoom) * 256;
        const deltaX = offset[0] / scale * 360;
        const deltaY = offset[1] / scale * 360;
        this.setView([
            this.center[0] - deltaY,
            this.center[1] - deltaX
        ], this.zoom);
        return this;
    }
    
    fitBounds(bounds) {
        if (!Array.isArray(bounds) || bounds.length !== 2) {
            throw new TypeError('Bounds must be an array of two [lat, lng] arrays');
        }
        
        const latDiff = Math.abs(bounds[0][0] - bounds[1][0]);
        const lngDiff = Math.abs(bounds[0][1] - bounds[1][1]);
        const zoom = Math.floor(Math.log2(360 / Math.max(latDiff, lngDiff)));
        const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        this.setView(center, zoom);
        return this;
    }
    
    addLayer(layer) {
        if (!layer || typeof layer.addTo !== 'function') {
            throw new TypeError('Layer must have addTo method');
        }
        
        this._layers.push(layer);
        if (layer.addTo) layer.addTo(this);
        this._render();
        return this;
    }
    
    addMarker(marker) {
        if (!(marker instanceof Marker)) throw new TypeError('Marker must be Marker instance');
        
        this._markers.push(marker);
        this._render();
        return this;
    }
    
    addGeoJSONLayer(layer) {
        if (!(layer instanceof GeoJSONLayer)) throw new TypeError('Layer must be GeoJSONLayer instance');
        
        this._geoLayers.push(layer);
        this._render();
        return this;
    }
    
    removeLayer(layer) {
        const index = this._layers.indexOf(layer);
        if (index > -1) {
            this._layers.splice(index, 1);
            this._render();
        }
        return this;
    }
    
    removeMarker(marker) {
        const index = this._markers.indexOf(marker);
        if (index > -1) {
            this._markers.splice(index, 1);
            this._render();
        }
        return this;
    }
    
    removeGeoJSONLayer(layer) {
        const index = this._geoLayers.indexOf(layer);
        if (index > -1) {
            this._geoLayers.splice(index, 1);
            this._render();
        }
        return this;
    }
    
    _render() {
        this._renderTiles();
        this._renderGeoJSON();
        this._clusterMarkers();
        this._renderMarkers();
        if (this.options.edit) this._renderEditor();
        return this;
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
                    tile.style.opacity = tileLayer.options.opacity;
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
        svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
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
                    el.setAttribute('stroke', shape.options.stroke);
                    el.setAttribute('stroke-width', shape.options.weight);
                    el.setAttribute('fill', shape.type === 'polygon' ? shape.options.fill : 'none');
                    el.setAttribute('stroke-linejoin', 'round');
                    el.setAttribute('stroke-linecap', 'round');
                    svg.appendChild(el);
                }
            });
        });
    }
    
    _clusterMarkers() {
        if (!this.options.cluster) {
            this._clusteredMarkers = this._markers.map(m => ({ latlng: m.latlng, markers: [m] }));
            return;
        }
        
        const sizePx = this.options.clusterSize;
        const zoom = this.zoom;
        const buckets = {};
        
        this._markers.forEach(m => {
            const [px, py] = Utils.latLngToPixel(m.latlng[0], m.latlng[1], zoom);
            const key = Math.floor(px / sizePx) + "_" + Math.floor(py / sizePx);
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(m);
        });
        
        this._clusteredMarkers = Object.values(buckets).map(arr => {
            if (arr.length === 1) return { latlng: arr[0].latlng, markers: arr };
            const lat = arr.reduce((s, m) => s + m.latlng[0], 0) / arr.length;
            const lng = arr.reduce((s, m) => s + m.latlng[1], 0) / arr.length;
            return { latlng: [lat, lng], markers: arr };
        });
        
        this._hooks.onClusterUpdate(this._clusteredMarkers);
    }
    
    _renderMarkers() {
        this._markerContainer.innerHTML = '';
        const zoom = this.zoom;
        const [cx, cy] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const rect = this.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;
        
        this._clusteredMarkers.forEach(cluster => {
            const [px, py] = Utils.latLngToPixel(cluster.latlng[0], cluster.latlng[1], zoom);
            const div = Utils.createElement('div', 'atlas-marker', this._markerContainer, {
                events: {
                    click: () => {
                        if (cluster.markers.length === 1) {
                            this._hooks.onMarkerClick(cluster.markers[0]);
                            this._showPopup(cluster.markers[0], px - cx + halfW, py - cy + halfH);
                        } else {
                            this.setView(cluster.latlng, this.zoom + 1);
                        }
                    },
                    keydown: e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            div.click();
                        }
                    }
                },
                attributes: {
                    'tabindex': '0',
                    'role': 'button',
                    'aria-label': cluster.markers.length > 1 ?
                        `${cluster.markers.length} ${i18n.t('markers')}` :
                        i18n.t('marker')
                }
            });
            div.style.left = (px - cx + halfW) + 'px';
            div.style.top = (py - cy + halfH) + 'px';
            div.textContent = cluster.markers.length > 1 ? cluster.markers.length : '•';
        });
    }
    
    _showPopup(marker, x, y) {
        this._popupContainer.innerHTML = '';
        if (!marker.options.popup) return;
        
        const popup = Utils.createElement('div', 'atlas-popup', this._popupContainer, {
            attributes: {
                'role': 'dialog',
                'aria-label': i18n.t('markerInformation')
            }
        });
        popup.innerHTML = Utils.sanitizeHTML(marker.options.popup);
        
        popup.style.left = x + 'px';
        popup.style.top = (y - 30) + 'px';
        
        const closeBtn = Utils.createElement('button', 'atlas-popup-close', popup, {
            events: {
                click: () => popup.remove()
            },
            attributes: {
                'aria-label': i18n.t('closePopup')
            }
        });
        closeBtn.innerHTML = '×';
    }
    
    _renderEditor() {
        this._editorLayer.innerHTML = '';
        const zoom = this.zoom;
        const [cx, cy] = Utils.latLngToPixel(this.center[0], this.center[1], zoom);
        const rect = this.container.getBoundingClientRect();
        const halfW = rect.width / 2, halfH = rect.height / 2;
        
        this._geoLayers.forEach(layer => {
            if (!layer.isVisible()) return;
            layer.features.forEach(shape => {
                if (!shape.options.editable) return;
                shape.vertices.forEach((v, i) => {
                    const [px, py] = Utils.latLngToPixel(v[0], v[1], zoom);
                    const handle = Utils.createElement('div', 'atlas-handle', this._editorLayer, {
                        events: {
                            mousedown: e => {
                                e.stopPropagation();
                                this._draggingVertex = { shape, index: i };
                                this._dragOffset = [px - (e.clientX), py - (e.clientY)];
                            },
                            touchstart: e => {
                                e.stopPropagation();
                                const t = e.touches[0];
                                this._draggingVertex = { shape, index: i };
                                this._dragOffset = [px - t.clientX, py - t.clientY];
                            },
                            keydown: e => {
                                if (e.key === 'Delete' || e.key === 'Backspace') {
                                    e.preventDefault();
                                    shape.vertices.splice(i, 1);
                                    this._render();
                                }
                            }
                        },
                        attributes: {
                            'tabindex': '0',
                            'role': 'slider',
                            'aria-label': `${i18n.t('vertex')} ${i + 1} ${i18n.t('of')} ${shape.vertices.length}`
                        }
                    });
                    handle.style.left = (px - cx + halfW - 4) + 'px';
                    handle.style.top = (py - cy + halfH - 4) + 'px';
                });
                
                if (shape.vertices.length > 0) {
                    const [px, py] = Utils.latLngToPixel(shape.vertices[0][0], shape.vertices[0][1], zoom);
                    const moveHandle = Utils.createElement('div', 'atlas-move-handle', this._editorLayer, {
                        events: {
                            mousedown: e => {
                                e.stopPropagation();
                                this._movingShape = { shape };
                                start = [e.clientX, e.clientY];
                            },
                            touchstart: e => {
                                e.stopPropagation();
                                this._movingShape = { shape };
                                start = [e.touches[0].clientX, e.touches[0].clientY];
                            }
                        },
                        attributes: {
                            'tabindex': '0',
                            'role': 'button',
                            'aria-label': i18n.t('moveShape')
                        }
                    });
                    moveHandle.style.left = (px - cx + halfW - 8) + 'px';
                    moveHandle.style.top = (py - cy + halfH - 20) + 'px';
                    moveHandle.textContent = '≡';
                }
            });
        });
    }
    
    // Public API methods
    getCenter() {
        return [...this.center];
    }
    
    getZoom() {
        return this.zoom;
    }
    
    getBounds() {
        const rect = this.container.getBoundingClientRect();
        const halfW = rect.width / 2;
        const halfH = rect.height / 2;
        const scale = Math.pow(2, this.zoom) * 256;
        
        const nw = Utils.pixelToLatLng(-halfW, -halfH, this.zoom);
        const se = Utils.pixelToLatLng(halfW, halfH, this.zoom);
        
        return [nw, se];
    }
    
    undo() {
        return this._stateManager.undo();
    }
    
    redo() {
        return this._stateManager.redo();
    }
    
    canUndo() {
        return this._stateManager.canUndo();
    }
    
    canRedo() {
        return this._stateManager.canRedo();
    }
    
    destroy() {
        // Clean up event listeners
        this._listeners.clear();
        
        // Clear tile caches
        this._layers.forEach(layer => {
            if (layer instanceof TileLayer) {
                layer._tiles.clear();
            }
        });
        
        // Remove DOM elements
        this.container.innerHTML = '';
        
        // Clear references
        this._layers = [];
        this._markers = [];
        this._geoLayers = [];
        this._hooks = {};
        
        return this;
    }
}

/*** Controls ***/
class Control {
    constructor(options = {}) {
        this.options = Utils.extend({
            position: 'top-right'
        }, options);
        this._map = null;
    }
    
    addTo(map) {
        if (!(map instanceof AtlasMap)) throw new TypeError('Map must be AtlasMap instance');
        this._map = map;
        this.onAdd(map);
        return this;
    }
    
    onAdd(map) {
        // Override in subclasses
    }
    
    onRemove(map) {
        // Override in subclasses
    }
    
    remove() {
        if (this._map && this._container) {
            this._container.remove();
            this.onRemove(this._map);
        }
        return this;
    }
}

Control.Zoom = class extends Control {
    constructor(options = {}) {
        super(options);
    }
    
    onAdd(map) {
        const div = Utils.createElement('div', 'atlas-control zoom-control ' + this.options.position, map._controlContainer, {
            attributes: { 'role': 'group', 'aria-label': i18n.t('zoomControls') }
        });
        
        const createButton = (label, action, ariaLabel) => Utils.createElement('button', 'atlas-control-button', div, {
            events: { click: action },
            attributes: { 'aria-label': ariaLabel }
        });
        
        const zoomIn = createButton('+', () => map.setView(map.center, map.zoom + 1), i18n.t('zoomIn'));
        const zoomOut = createButton('-', () => map.setView(map.center, map.zoom - 1), i18n.t('zoomOut'));
        zoomIn.textContent = '+';
        zoomOut.textContent = '-';
    }
};

Control.Scale = class extends Control {
    constructor(options = {}) {
        super(options);
        this._scaleDiv = null;
    }
    
    onAdd(map) {
        this._scaleDiv = Utils.createElement('div', 'atlas-control scale-control', map._controlContainer, {
            attributes: { 'aria-label': i18n.t('mapScale') }
        });
        
        const updateScale = () => {
            const scale = Utils.getScaleDenominator(map.center[0], map.zoom);
            this._scaleDiv.textContent = `1:${scale.toLocaleString()}`;
        };
        
        map.on('viewchange', updateScale);
        updateScale();
    }
};

Control.Fullscreen = class extends Control {
    constructor(options = {}) {
        super(options);
        this._isFullscreen = false;
    }
    
    onAdd(map) {
        const container = Utils.createElement('div', 'atlas-control fullscreen-control');
        const button = Utils.createElement('button', 'atlas-control-button', container, {
            events: {
                click: () => this._toggleFullscreen()
            },
            attributes: {
                'aria-label': i18n.t('toggleFullscreen')
            }
        });
        button.textContent = '⛶';
        button.title = i18n.t('toggleFullscreen');
        this._container = container;
        return container;
    }
    
    _toggleFullscreen() {
        if (!document.fullscreenElement) {
            this._map.container.requestFullscreen().then(() => {
                this._isFullscreen = true;
            });
        } else {
            document.exitFullscreen().then(() => {
                this._isFullscreen = false;
            });
        }
    }
};

// Professional Attribution Control - Can be extended separately
Control.Attribution = class extends Control {
    constructor(options = {}) {
        super(Utils.extend({
            position: 'bottom-right',
            prefix: true,
            customAttribution: null
        }, options));
        this._attributions = new Set();
    }
    
    onAdd(map) {
        this._container = Utils.createElement('div', 'atlas-control atlas-attribution ' + this.options.position, map._controlContainer, {
            attributes: { 'aria-label': i18n.t('mapAttribution') }
        });
        
        // Add default Atlas.js attribution
        if (this.options.prefix !== false) {
            this._addAtlasAttribution();
        }
        
        // Add custom attribution if provided
        if (this.options.customAttribution) {
            this.addAttribution(this.options.customAttribution);
        }
        
        this._update();
        return this._container;
    }
    
    _addAtlasAttribution() {
        // Morocco flag using emoji
        const moroccoFlag = '🇲🇦';
        const attribution = `${moroccoFlag} <a href="https://github.com/elwali-elalaoui/atlas.js" title="Atlas.js">Atlas.js</a> &copy; <span class="atlasians">Atlasians</span>`;
        this.addAttribution(attribution);
    }
    
    addAttribution(text) {
        if (typeof text !== 'string') {
            throw new TypeError('Attribution text must be a string');
        }
        
        this._attributions.add(Utils.sanitizeHTML(text));
        this._update();
        return this;
    }
    
    removeAttribution(text) {
        this._attributions.delete(text);
        this._update();
        return this;
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
    
    setPrefix(prefix) {
        if (prefix === false) {
            this.options.prefix = false;
        } else {
            this.options.prefix = prefix || true;
        }
        this._update();
        return this;
    }
};

// Add default CSS styles
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
    max-width: 80%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

.atlas-map .atlas-attribution {
    direction: ltr;
}

/* RTL languages support */
.atlas-map[dir="rtl"] .atlas-attribution {
    text-align: left;
    left: 0;
    right: auto;
}

.atlas-tile-container,
.atlas-layer-container,
.atlas-marker-container,
.atlas-editor-layer,
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

.atlas-marker:focus {
    outline: 2px solid #000;
    outline-offset: 2px;
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

.atlas-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #ff0000;
    border: 1px solid #fff;
    border-radius: 50%;
    cursor: move;
    z-index: 1050;
}

.atlas-move-handle {
    position: absolute;
    width: 16px;
    height: 16px;
    background: #000;
    color: #fff;
    border: 1px solid #fff;
    border-radius: 3px;
    cursor: move;
    font-size: 10px;
    text-align: center;
    line-height: 14px;
    z-index: 1050;
}

.atlas-control.zoom-control {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
}

.atlas-control-button {
    background: none;
    border: none;
    width: 30px;
    height: 30px;
    line-height: 30px;
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    color: #333;
}

.atlas-control-button:hover {
    background: #f0f0f0;
}

.atlas-control.scale-control {
    background: rgba(255, 255, 255, 0.7);
    padding: 2px 5px;
    font-size: 11px;
    color: #333;
    border-radius: 3px;
}
`;

// Inject default styles
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
exports.EditableShape = EditableShape;
exports.Popup = Popup;
exports.Control = Control;
exports.Utils = Utils;
exports.EventEmitter = EventEmitter;
exports.i18n = i18n;

// Global export for backward compatibility
global.Atlas = exports;

}));
