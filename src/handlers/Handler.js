// Handler base class with DOM listener tracking
export class Handler {
  constructor(map) { this._map = map; this._enabled = false; this._eventListeners = {}; this._domListeners = []; }
  enable() { if (this._enabled) return this; this._enabled = true; this._addEvents(); return this; }
  disable() { if (!this._enabled) return this; this._enabled = false; this._removeEvents(); return this; }
  toggle() { return this._enabled ? this.disable() : this.enable(); }
  isEnabled() { return this._enabled; }
  _addEvents() {}
  _removeEvents() {}
  destroy() { this.disable(); this._eventListeners = {}; this._removeAllDomListeners(); }
  // DOM helper
  _addDomListener(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._domListeners.push({ el, type, handler, options });
  }
  _removeAllDomListeners() {
    for (const rec of this._domListeners) {
      try { rec.el.removeEventListener(rec.type, rec.handler, rec.options); } catch (e) {}
    }
    this._domListeners.length = 0;
  }
}