import { Control } from './Control.js';
import { TileLayer } from '../layers/TileLayer.js';
import { LAYERS } from '../utils/constants.js';

// Layer toggle control
export class LayerControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, title: options.title || 'Toggle layer' }; }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-layer-control';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'control-btn';
    toggleBtn.title = this.options.title;
    toggleBtn.setAttribute('aria-label', this.options.title);
    toggleBtn.textContent = '🌐';
    toggleBtn.tabIndex = 0;
    const handler = () => {
      if (this._map) {
        const current = this._map.getBaseLayer();
        let newLayerKey;
        if (!current || (current.urlTemplate && current.urlTemplate.includes('openstreetmap'))) newLayerKey = 'ESRI';
        else if (current.urlTemplate && current.urlTemplate.includes('World_Imagery')) newLayerKey = 'ESRI_TOPO';
        else newLayerKey = 'OSM';
        const layerConfig = LAYERS[newLayerKey];
        if (layerConfig) {
          const urlTemplate = layerConfig.tileServers[0];
          const newLayer = new TileLayer(urlTemplate, {
            minZoom: layerConfig.minZoom,
            maxZoom: layerConfig.maxZoom,
            attribution: layerConfig.attribution,
            background: layerConfig.background,
            supportsRetina: layerConfig.supportsRetina,
            maxCacheSize: layerConfig.maxCacheSize
          });
          this._map.setBaseLayer(newLayer);
        }
      }
    };
    toggleBtn.addEventListener('click', handler);
    toggleBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    container.appendChild(toggleBtn);
    this._toggleBtn = toggleBtn;
    this._addDomListener(toggleBtn, 'click', handler);
    return container;
  }
  onRemove() {}
}