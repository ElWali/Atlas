/*!
 * Atlas.js ElWali.1 — Advanced Modular Mapping Engine
 * Author: ElWali ElAlaoui (Atlasian from Tarfaya)
 * License: MIT
 */

(function (global) {
    'use strict';

    /**
     * Core Utility Functions
     * @module utils
     */
    const Utils = {
        extend: Object.assign,
        createElement(tag, className, container, options = {}) {
            const el = document.createElement(tag);
            if (className) el.className = className;
            if (options.attributes) Object.assign(el, options.attributes);
            if (options.events) Object.assign(el, options.events);
            if (container) container.appendChild(el);
            return el;
        }
    };

    /**
     * Event System Foundation
     * @module events
     */
    class EventEmitter {
        constructor() {
            this._listeners = new Map();
        }

        on(event, listener) {
            if (!this._listeners.has(event)) {
                this._listeners.set(event, []);
            }
            this._listeners.get(event).push(listener);
        }

        off(event, listener) {
            if (this._listeners.has(event)) {
                this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
            }
        }

        fire(event, data) {
            if (this._listeners.has(event)) {
                this._listeners.get(event).forEach(listener => listener(data));
            }
        }
    }

    /**
     * Core Map Engine
     * @module map
     */
    class AtlasMap extends EventEmitter {
        constructor(containerId, options = {}) {
            super();
            const container = document.getElementById(containerId);
            if (!container) throw new Error(`Container '${containerId}' not found`);
            
            this.container = container;
            this.options = Object.assign({
                center: [0, 0],
                zoom: 2,
                minZoom: 0,
                maxZoom: 20,
                enableControls: true
            }, options);

            this._initStructure();
            this._initControls();
            this.setView(this.options.center, this.options.zoom);
        }

        _initStructure() {
            this.container.className = 'atlas-map';
            this._tileContainer = Utils.createElement('div', 'atlas-tile-container', this.container);
            this._controlContainer = Utils.createElement('div', 'atlas-controls', this.container);
        }

        _initControls() {
            if (this.options.enableControls) {
                this.zoomControl = new Atlas.Control.Zoom();
                this.zoomControl.addTo(this);
            }
        }

        setView(center, zoom) {
            if (!Array.isArray(center) || center.length !== 2) {
                throw new Error('Invalid coordinates');
            }

            this.center = center;
            this.zoom = Math.min(
                Math.max(zoom, this.options.minZoom),
                this.options.maxZoom
            );
            
            this._render();
            this.fire('viewchange', { center, zoom: this.zoom });
        }

        _render() {
            this._tileContainer.innerHTML = `
                <div class="atlas-tile-placeholder">
                    Zoom Level: ${this.zoom}
                </div>
            `;
        }
    }

    /**
     * Tile Layer System
     * @module tilelayer
     */
    class TileLayer {
        constructor(urlTemplate, options = {}) {
            this.urlTemplate = urlTemplate;
            this.options = Object.assign({
                attribution: '',
                minZoom: 0,
                maxZoom: 20
            }, options);
        }

        addTo(map) {
            if (map.zoom > this.options.maxZoom || map.zoom < this.options.minZoom) {
                console.warn('Zoom level outside tile layer range');
                return;
            }

            const attribution = Utils.createElement('div', 'atlas-attribution', map.container, {
                attributes: { title: this.options.attribution }
            });
            attribution.textContent = this.options.attribution;
            
            map.on('viewchange', (data) => this._updateTiles(map, data));
        }

        _updateTiles(map, data) {
            // Tile update logic placeholder
            console.log('Updating tiles at', data);
        }
    }

    /**
     * Control Components
     * @module controls
     */
    const Control = {
        Zoom: class {
            constructor(options = {}) {
                this.options = Object.assign({
                    position: 'top-left'
                }, options);
            }

            addTo(map) {
                const controlDiv = Utils.createElement('div', 
                    `atlas-control zoom-control ${this.options.position}`, 
                    map._controlContainer
                );

                const createButton = (label, action) => {
                    return Utils.createElement('button', 'atlas-control-button', controlDiv, {
                        events: {
                            click: action
                        }
                    });
                };

                const zoomIn = createButton('+', () => map.setView(map.center, map.zoom + 1));
                const zoomOut = createButton('-', () => map.setView(map.center, map.zoom - 1));
                
                zoomIn.textContent = '+';
                zoomOut.textContent = '-';
            }
        }
    };

    // Export Public API
    global.Atlas = {
        Map: AtlasMap,
        TileLayer: TileLayer,
        Control: Control
    };

})(this);
