import { Handler } from './Handler.js';
import { GISUtils } from '../utils/gis.js';
import { EASING } from '../utils/constants.js';

// Area selection / zoom (Shift + drag)
export class AreaZoomHandler extends Handler {
  constructor(map) { super(map); this._isSelecting = false; this._startPoint = null; this._endPoint = null; this._selectionRect = null; this._pointerId = null; }
  _addEvents() { this._addDomListener(this._map.canvas, 'pointerdown', this._onPointerDown = this._onPointerDown.bind(this), { passive: false }); }
  _removeEvents() { this._removeAllDomListeners(); this._clearSelection(); }
  _onPointerDown(e) {
    if (!e.shiftKey) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this._pointerId = e.pointerId;
    const rect = this._map.canvas.getBoundingClientRect();
    this._startDrag(e.clientX - rect.left, e.clientY - rect.top);
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    const onMove = (ev) => {
      if (ev.pointerId !== this._pointerId) return;
      ev.preventDefault();
      this._updateSelection(ev.clientX - rect.left, ev.clientY - rect.top);
    };
    const onUp = (ev) => {
      if (ev.pointerId !== this._pointerId) return;
      try { ev.target.releasePointerCapture(ev.pointerId); } catch (err) {}
      ev.preventDefault();
      this._endDrag(ev.clientX - rect.left, ev.clientY - rect.top);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp, { passive: false });
    document.addEventListener('pointercancel', onUp, { passive: false });
  }
  _startDrag(x, y) { this._isSelecting = true; this._startPoint = { x, y }; this._map.canvas.style.cursor = 'crosshair'; this._map.container.classList.add('selecting'); this._map.stopAnimations(); }
  _updateSelection(x, y) { this._endPoint = { x, y }; this._drawSelection(); }
  _endDrag(x, y) {
    this._isSelecting = false;
    this._map.canvas.style.cursor = 'grab';
    const rect = this._getSelectionRect();
    if (rect.width > 10 && rect.height > 10) this._zoomToSelection(rect);
    this._clearSelection();
    this._map.container.classList.remove('selecting');
  }
  _getSelectionRect() {
    if (!this._startPoint || !this._endPoint) return { x: 0, y: 0, width: 0, height: 0 };
    const x1 = this._startPoint.x, y1 = this._startPoint.y;
    const x2 = this._endPoint.x, y2 = this._endPoint.y;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  }
  _drawSelection() {
    this._clearSelection();
    const rect = this._getSelectionRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this._selectionRect = document.createElement('div');
    this._selectionRect.style.position = 'absolute';
    this._selectionRect.style.left = rect.x + 'px';
    this._selectionRect.style.top = rect.y + 'px';
    this._selectionRect.style.width = rect.width + 'px';
    this._selectionRect.style.height = rect.height + 'px';
    this._selectionRect.style.border = '2px dashed #3388ff';
    this._selectionRect.style.background = 'rgba(51, 136, 255, 0.1)';
    this._selectionRect.style.pointerEvents = 'none';
    this._selectionRect.style.zIndex = '999';
    this._map.container.appendChild(this._selectionRect);
  }
  _clearSelection() {
    if (this._selectionRect && this._selectionRect.parentNode) this._selectionRect.parentNode.removeChild(this._selectionRect);
    this._selectionRect = null;
    this._startPoint = null;
    this._endPoint = null;
    this._pointerId = null;
  }
  _zoomToSelection(rect) {
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const sw = this._map.screenToLatLon(rect.x, rect.y + rect.height);
    const ne = this._map.screenToLatLon(rect.x + rect.width, rect.y);
    const centerLon = (sw.lon + ne.lon) / 2;
    const centerLat = (sw.lat + ne.lat) / 2;
    const latSpanMeters = Math.abs(ne.lat - sw.lat) * 111000;
    const requiredResolution = latSpanMeters / rect.height;
    let targetZoom = this._map.zoom;
    let centerResolution = GISUtils.getResolution(centerLat, targetZoom);
    while (centerResolution > requiredResolution && targetZoom < (this._map._baseLayer?.getMaxZoom() || 18)) { targetZoom += 0.1; centerResolution = GISUtils.getResolution(centerLat, targetZoom); }
    const MIN_ZOOM_FOR_AREA_SELECT = 1;
    targetZoom = Math.max(MIN_ZOOM_FOR_AREA_SELECT, targetZoom - 0.5);
    this._map.flyTo({ center: { lat: centerLat, lon: centerLon }, zoom: targetZoom, duration: 800, easing: EASING.easeInOutQuint });
  }
}