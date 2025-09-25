import { Control } from './Control.js';

// Fullscreen control
export class FullscreenControl extends Control {
  constructor(options = {}) { super(options); this.options = { ...this.options, title: options.title || 'Toggle fullscreen' }; }
  _requestFullscreen(elem) {
    if (elem.requestFullscreen) return elem.requestFullscreen();
    if (elem.webkitRequestFullscreen) return elem.webkitRequestFullscreen();
    if (elem.msRequestFullscreen) return elem.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen not supported'));
  }
  _exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.reject(new Error('Fullscreen not supported'));
  }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-fullscreen-control';
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'control-btn';
    fullscreenBtn.title = this.options.title;
    fullscreenBtn.setAttribute('aria-label', this.options.title);
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.tabIndex = 0;
    const handler = async () => {
      try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
          await this._requestFullscreen(this._map.container);
        } else {
          await this._exitFullscreen();
        }
      } catch (err) {}
    };
    fullscreenBtn.addEventListener('click', handler);
    fullscreenBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    container.appendChild(fullscreenBtn);
    this._fullscreenBtn = fullscreenBtn;
    this._addDomListener(fullscreenBtn, 'click', handler);
    return container;
  }
  onRemove() {}
}