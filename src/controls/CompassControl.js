import { Control } from './Control.js';
import { SNAP_DURATION, RAD2DEG } from '../utils/constants.js';

// Compass control
export class CompassControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, title: options.title || 'Reset North' }; }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-compass-control';
    const compassBtn = document.createElement('button');
    compassBtn.id = 'compass';
    compassBtn.className = 'control-btn';
    compassBtn.title = this.options.title;
    compassBtn.setAttribute('aria-label', this.options.title);
    compassBtn.textContent = 'N';
    compassBtn.style.display = 'none';
    compassBtn.tabIndex = 0;
    const handler = () => {
      if (this._map) {
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION);
      }
    };
    compassBtn.addEventListener('click', handler);
    compassBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    container.appendChild(compassBtn);
    this._compassBtn = compassBtn;
    this._addDomListener(compassBtn, 'click', handler);
    return container;
  }
  onRemove() {}
  _update() {
    if (!this._compassBtn || !this._map) return;
    const visible = Math.abs(this._map.getBearing()) > 0.001;
    this._compassBtn.style.display = visible ? "block" : "none";
    this._compassBtn.style.transform = `rotate(${-this._map.getBearing() * RAD2DEG}deg)`;
  }
}