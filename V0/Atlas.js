
/**
 * Atlas.js - A Lightweight JavaScript Mapping Library
 * Inspired by early Leaflet but built from scratch for modern browsers
 * Version 1.0.0
 */

(function(global) {
    'use strict';

    // Core Atlas namespace
    const Atlas = {};

    // Utility functions
    const Util = {
        extend: function(dest, ...sources) {
            sources.forEach(src => {
                for (let key in src) {
                    if (src.hasOwnProperty(key)) {
                        dest[key] = src[key];
                    }
                }
            });
            return dest;
        },

        bind: function(fn, obj) {
            return function(...args) {
                return fn.apply(obj, args);
            };
        },

        stamp: (function() {
            let lastId = 0;
            return function(obj) {
                obj._atlas_id = obj._atlas_id || ++lastId;
                return obj._atlas_id;
            };
        })(),

        requestAnimFrame: (function() {
            return window.requestAnimationFrame ||
                   window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame ||
                   function(callback) { window.setTimeout(callback, 1000/60); };
        })()
    };

    // Point class for coordinates
    class Point {
        constructor(x, y, round) {
            this.x = round ? Math.round(x) : x;
            this.y = round ? Math.round(y) : y;
        }

        clone() {
            return new Point(this.x, this.y);
        }

        add(point) {
            return this.clone()._add(point);
        }

        _add(point) {
            this.x += point.x;
            this.y += point.y;
            return this;
        }

        subtract(point) {
            return this.clone()._subtract(point);
        }

        _subtract(point) {
            this.x -= point.x;
            this.y -= point.y;
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
    }

    // LatLng class for geographic coordinates
    class LatLng {
        constructor(lat, lng) {
            this.lat = parseFloat(lat);
            this.lng = parseFloat(lng);
        }

        equals(obj) {
            return Math.abs(this.lat - obj.lat) <= 1e-9 && 
                   Math.abs(this.lng - obj.lng) <= 1e-9;
        }

        toString() {
            return `LatLng(${this.lat}, ${this.lng})`;
        }
    }

    // LatLngBounds class
    class LatLngBounds {
        constructor(southWest, northEast) {
            if (!southWest) return;
            
            const latlngs = northEast ? [southWest, northEast] : southWest;
            
            for (let i = 0, len = latlngs.length; i < len; i++) {
                this.extend(latlngs[i]);
            }
        }

        extend(obj) {
            if (!this._southWest && !this._northEast) {
                this._southWest = new LatLng(obj.lat, obj.lng);
                this._northEast = new LatLng(obj.lat, obj.lng);
            } else {
                this._southWest.lat = Math.min(obj.lat, this._southWest.lat);
                this._southWest.lng = Math.min(obj.lng, this._southWest.lng);
                this._northEast.lat = Math.max(obj.lat, this._northEast.lat);
                this._northEast.lng = Math.max(obj.lng, this._northEast.lng);
            }
            return this;
        }

        getCenter() {
            return new LatLng(
                (this._southWest.lat + this._northEast.lat) / 2,
                (this._southWest.lng + this._northEast.lng) / 2
            );
        }

        contains(obj) {
            const sw = this._southWest;
            const ne = this._northEast;
            return obj.lat >= sw.lat && obj.lat <= ne.lat &&
                   obj.lng >= sw.lng && obj.lng <= ne.lng;
        }
    }

    // Projection class (Spherical Mercator)
    const Projection = {
        SphericalMercator: {
            project: function(latlng) {
                const d = Math.PI / 180;
                const max = 85.0511287798;
                const lat = Math.max(Math.min(max, latlng.lat), -max);
                const x = latlng.lng * d;
                const y = Math.log(Math.tan((90 + lat) * d / 2)) / d;
                return new Point(x, y);
            },

            unproject: function(point) {
                const d = 180 / Math.PI;
                const lng = point.x * d;
                const lat = (2 * Math.atan(Math.exp(point.y / d)) - Math.PI / 2) * d;
                return new LatLng(lat, lng);
            }
        }
    };

    // CRS (Coordinate Reference System)
    const CRS = {
        EPSG3857: {
            code: 'EPSG:3857',
            projection: Projection.SphericalMercator,
            transformation: {
                _a: 0.5 / Math.PI,
                _b: 0.5,
                _c: -0.5 / Math.PI,
                _d: 0.5
            },

            project: function(latlng) {
                const projectedPoint = this.projection.project(latlng);
                return this.transform(projectedPoint, 1);
            },

            transform: function(point, scale) {
                const t = this.transformation;
                return new Point(
                    scale * (t._a * point.x + t._b),
                    scale * (t._c * point.y + t._d)
                );
            },

            latLngToPoint: function(latlng, zoom) {
                const projectedPoint = this.project(latlng);
                const scale = 256 * Math.pow(2, zoom);
                return projectedPoint.multiplyBy(scale);
            },

            pointToLatLng: function(point, zoom) {
                const scale = 256 * Math.pow(2, zoom);
                const untransformedPoint = point.clone().multiplyBy(1 / scale);
                return this.projection.unproject(untransformedPoint);
            }
        }
    };

    // Layer base class
    class Layer {
        constructor() {
            this._atlas_id = Util.stamp(this);
        }

        onAdd(map) {
            this._map = map;
        }

        onRemove(map) {
            delete this._map;
        }

        addTo(map) {
            map.addLayer(this);
            return this;
        }
    }

    // TileLayer class
    class TileLayer extends Layer {
        constructor(urlTemplate, options) {
            super();
            this._url = urlTemplate;
            this.options = Util.extend({
                tileSize: 256,
                opacity: 1,
                zIndex: 1,
                maxZoom: 18,
                minZoom: 0
            }, options);
            
            this._tiles = {};
            this._loading = false;
        }

        onAdd(map) {
            super.onAdd(map);
            this._container = document.createElement('div');
            this._container.className = 'atlas-tile-container';
            this._container.style.cssText = 'position: absolute; left: 0; top: 0; z-index: ' + this.options.zIndex;
            
            map.getPanes().tilePane.appendChild(this._container);
            
            this._resetView();
            this._update();
        }

        onRemove() {
            if (this._container && this._container.parentNode) {
                this._container.parentNode.removeChild(this._container);
            }
            super.onRemove();
        }

        _resetView() {
            this._tiles = {};
            this._container.innerHTML = '';
        }

        _update() {
            if (!this._map) return;

            const map = this._map;
            const zoom = map.getZoom();
            const center = map.getCenter();
            const pixelBounds = map.getPixelBounds();
            const tileSize = this.options.tileSize;

            if (zoom > this.options.maxZoom || zoom < this.options.minZoom) return;

            const tileBounds = {
                min: pixelBounds.min.clone().divideBy(tileSize).floor(),
                max: pixelBounds.max.clone().divideBy(tileSize).floor()
            };

            // Load tiles
            for (let j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
                for (let i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
                    const coords = new Point(i, j);
                    coords.z = zoom;

                    if (!this._isValidTile(coords)) continue;

                    const key = this._tileCoordsToKey(coords);
                    if (key in this._tiles) continue;

                    this._addTile(coords);
                }
            }
        }

        _isValidTile(coords) {
            const crs = this._map.options.crs;
            const bounds = crs.latLngToPoint(this._map.options.maxBounds?.getNorthEast?.() || new LatLng(85, 180), coords.z);
            return coords.x >= 0 && coords.y >= 0 && 
                   coords.x < Math.pow(2, coords.z) && coords.y < Math.pow(2, coords.z);
        }

        _addTile(coords) {
            const key = this._tileCoordsToKey(coords);
            const tile = document.createElement('img');
            
            tile.className = 'atlas-tile';
            tile.style.cssText = `
                position: absolute; 
                left: 0; 
                top: 0; 
                width: ${this.options.tileSize}px; 
                height: ${this.options.tileSize}px;
                opacity: ${this.options.opacity}
            `;

            this._tiles[key] = tile;
            this._loadTile(tile, coords);
        }

        _loadTile(tile, coords) {
            tile.onload = () => {
                this._tileOnLoad(tile, coords);
            };
            tile.onerror = () => {
                this._tileOnError(tile, coords);
            };

            tile.src = this._getTileUrl(coords);
            this._container.appendChild(tile);
        }

        _getTileUrl(coords) {
            return this._url
                .replace('{x}', coords.x)
                .replace('{y}', coords.y)
                .replace('{z}', coords.z);
        }

        _tileOnLoad(tile, coords) {
            const pos = this._getTilePos(coords);
            tile.style.left = pos.x + 'px';
            tile.style.top = pos.y + 'px';
        }

        _tileOnError(tile, coords) {
            tile.style.display = 'none';
        }

        _getTilePos(coords) {
            const map = this._map;
            const origin = map._getTopLeftPoint();
            return new Point(
                coords.x * this.options.tileSize - origin.x,
                coords.y * this.options.tileSize - origin.y
            );
        }

        _tileCoordsToKey(coords) {
            return coords.x + ':' + coords.y + ':' + coords.z;
        }
    }

    // Marker class
    class Marker extends Layer {
        constructor(latlng, options) {
            super();
            this._latlng = latlng;
            this.options = Util.extend({
                icon: null,
                opacity: 1,
                title: '',
                zIndex: 1
            }, options);
        }

        onAdd(map) {
            super.onAdd(map);
            
            this._icon = document.createElement('div');
            this._icon.className = 'atlas-marker';
            this._icon.style.cssText = `
                position: absolute;
                width: 25px;
                height: 41px;
                background: #3388ff;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                margin-left: -12px;
                margin-top: -41px;
                z-index: ${this.options.zIndex};
                opacity: ${this.options.opacity}
            `;

            // Add white dot in center
            const dot = document.createElement('div');
            dot.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: white;
                border-radius: 50%;
                top: 6px;
                left: 6px;
                transform: rotate(45deg);
            `;
            this._icon.appendChild(dot);

            if (this.options.title) {
                this._icon.title = this.options.title;
            }

            map.getPanes().markerPane.appendChild(this._icon);
            this._updatePosition();
        }

        onRemove() {
            if (this._icon && this._icon.parentNode) {
                this._icon.parentNode.removeChild(this._icon);
            }
            super.onRemove();
        }

        getLatLng() {
            return this._latlng;
        }

        setLatLng(latlng) {
            this._latlng = latlng;
            if (this._map) {
                this._updatePosition();
            }
            return this;
        }

        _updatePosition() {
            const pos = this._map.latLngToContainerPoint(this._latlng);
            this._icon.style.left = pos.x + 'px';
            this._icon.style.top = pos.y + 'px';
        }
    }

    // Main Map class
    class Map {
        constructor(id, options) {
            this._container = typeof id === 'string' ? document.getElementById(id) : id;
            this.options = Util.extend({
                center: [0, 0],
                zoom: 0,
                minZoom: 0,
                maxZoom: 18,
                crs: CRS.EPSG3857,
                zoomControl: true,
                attributionControl: true
            }, options);

            this._layers = {};
            this._panes = {};
            this._size = new Point(0, 0);
            this._zoom = this.options.zoom;
            this._center = new LatLng(this.options.center[0], this.options.center[1]);

            this._initContainer();
            this._initPanes();
            this._initControls();
            this._resetView();
        }

        _initContainer() {
            const container = this._container;
            
            if (!container) {
                throw new Error('Map container not found');
            }

            container.className = 'atlas-container';
            container.style.cssText = 'position: relative; overflow: hidden; width: 100%; height: 100%';

            this._size = new Point(container.clientWidth, container.clientHeight);

            // Add basic mouse interaction
            container.addEventListener('mousedown', this._onMouseDown.bind(this));
            container.addEventListener('wheel', this._onMouseWheel.bind(this));
        }

        _initPanes() {
            this._panes.mapPane = this._createPane('atlas-map-pane', this._container);
            this._panes.tilePane = this._createPane('atlas-tile-pane', this._panes.mapPane);
            this._panes.markerPane = this._createPane('atlas-marker-pane', this._panes.mapPane);
            this._panes.popupPane = this._createPane('atlas-popup-pane', this._panes.mapPane);
        }

        _createPane(className, parent) {
            const pane = document.createElement('div');
            pane.className = className;
            pane.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%';
            parent.appendChild(pane);
            return pane;
        }

        _initControls() {
            if (this.options.zoomControl) {
                const zoomControl = document.createElement('div');
                zoomControl.className = 'atlas-control-zoom';
                zoomControl.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 1000;
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                `;

                const zoomIn = document.createElement('button');
                zoomIn.innerHTML = '+';
                zoomIn.style.cssText = 'display: block; width: 30px; height: 30px; border: none; background: white; cursor: pointer; font-weight: bold; font-size: 16px;';
                zoomIn.onclick = () => this.zoomIn();

                const zoomOut = document.createElement('button');
                zoomOut.innerHTML = '−';
                zoomOut.style.cssText = 'display: block; width: 30px; height: 30px; border: none; border-top: 1px solid #ccc; background: white; cursor: pointer; font-weight: bold; font-size: 16px;';
                zoomOut.onclick = () => this.zoomOut();

                zoomControl.appendChild(zoomIn);
                zoomControl.appendChild(zoomOut);
                this._container.appendChild(zoomControl);
            }
        }

        _resetView() {
            this._updateMapPosition();
            this._updateLayers();
        }

        _updateMapPosition() {
            const center = this.options.crs.latLngToPoint(this._center, this._zoom);
            const size = this._size;
            const topLeft = center.subtract(size.divideBy(2));
            
            this._panes.mapPane.style.left = -topLeft.x + 'px';
            this._panes.mapPane.style.top = -topLeft.y + 'px';
        }

        _updateLayers() {
            for (let id in this._layers) {
                const layer = this._layers[id];
                if (layer._update) {
                    layer._update();
                }
                if (layer._updatePosition) {
                    layer._updatePosition();
                }
            }
        }

        _onMouseDown(e) {
            let moving = false;
            const startX = e.clientX;
            const startY = e.clientY;
            const startCenter = this._center;

            const onMouseMove = (e) => {
                if (!moving) {
                    moving = true;
                    this._container.style.cursor = 'move';
                }

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                const point = this.options.crs.latLngToPoint(startCenter, this._zoom);
                const newPoint = new Point(point.x - deltaX, point.y - deltaY);
                const newCenter = this.options.crs.pointToLatLng(newPoint, this._zoom);
                
                this.setView(newCenter, this._zoom);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this._container.style.cursor = '';
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }

        _onMouseWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -1 : 1;
            this.setZoom(this._zoom + delta);
        }

        // Public API methods
        addLayer(layer) {
            const id = Util.stamp(layer);
            this._layers[id] = layer;
            layer.onAdd(this);
            return this;
        }

        removeLayer(layer) {
            const id = Util.stamp(layer);
            if (this._layers[id]) {
                layer.onRemove(this);
                delete this._layers[id];
            }
            return this;
        }

        setView(center, zoom) {
            this._center = center instanceof LatLng ? center : new LatLng(center[0], center[1]);
            this._zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom));
            this._resetView();
            return this;
        }

        setZoom(zoom) {
            return this.setView(this._center, zoom);
        }

        zoomIn() {
            return this.setZoom(this._zoom + 1);
        }

        zoomOut() {
            return this.setZoom(this._zoom - 1);
        }

        getCenter() {
            return this._center;
        }

        getZoom() {
            return this._zoom;
        }

        getSize() {
            return this._size.clone();
        }

        getPanes() {
            return this._panes;
        }

        getPixelBounds() {
            const center = this.options.crs.latLngToPoint(this._center, this._zoom);
            const halfSize = this._size.divideBy(2);
            return {
                min: center.subtract(halfSize),
                max: center.add(halfSize)
            };
        }

        _getTopLeftPoint() {
            const center = this.options.crs.latLngToPoint(this._center, this._zoom);
            const halfSize = this._size.divideBy(2);
            return center.subtract(halfSize);
        }

        latLngToContainerPoint(latlng) {
            const projectedPoint = this.options.crs.latLngToPoint(latlng, this._zoom);
            const topLeft = this._getTopLeftPoint();
            return projectedPoint.subtract(topLeft);
        }

        containerPointToLatLng(point) {
            const topLeft = this._getTopLeftPoint();
            const projectedPoint = point.add(topLeft);
            return this.options.crs.pointToLatLng(projectedPoint, this._zoom);
        }
    }

    // Extend Point prototype for division
    Point.prototype.divideBy = function(num) {
        return this.clone()._divideBy(num);
    };

    Point.prototype._divideBy = function(num) {
        this.x /= num;
        this.y /= num;
        return this;
    };

    Point.prototype.floor = function() {
        return this.clone()._floor();
    };

    Point.prototype._floor = function() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    };

    // Factory functions
    Atlas.map = function(id, options) {
        return new Map(id, options);
    };

    Atlas.tileLayer = function(urlTemplate, options) {
        return new TileLayer(urlTemplate, options);
    };

    Atlas.marker = function(latlng, options) {
        return new Marker(latlng, options);
    };

    Atlas.latLng = function(lat, lng) {
        return new LatLng(lat, lng);
    };

    Atlas.point = function(x, y, round) {
        return new Point(x, y, round);
    };

    // Export Atlas
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Atlas;
    } else if (typeof define === 'function' && define.amd) {
        define([], function() { return Atlas; });
    } else {
        global.Atlas = Atlas;
    }

})(typeof window !== 'undefined' ? window : this);
