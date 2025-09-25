import { Control } from './Control.js';
import { GISUtils } from '../utils/gis.js';

// Scale control
export class ScaleControl extends Control {
  constructor(options = {}) {
    super(options);
    this.options = { ...this.options, position: 'bottom-left' };
  }

  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-scale-control';
    container.style.cssText = 'background: rgba(255, 255, 255, 0.7); font-size: 10px; border: 2px solid white; border-top: none; padding: 2px 5px;';
    this._container = container;
    this._map.on('move', this._update, this);
    this._update();
    return container;
  }

  onRemove() {
    this._map.off('move', this._update, this);
  }

  _update() {
    const center = this._map.getCenter();
    const zoom = this._map.getZoom();
    const resolution = GISUtils.getResolution(center.lat, zoom);
    const maxWidth = 100;
    const distance = this._getRoundDistance(maxWidth * resolution);
    const width = distance / resolution;
    this._container.style.width = width + 'px';
    this._container.innerHTML = GISUtils.formatDistance(distance);
  }

  _getRoundDistance(meters) {
    const pow10 = Math.pow(10, (Math.floor(meters) + '').length - 1);
    let d = meters / pow10;
    d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
    return pow10 * d;
  }
}