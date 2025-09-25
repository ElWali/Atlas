// Control base (with DOM listener helpers)
export class Control {
  constructor(options = {}) { this.options = { position: options.position || 'top-left' }; this._map = null; this._container = null; this._events = {}; this._domListeners = []; }
  on(type, fn) { if (!this._events[type]) this._events[type] = []; this._events[type].push(fn); return this; }
  off(type, fn) { if (!this._events[type]) return this; this._events[type] = this._events[type].filter(cb => cb !== fn); return this; }
  fire(type, data = {}) { if (!this._events[type]) return; data.type = type; data.target = this; this._events[type].forEach(fn => fn(data)); }
  onAdd() { return document.createElement('div'); }
  onRemove() {}
  addTo(map) { this.remove(); this._map = map; this._container = this.onAdd(); this._container.controlInstance = this; this._addToContainer(); return this; }
  remove() { if (!this._map) return this; this.onRemove(); if (this._container && this._container.parentNode) this._container.parentNode.removeChild(this._container); this._removeDomListeners(); this._map = null; this._container = null; return this; }
  getContainer() { return this._container; }
  _addToContainer() {
    if (!this._map || !this._container) return;
    const position = this.options.position;
    let container = this._map._controlCorners[position];
    if (!container) {
      container = document.createElement('div');
      container.className = `atlas-control-container atlas-control-${position}`;
      if (position.includes('top') || position.includes('bottom')) container.classList.add('atlas-control-vertical');
      this._map.container.appendChild(container);
      this._map._controlCorners[position] = container;
    }
    container.appendChild(this._container);
  }
  // dom listener helpers
  _addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
  }
  _removeDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (e) {}
    }
    this._domListeners.length = 0;
  }
}