import { Handler } from './Handler.js';
import { DOUBLE_TAP_MAX_DELAY, DOUBLE_TAP_MAX_MOVE, VELOCITY_WINDOW_MS, INERTIA_STOP_SPEED, INERTIA_DECEL, TWO_FINGER_TAP_MAX_DELAY, TWO_FINGER_TAP_MOVE_THRESH, ROTATE_MOVE_THRESH_RAD, TAP_ZOOM_DURATION } from '../utils/constants.js';
import { normalizeAngle } from '../utils/constants.js';

// Unified pointer handler for pan, pinch/rotate, double-tap & inertia
export class PointerHandler extends Handler {
  constructor(map) {
    super(map);
    this._pointers = new Map(); // pointerId -> {x,y}
    this._isDragging = false;
    this._dragStart = null;
    this._moveSamples = [];
    this._isPinching = false;
    this._pinch = null;
    this._lastTapTime = 0;
    this._lastTapPos = { x: 0, y: 0 };
  }
  _addEvents() {
    // ensure canvas doesn't allow default gestures (so pointer events are fully delivered)
    try { this._map.canvas.style.touchAction = 'none'; } catch (e) {}
    this._addDomListener(this._map.canvas, 'pointerdown', this._onPointerDown = this._onPointerDown.bind(this), { passive: false });
    this._addDomListener(this._map.canvas, 'pointermove', this._onPointerMove = this._onPointerMove.bind(this), { passive: false });
    this._addDomListener(this._map.canvas, 'pointerup', this._onPointerUp = this._onPointerUp.bind(this), { passive: false });
    this._addDomListener(this._map.canvas, 'pointercancel', this._onPointerCancel = this._onPointerCancel.bind(this), { passive: false });
  }
  _removeEvents() {
    this._removeAllDomListeners();
    this._pointers.clear();
    this._isDragging = false;
    this._isPinching = false;
  }
  _onPointerDown(e) {
    // only primary left mouse button or any touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, screenX: x, screenY: y, pointerType: e.pointerType });
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    // double-tap detection for single pointer (touch only)
    const now = Date.now();
    if (e.pointerType === 'touch') {
      if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY && Math.hypot(e.clientX - this._lastTapPos.x, e.clientY - this._lastTapPos.y) < DOUBLE_TAP_MAX_MOVE) {
        // double-tap -> zoom in about point
        this._map.animateZoomRotateAbout(e.clientX - rect.left, e.clientY - rect.top, this._map.getZoom() + 1, this._map.getBearing(), TAP_ZOOM_DURATION);
        this._lastTapTime = 0;
        this._lastTapPos = { x: 0, y: 0 };
        return;
      } else {
        this._lastTapTime = now;
        this._lastTapPos = { x: e.clientX, y: e.clientY };
        setTimeout(() => {
          if (Date.now() - this._lastTapTime >= DOUBLE_TAP_MAX_DELAY) {
            this._lastTapTime = 0;
            this._lastTapPos = { x: 0, y: 0 };
          }
        }, DOUBLE_TAP_MAX_DELAY);
      }
    }
    // if two pointers present -> start pinch/rotate
    if (this._pointers.size >= 2 && !this._isPinching) {
      this._startPinch();
      return;
    }
    // else start drag if primary pointer
    if (!this._isPinching && !this._isDragging) {
      // start drag for single primary pointer
      this._startDrag(e.clientX, e.clientY);
    }
  }
  _onPointerMove(e) {
    if (!this._pointers.has(e.pointerId)) return;
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = this._pointers.get(e.pointerId);
    p.x = e.clientX;
    p.y = e.clientY;
    p.screenX = x;
    p.screenY = y;
    // pinch handling
    if (this._isPinching && this._pointers.size >= 2) {
      this._updatePinch();
      return;
    }
    if (this._isDragging) {
      // find current pointer position relative to drag start
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      const w = this._map.canvas.width / this._map.dpr;
      const h = this._map.canvas.height / this._map.dpr;
      this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy, this._map.zoom, this._map.bearing, this._dragStart.center);
      this._pushVelocitySample(e.clientX, e.clientY);
      this._map.render();
    }
  }
  _onPointerUp(e) {
    if (!this._pointers.has(e.pointerId)) return;
    try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    this._pointers.delete(e.pointerId);
    // end pinch
    if (this._isPinching && this._pointers.size < 2) {
      this._endPinch();
    }
    // end drag
    if (this._isDragging && this._pointers.size === 0) {
      this._endDrag();
    }
  }
  _onPointerCancel(e) {
    if (!this._pointers.has(e.pointerId)) return;
    try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    this._pointers.delete(e.pointerId);
    if (this._isPinching && this._pointers.size < 2) this._endPinch();
    if (this._isDragging && this._pointers.size === 0) this._endDrag();
  }
  _startDrag(clientX, clientY) {
    this._isDragging = true;
    this._map.stopAnimations();
    this._map.isDragging = true;
    this._map.container.classList.add('dragging');
    this._dragStart = { x: clientX, y: clientY, center: { ...this._map.center } };
    this._moveSamples = [];
    this._pushVelocitySample(clientX, clientY);
  }
  _endDrag() {
    if (!this._isDragging) return;
    this._isDragging = false;
    this._map.isDragging = false;
    this._map.container.classList.remove('dragging');
    const { vx, vy } = this._computeVelocity();
    if (this._map._baseLayer && this._map._baseLayer instanceof TileLayer) this._map._baseLayer.updatePanningVelocity(vx, vy);
    this._startInertia(vx, vy);
  }
  _pushVelocitySample(x, y) {
    const t = performance.now();
    this._moveSamples.push({ t, x, y });
    const cutoff = t - VELOCITY_WINDOW_MS;
    while (this._moveSamples.length && this._moveSamples[0].t < cutoff) this._moveSamples.shift();
  }
  _computeVelocity() {
    if (this._moveSamples.length < 2) return { vx: 0, vy: 0 };
    const last = this._moveSamples[this._moveSamples.length - 1];
    let i = this._moveSamples.length - 2;
    while (i > 0 && last.t - this._moveSamples[i].t < VELOCITY_WINDOW_MS * 0.5) i--;
    const ref = this._moveSamples[i];
    const dt = Math.max(1, last.t - ref.t);
    return { vx: (last.x - ref.x) / dt, vy: (last.y - ref.y) / dt };
  }
  _startInertia(vx, vy) {
    const speed = Math.hypot(vx, vy);
    if (speed < INERTIA_STOP_SPEED) return;
    let lastT = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;
      const dx = vx * dt, dy = vy * dt;
      const w = this._map.canvas.width / this._map.dpr;
      const h = this._map.canvas.height / this._map.dpr;
      this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy);
      const vmag = Math.hypot(vx, vy);
      const newVmag = Math.max(0, vmag - INERTIA_DECEL * dt);
      if (newVmag <= INERTIA_STOP_SPEED) { this._map.render(); this._map._inertiaRAF = null; this._map.fire('moveend'); return; }
      const s = newVmag / (vmag || 1);
      vx *= s; vy *= s;
      this._map.render();
      this._map._inertiaRAF = requestAnimationFrame(step);
    };
    this._map._inertiaRAF = requestAnimationFrame(step);
  }
  // pinch handling (two pointers)
  _startPinch() {
    if (this._pointers.size < 2) return;
    this._isPinching = true;
    this._map.stopAnimations();
    const arr = Array.from(this._pointers.values()).slice(0, 2);
    const t1 = arr[0], t2 = arr[1];
    this._pinch = {
      startDist: Math.hypot(t2.x - t1.x, t2.y - t1.y),
      startAngle: Math.atan2(t2.y - t1.y, t2.x - t1.x),
      startZoom: this._map.getZoom(),
      startBearing: this._map.getBearing(),
      startTime: performance.now(),
      lastCenter: { x: (t1.screenX + t2.screenX) / 2, y: (t1.screenY + t2.screenY) / 2 },
      anchorLL: this._map.screenToLatLon((t1.screenX + t2.screenX) / 2, (t1.screenY + t2.screenY) / 2, this._map.getZoom(), this._map.getBearing(), this._map.getCenter()),
      moved: false
    };
  }
  _updatePinch() {
    if (!this._pinch) return;
    const pointers = Array.from(this._pointers.values()).slice(0, 2);
    if (pointers.length < 2) return;
    const t1 = pointers[0], t2 = pointers[1];
    const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    const angle = Math.atan2(t2.y - t1.y, t2.x - t1.x);
    const center = { x: (t1.screenX + t2.screenX) / 2, y: (t1.screenY + t2.screenY) / 2 };
    const targetZoom = this._pinch.startZoom + Math.log2(dist / Math.max(1, this._pinch.startDist));
    const deltaAngle = normalizeAngle(angle - this._pinch.startAngle);
    const targetBearing = normalizeAngle(this._pinch.startBearing + deltaAngle);
    if (Math.abs(Math.log(dist / Math.max(1, this._pinch.startDist))) > Math.log(1 + TWO_FINGER_TAP_MOVE_THRESH / Math.max(1, this._pinch.startDist)) || Math.abs(deltaAngle) > ROTATE_MOVE_THRESH_RAD) this._pinch.moved = true;
    this._map.applyZoomRotateAbout(center.x, center.y, targetZoom, targetBearing, this._pinch.anchorLL);
    this._pinch.lastCenter = center;
    this._map.render();
  }
  _endPinch() {
    if (!this._pinch) return;
    const dt = performance.now() - this._pinch.startTime;
    if (dt <= TWO_FINGER_TAP_MAX_DELAY && !this._pinch.moved) {
      // two-finger quick tap -> zoom out
      const ax = this._pinch.lastCenter ? this._pinch.lastCenter.x : (this._map.canvas.width / this._map.dpr) / 2;
      const ay = this._pinch.lastCenter ? this._pinch.lastCenter.y : (this._map.canvas.height / this._map.dpr) / 2;
      this._map.animateZoomRotateAbout(ax, ay, this._map.getZoom() - 1, this._map.getBearing(), TAP_ZOOM_DURATION);
    }
    this._isPinching = false;
    this._pinch = null;
  }
}