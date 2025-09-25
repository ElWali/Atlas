import { Handler } from './Handler.js';
import { WHEEL_ZOOM_STEP } from '../utils/constants.js';

// Scroll zoom handler
export class ScrollZoomHandler extends Handler {
  constructor(map) { super(map); }
  _addEvents() { this._addDomListener(this._map.canvas, 'wheel', this._onWheel = this._onWheel.bind(this), { passive: false }); }
  _removeEvents() { this._removeAllDomListeners(); }
  _onWheel(e) { e.preventDefault(); const dz = (e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP); this._map.smoothZoomAt(e.clientX, e.clientY, dz); }
}