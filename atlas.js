/*!
 * Atlas.js v3.0 — A professional-grade, modern JavaScript mapping library.
 * Author: ElWali ElAlaoui (Atlasian from Tarfaya 🇲🇦)
 *
 * This version achieves core feature parity with established libraries like Atlas.
 * It introduces a robust architecture with layer groups, a powerful GeoJSON parser,
 * vector layer primitives, and a fully-featured layers control.
 * It combines the fluid user experience of v2.0 with the versatility and
 * developer ergonomics required for complex applications.
 *
 * License: MIT
 */
(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Atlas = {}));
})(this, (function(exports) { 'use strict';

    // ... (Utils, EventEmitter, and other core helpers from v2.0 are here) ...
    // NOTE: For brevity, only new or significantly changed classes will be shown in full.
    // The previous implementation's classes like Marker, Icon, TileLayer, Popup, and the
    // interaction handlers (Drag, ScrollZoom, etc.) are assumed to be included here, unchanged.
    
    /*** LatLngBounds: Represents a rectangular geographical area. ***/
    class LatLngBounds {
        constructor(corner1, corner2) {
            if (corner1) {
                this._min = { lat: Math.min(corner1.lat, corner2.lat), lng: Math.min(corner1.lng, corner2.lng) };
                this._max = { lat: Math.max(corner1.lat, corner2.lat), lng: Math.max(corner1.lng, corner2.lng) };
            }
        }
        
        extend(latlng) {
            if (!this._min) {
                this._min = { lat: latlng.lat, lng: latlng.lng };
                this._max = { lat: latlng.lat, lng: latlng.lng };
            } else {
                this._min.lat = Math.min(latlng.lat, this._min.lat);
                this._min.lng = Math.min(latlng.lng, this._min.lng);
                this._max.lat = Math.max(latlng.lat, this._max.lat);
                this._max.lng = Math.max(latlng.lng, this._max.lng);
            }
            return this;
        }

        getCenter() {
            return {
                lat: (this._min.lat + this._max.lat) / 2,
                lng: (this._min.lng + this._max.lng) / 2
            };
        }

        getSouthWest() { return { lat: this._min.lat, lng: this._min.lng }; }
        getNorthEast() { return { lat: this._max.lat, lng: this._max.lng }; }
        
        // Converts to the [[lat, lng], [lat, lng]] array format expected by map.fitBounds
        toArray() {
            return [[this._min.lat, this._min.lng], [this._max.lat, this._max.lng]];
        }
    }
    
    /*** LayerGroup: Manages a collection of layers. ***/
    class LayerGroup extends Layer {
        constructor(layers = []) {
            super();
            this._layers = new Set(layers);
        }

        onAdd(map) {
            super.onAdd(map);
            this._layers.forEach(layer => map.addLayer(layer));
        }

        onRemove() {
            this._layers.forEach(layer => this._map.removeLayer(layer));
            super.onRemove();
        }

        addLayer(layer) {
            this._layers.add(layer);
            if (this._map) this._map.addLayer(layer);
            return this;
        }
        
        removeLayer(layer) {
            this._layers.delete(layer);
            if (this._map) this._map.removeLayer(layer);
            return this;
        }
        
        clearLayers() {
            this._layers.forEach(layer => this.removeLayer(layer));
            return this;
        }
    }

    /*** FeatureGroup: Extends LayerGroup with events and bounds. ***/
    class FeatureGroup extends LayerGroup {
        addLayer(layer) {
            super.addLayer(layer);
            if (layer.on) { // Propagate events
                layer.on('click dblclick mousedown mouseup', (e) => this.fire(e.type, e));
            }
            return this;
        }

        getBounds() {
            const bounds = new LatLngBounds();
            this._layers.forEach(layer => {
                if (layer.getBounds) {
                    bounds.extend(layer.getBounds().getSouthWest());
                    bounds.extend(layer.getBounds().getNorthEast());
                } else if (layer.getLatLng) {
                    bounds.extend(layer.getLatLng());
                }
            });
            return bounds;
        }
    }

    /*** Path: Refactored base class for all vector layers. ***/
    // It now appends to a shared SVG pane on the map instead of creating its own.
    class Path extends Layer {
        // ... (constructor and options setup from v2.0) ...
        onAdd(map) {
            super.onAdd(map);
            this._renderer = map.getRenderer();
            this._initElement();
            this._renderer.addPath(this);
            this._project();
        }
        onRemove() {
            this._renderer.removePath(this);
            super.onRemove();
        }
        _initElement() {
            this._path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            // ... (apply styles from this.options) ...
        }
        // _project() method specific to each subclass (Polyline, Polygon, etc.)
    }
    
    /*** CircleMarker: A circle with a radius in pixels. ***/
    class CircleMarker extends Path {
        constructor(latlng, options) {
            super(options);
            this._latlng = latlng;
            this.options.radius = this.options.radius || 10;
        }

        _initElement() {
            this._path = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            this._path.setAttribute('r', this.options.radius);
            // ... (apply styles) ...
        }

        _project() {
            const p = this._map.latLngToLayerPoint(this._latlng);
            this._path.setAttribute('cx', p.x);
            this._path.setAttribute('cy', p.y);
        }
        
        getBounds() {
            // Simplified for this example. A real implementation would convert pixel radius to lat/lng.
            return new LatLngBounds(this._latlng, this._latlng);
        }
    }
    
    /*** SvgRenderer: Manages the shared SVG pane for vector layers. ***/
    class SvgRenderer extends Layer {
        onAdd(map) {
            super.onAdd(map);
            this._container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            map.getPane('overlayPane').appendChild(this._container);
            map.on('viewchange', this._update, this);
            this._update();
        }
        addPath(layer) {
            this._container.appendChild(layer._path);
        }
        removePath(layer) {
            layer._path.remove();
        }
        _update() {
            // ... (update SVG position and size to match map pane, as in v2.0 Path) ...
        }
    }
    
    /*** GeoJSONLayer: Powerful GeoJSON parser and layer factory. ***/
    class GeoJSONLayer extends FeatureGroup {
        constructor(geojson, options) {
            super();
            this.options = Utils.extend({
                pointToLayer: (feature, latlng) => new Marker(latlng),
                style: (feature) => ({}), // Default style function
                onEachFeature: (feature, layer) => {}
            }, options);
            if (geojson) this.addData(geojson);
        }

        addData(geojson) {
            const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
            features.forEach(feature => {
                this.geometryToLayer(feature);
            });
            return this;
        }

        geometryToLayer(feature) {
            const { geometry } = feature;
            if (!geometry) return;
            
            const coords = geometry.coordinates;
            let layer;
            
            switch (geometry.type) {
                case 'Point':
                    layer = this.options.pointToLayer(feature, {lat: coords[1], lng: coords[0]});
                    break;
                case 'LineString':
                    layer = new Polyline(coords.map(c => ({lat: c[1], lng: c[0]})));
                    break;
                case 'Polygon':
                    layer = new Polygon(coords[0].map(c => ({lat: c[1], lng: c[0]})));
                    break;
                // Note: Multi* and GeometryCollection would need more complex loops here.
                default:
                    return; // Ignore unsupported types
            }
            
            // Apply styling
            if (layer.setStyle) {
                layer.setStyle(this.options.style(feature));
            }
            
            // Run the callback
            this.options.onEachFeature(feature, layer);
            
            this.addLayer(layer);
        }
    }
    
    /*** Control.Layers: UI for toggling base layers and overlays. ***/
    Control.Layers = class extends Control {
        constructor(baseLayers, overlays, options) {
            super(options);
            this._baseLayers = baseLayers;
            this._overlays = overlays;
        }

        onAdd(map) {
            this._container = Utils.createElement('div', 'atlas-control atlas-layers', this._map._controlContainer);
            this._container.innerHTML = `<a class="atlas-layers-toggle" href="#" title="Layers"></a>`;
            this._form = Utils.createElement('form', 'atlas-layers-list', this._container);

            this._container.querySelector('.atlas-layers-toggle').addEventListener('click', (e) => {
                e.preventDefault();
                this._container.classList.toggle('expanded');
            });
            
            this._addLayers(this._baseLayers, false);
            this._addLayers(this._overlays, true);
            
            // Initial state
            for (const name in this._baseLayers) {
                if (this._map.hasLayer(this._baseLayers[name])) {
                    this._inputs.find(i => i.layer === this._baseLayers[name]).checked = true;
                    break;
                }
            }
            return this._container;
        }
        
        _addLayers(layers, isOverlay) {
            this._inputs = this._inputs || [];
            for (const name in layers) {
                const layer = layers[name];
                const input = document.createElement('input');
                input.type = isOverlay ? 'checkbox' : 'radio';
                input.name = isOverlay ? 'overlay' : 'base';
                input.checked = this._map.hasLayer(layer);
                input.layer = layer;
                
                input.addEventListener('change', () => this._onInputChange(input, isOverlay));
                
                const label = document.createElement('label');
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${name}`));
                this._form.appendChild(label);
                this._inputs.push(input);
            }
        }
        
        _onInputChange(input, isOverlay) {
            if (isOverlay) {
                if (input.checked) this._map.addLayer(input.layer);
                else this._map.removeLayer(input.layer);
            } else {
                // Remove all other base layers
                this._inputs.filter(i => i.name === 'base' && i !== input).forEach(i => {
                    if (this._map.hasLayer(i.layer)) this._map.removeLayer(i.layer);
                });
                this._map.addLayer(input.layer);
            }
        }
    };
    
    /*** AtlasMap: Updated to integrate the new components. ***/
    class AtlasMap extends EventEmitter {
        constructor(containerId, options = {}) {
            // ... (super, container, options setup) ...
            this._layers = new Set();
            // ... (other initializations) ...
            this._initStructure(); // Creates panes
            
            this._renderer = new SvgRenderer();
            this.addLayer(this._renderer);
            
            // ... (add handlers, controls, setView, etc.) ...
        }
        
        getRenderer() {
            return this._renderer;
        }

        hasLayer(layer) {
            return this._layers.has(layer);
        }

        fitBounds(bounds, options = {}) {
            // The logic from v2.0 is perfect, but now it can accept a LatLngBounds object directly.
            if (bounds instanceof LatLngBounds) {
                bounds = bounds.toArray();
            }
            // ... (rest of the fitBounds implementation) ...
        }
        
        // ... (rest of the extensive AtlasMap class from v2.0) ...
    }
    
    // --- New/Updated CSS for Controls ---
    const newCSS = `
    .atlas-control.atlas-layers {
        box-shadow: 0 1px 5px rgba(0,0,0,0.4); border-radius: 4px; background: #fff;
    }
    .atlas-layers-toggle {
        width: 30px; height: 30px; display: block;
        background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%202L2%207l10%205%2010-5-10-5zM2%2017l10%205%2010-5-10-5-10%205zM2%2012l10%205%2010-5-10-5-10%205z%22%2F%3E%3C%2Fsvg%3E');
        background-repeat: no-repeat; background-position: center; background-size: 20px;
    }
    .atlas-layers-list {
        display: none; padding: 6px 10px;
    }
    .atlas-layers.expanded .atlas-layers-list {
        display: block;
    }
    .atlas-layers-list label {
        display: block; font-size: 13px;
    }
    `;
    
    // ... (logic to append newCSS to defaultCSS, inject, and export all classes) ...
    
    // --- Final Exports ---
    exports.Map = AtlasMap;
    exports.Layer = Layer;
    exports.LayerGroup = LayerGroup;
    exports.FeatureGroup = FeatureGroup;
    exports.GeoJSONLayer = GeoJSONLayer;
    exports.TileLayer = TileLayer;
    exports.Marker = Marker;
    exports.Icon = Icon;
    exports.Popup = Popup;
    exports.Path = Path;
    exports.Polyline = Polyline;
    exports.Polygon = Polygon;
    exports.Circle = Circle;
    exports.CircleMarker = CircleMarker;
    exports.Control = Control;
    exports.LatLngBounds = LatLngBounds;
    // ... and so on for all exported classes.
    
    global.Atlas = exports;
}));
