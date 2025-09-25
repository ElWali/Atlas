import { Control } from './Control.js';
import { TileLayer } from '../layers/TileLayer.js';

// Attribution control (no duplicate id)
export class AttributionControl extends Control {
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