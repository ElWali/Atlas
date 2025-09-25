import { Tooltip } from '../core/Tooltip.js';

// Base Layer class
export class Layer {
  constructor(options = {}) { this.options = options; this._map = null; this._events = {}; this._domListeners = []; }
  addTo(map) { if (this._map) this._map.removeLayer(this); this._map = map; map.addLayer(this); return this; }
  remove() { if (this._map) { this._map.removeLayer(this); this._map = null; } return this; }
  on(type, fn) { if (!this._events[type]) this._events[type] = []; this._events[type].push(fn); return this; }
  off(type, fn) { if (!this._events[type]) return this; this._events[type] = this._events[type].filter(cb => cb !== fn); return this; }
  fire(type, data = {}) { if (!this._events[type]) return; data.type = type; data.target = this; this._events[type].forEach(fn => fn(data)); }
  onAdd() {}
  onRemove() {}
  render() {}
  // DOM listener helpers (store added listeners so we can remove them reliably)
  addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
    return this._domListeners[this._domListeners.length - 1];
  }
  removeDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (err) {}
    }
    this._domListeners.length = 0;
  }

  bindTooltip(content, options) {
    if (this._tooltip) {
      this.unbindTooltip();
    }
    this._tooltip = new Tooltip(options, this);
    this._tooltip.setContent(content);
    this.on('remove', this.unbindTooltip, this);
    return this;
  }

  unbindTooltip() {
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
      this.off('remove', this.unbindTooltip, this);
    }
    return this;
  }
}