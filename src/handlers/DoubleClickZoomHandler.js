import { Handler } from './Handler.js';
import { TAP_ZOOM_DURATION } from '../utils/constants.js';

// Double click zoom handler
export class DoubleClickZoomHandler extends Handler {
  constructor(map) { super(map); this._lastClickTime = 0; this._lastClickPos = { x: 0, y: 0 }; }
  _addEvents() { this._addDomListener(this._map.canvas, 'dblclick', this._onDoubleClick = this._onDoubleClick.bind(this), { passive: false }); }
  _removeEvents() { this._removeAllDomListeners(); }
  _onDoubleClick(e) { e.preventDefault(); const rect = this._map.canvas.getBoundingClientRect(); this._map.animateZoomRotateAbout(e.clientX - rect.left, e.clientY - rect.top, this._map.getZoom() + 1, this._map.getBearing(), TAP_ZOOM_DURATION); }
}