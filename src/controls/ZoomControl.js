import { Control } from './Control.js';

// Zoom control
export class ZoomControl extends Control {
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