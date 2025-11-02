// --- Base Handler Class ---
const Atlas = window.Atlas || {};
Atlas.Handler = class {
  constructor(map) {
    this._map = map;
    this._enabled = false;
    this._eventListeners = {};
  }

  enable() {
    if (this._enabled) return this;
    this._enabled = true;
    this._addEvents();
  }

  disable() {
    if (!this._enabled) return this;
    this._enabled = false;
    this._removeEvents();
  }

  toggle() {
    return this._enabled ? this.disable() : this.enable();
  }

  isEnabled() {
    return this._enabled;
  }

  _addEvents() {
    // To be implemented by subclasses
  }

  _removeEvents() {
    // To be implemented by subclasses
  }

  destroy() {
    this.disable();
    this._eventListeners = {};
  }
}

// --- Concrete Handler Classes ---
class DragPanHandler extends Handler {
  constructor(map) {
    super(map);
    this._isDragging = false;
    this._dragStart = null;
    this._moveSamples = [];
  }

  _addEvents() {
    this._map.canvas.addEventListener('mousedown', this._onMouseDown);
    this._map.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
  }

  _removeEvents() {
    this._map.canvas.removeEventListener('mousedown', this._onMouseDown);
    this._map.canvas.removeEventListener('touchstart', this._onTouchStart);
    this._removeMoveEvents();
  }

  _removeMoveEvents() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchmove', this._onTouchMove, { passive: false });
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);
  }

  _onMouseDown = (e) => {
    if (e.button !== 0) return; // Only left mouse button
    this._startDrag(e.clientX, e.clientY);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _onMouseMove = (e) => {
    if (!this._isDragging) return;
    e.preventDefault();
    const dx = e.clientX - this._dragStart.x;
    const dy = e.clientY - this._dragStart.y;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy, this._map.zoom, this._map.bearing, this._dragStart.center);
    this._pushVelocitySample(e.clientX, e.clientY);
    this._map.render();
  }

  _onMouseUp = () => {
    this._endDrag();
  }

  _onTouchStart = (e) => {
    if (e.touches.length !== 1) {
      if (this._isDragging) {
        this._endDrag();
      }
      return;
    }
    e.preventDefault();
    this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
    document.addEventListener('touchcancel', this._onTouchEnd);
  }

  _onTouchMove = (e) => {
    if (!this._isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - this._dragStart.x;
    const dy = e.touches[0].clientY - this._dragStart.y;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy, this._map.zoom, this._map.bearing, this._dragStart.center);
    this._pushVelocitySample(e.touches[0].clientX, e.touches[0].clientY);
    this._map.render();
  }

  _onTouchEnd = () => {
    this._endDrag();
  }

  _startDrag(clientX, clientY) {
    this._isDragging = true;
    this._map.stopAnimations();
    this._map.isDragging = true;
    this._map.container.classList.add('dragging');
    this._dragStart = {
      x: clientX,
      y: clientY,
      center: { ...this._map.center }
    };
    this._moveSamples = [];
    this._pushVelocitySample(clientX, clientY);
  }

  _endDrag() {
    if (!this._isDragging) return;
    this._isDragging = false;
    this._map.isDragging = false;
    this._map.container.classList.remove('dragging');
    const { vx, vy } = this._computeVelocity();
    this._startInertia(vx, vy);
    this._removeMoveEvents();
  }

  _pushVelocitySample(x, y) {
    const t = performance.now();
    this._moveSamples.push({ t, x, y });
    const cutoff = t - VELOCITY_WINDOW_MS;
    while (this._moveSamples.length && this._moveSamples[0].t < cutoff) {
      this._moveSamples.shift();
    }
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
      if (newVmag <= INERTIA_STOP_SPEED) {
        this._map.render();
        this._map._inertiaRAF = null;
        this._map.fire('moveend');
        return;
      }
      const s = newVmag / (vmag || 1);
      vx *= s;
      vy *= s;
      this._map.render();
      this._map._inertiaRAF = requestAnimationFrame(step);
    };
    this._map._inertiaRAF = requestAnimationFrame(step);
  }
}

class ScrollZoomHandler extends Handler {
  constructor(map) {
    super(map);
  }

  _addEvents() {
    this._map.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _removeEvents() {
    this._map.canvas.removeEventListener('wheel', this._onWheel);
  }

  _onWheel = (e) => {
    e.preventDefault();
    const dz = (e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP);
    this._map.smoothZoomAt(e.clientX, e.clientY, dz);
  }
}

class DoubleClickZoomHandler extends Handler {
  constructor(map) {
    super(map);
    this._lastClickTime = 0;
    this._lastClickPos = { x: 0, y: 0 };
  }

  _addEvents() {
    this._map.canvas.addEventListener('dblclick', this._onDoubleClick);
  }

  _removeEvents() {
    this._map.canvas.removeEventListener('dblclick', this._onDoubleClick);
  }

  _onDoubleClick = (e) => {
    e.preventDefault();
    this._map.animateZoomRotateAbout(e.clientX, e.clientY, this._map.getZoom() + 1, this._map.getBearing(), TAP_ZOOM_DURATION);
  }
}

class TouchZoomRotateHandler extends Handler {
  constructor(map) {
    super(map);
    this._isPinching = false;
    this._pinchStartDist = 0;
    this._pinchStartAngle = 0;
    this._pinchStartZoom = map.getZoom();
    this._pinchStartBearing = map.getBearing();
    this._pinchStartTime = 0;
    this._pinchLastCenter = null;
    this._pinchMoved = false;
    this._pinchAnchorLL = null;
  }

  _addEvents() {
    this._map.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
  }

  _removeEvents() {
    this._map.canvas.removeEventListener('touchstart', this._onTouchStart);
    this._removeMoveEvents();
  }

  _removeMoveEvents() {
    document.removeEventListener('touchmove', this._onTouchMove, { passive: false });
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);
  }

  _onTouchStart = (e) => {
    if (e.touches.length < 2) return;
    const dragPanHandler = this._map.getHandler('dragPan');
    if (dragPanHandler && dragPanHandler._isDragging) {
      dragPanHandler._endDrag();
    }
    e.preventDefault();
    this._startPinch(e);
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
    document.addEventListener('touchcancel', this._onTouchEnd);
  }

  _startPinch = (e) => {
    this._map.stopAnimations();
    this._isPinching = true;
    const t1 = e.touches[0], t2 = e.touches[1];
    this._pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    this._pinchStartAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
    this._pinchStartZoom = this._map.getZoom();
    this._pinchStartBearing = this._map.getBearing();
    this._pinchStartTime = performance.now();
    this._pinchLastCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    this._pinchAnchorLL = this._map.screenToLatLon(this._pinchLastCenter.x, this._pinchLastCenter.y, this._map.getZoom(), this._map.getBearing(), this._map.getCenter());
    this._pinchMoved = false;
  }

  _onTouchMove = (e) => {
    if (!this._isPinching || e.touches.length < 2) return;
    e.preventDefault();
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
    const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    const targetZoom = this._pinchStartZoom + Math.log2(dist / Math.max(1, this._pinchStartDist));
    const deltaAngle = normalizeAngle(angle - this._pinchStartAngle);
    const targetBearing = normalizeAngle(this._pinchStartBearing + deltaAngle);

    if (Math.abs(Math.log(dist / Math.max(1, this._pinchStartDist))) > Math.log(1 + TWO_FINGER_TAP_MOVE_THRESH / Math.max(1, this._pinchStartDist)) ||
            Math.abs(deltaAngle) > ROTATE_MOVE_THRESH_RAD) {
            this._pinchMoved = true;
    }

    this._map.applyZoomRotateAbout(center.x, center.y, targetZoom, targetBearing, this._pinchAnchorLL);
    this._pinchLastCenter = center;
    this._map.render();
  }

  _onTouchEnd = (e) => {
    if (!this._isPinching) return;
    const dt = performance.now() - this._pinchStartTime;
    // Only fire two-finger tap if all fingers are lifted
    if (e.touches.length === 0 && dt <= TWO_FINGER_TAP_MAX_DELAY && !this._pinchMoved) {
            const ax = this._pinchLastCenter ? this._pinchLastCenter.x : (this._map.canvas.width / this._map.dpr) / 2;
            const ay = this._pinchLastCenter ? this._pinchLastCenter.y : (this._map.canvas.height / this._map.dpr) / 2;
            this._map.animateZoomRotateAbout(ax, ay, this._map.getZoom() - 1, this._map.getBearing(), TAP_ZOOM_DURATION);
    }
    if (e.touches.length < 2) {
            this._isPinching = false;
            this._removeMoveEvents();
    }
  }
}

class KeyboardPanHandler extends Handler {
  constructor(map) {
    super(map);
  }

  _addEvents() {
    window.addEventListener('keydown', this._onKeyDown);
  }

  _removeEvents() {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  _onKeyDown = (e) => {
    let dx = 0, dy = 0;
    const panStepPx = 100; // The distance to pan in pixels

    if (e.key === "ArrowUp") {
      dy = panStepPx;
    } else if (e.key === "ArrowDown") {
      dy = -panStepPx;
    } else if (e.key === "ArrowLeft") {
      dx = panStepPx;
    } else if (e.key === "ArrowRight") {
      dx = -panStepPx;
    } else if (e.key.toLowerCase() === "n") {
      const w = this._map.canvas.width / this._map.dpr, h = this._map.canvas.height / this._map.dpr;
      this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION);
      return;
    } else if (e.key === "r") {
      this._map.setBearing(this._map.getBearing() + DEG2RAD * 15);
      return;
    } else if (e.key === "l") {
      this._map.setBearing(this._map.getBearing() - DEG2RAD * 15);
      return;
    } else if (e.key === "s") {
      const current = this._map.getBaseLayer();
      if (current === TILE_LAYERS.ESRI) {
        this._map.setBaseLayer(TILE_LAYERS.OSM);
      } else {
        this._map.setBaseLayer(TILE_LAYERS.OSM);
      }
      return;
    } else if (e.key === "+" || e.key === "=") {
      this._map.stopAnimations();
      this._map.setZoom(this._map.getZoom() + 1);
      return;
    } else if (e.key === "-") {
      this._map.stopAnimations();
      this._map.setZoom(this._map.getZoom() - 1);
      return;
    }

    if (dx !== 0 || dy !== 0) {
      this._map.stopAnimations();
      const w = this._map.canvas.width / this._map.dpr;
      const h = this._map.canvas.height / this._map.dpr;
      // Pan relative to the screen, not geographically, by passing the current bearing.
      this._map.center = this._map.screenToLatLon(w / 2 + dx, h / 2 + dy, this._map.getZoom(), this._map.getBearing());
      this._map.render();
    }
  }
}
