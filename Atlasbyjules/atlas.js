// --- Constants ---
const EARTH_RADIUS = 6378137;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;
const MAX_LATITUDE = 85.05112878;
const MIN_LATITUDE = -85.05112878;
const TILE_SIZE = 256;
const TILE_BUFFER = 3;
const TILE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const TILE_LOAD_TIMEOUT_MS = 10000; // 10 seconds timeout for tile loading
const SCALE_BAR_TARGET_PX = 120;
const INERTIA_DECEL = 0.0025;
const INERTIA_STOP_SPEED = 0.02;
const VELOCITY_WINDOW_MS = 120;
const DOUBLE_TAP_MAX_DELAY = 300;
const DOUBLE_TAP_MAX_MOVE = 16;
const TWO_FINGER_TAP_MAX_DELAY = 250;
const TWO_FINGER_TAP_MOVE_THRESH = 10;
const ROTATE_MOVE_THRESH_RAD = 0.08;
const WHEEL_ZOOM_STEP = 0.25;
const WHEEL_ZOOM_DURATION = 220;
const TAP_ZOOM_DURATION = 280;
const SNAP_DURATION = 300;
const FLYTO_DURATION = 800;

// --- Layer Configuration ---
const LAYERS = {
  OSM: {
    name: "OpenStreetMap",
    minZoom: 0,
    maxZoom: 19,
    tileServers: ["https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org"],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    background: "#e6e6e6",
    supportsRetina: true,
    maxCacheSize: 500
  },
  ESRI: {
    name: "Esri Satellite",
    minZoom: 0,
    maxZoom: 19,
    tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile"],
    attribution: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">Esri World Imagery</a>',
    background: "#000000",
    supportsRetina: false,
    maxCacheSize: 400
  }
};

// --- Configuration ---
const CONFIG = {
  defaultLayer: "OSM",
  defaultCenter: { lon: 0, lat: 0 },
  defaultZoom: 3,
  retina: "auto",
  retinaSuffix: "@2x"
};

// --- Easing Functions ---
const EASING = {
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  linear: t => t
};

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// --- Utility Functions ---
const normalizeAngle = rad => Math.atan2(Math.sin(rad), Math.cos(rad));
const shortestAngleDiff = (from, to) => normalizeAngle(to - from);
const wrapDeltaLon = delta => (((delta + 180) % 360) + 360) % 360 - 180;
const rot = (x, y, ang) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: x * c - y * s, y: x * s + y * c };
};

// --- GIS Utility Class (Updated to use Projection) ---
class GISUtils {
  static toRadians(d) { return d * Math.PI / 180; }
  static toDegrees(r) { return r * 180 / Math.PI; }
  static wrapLongitude(l) {
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    return l;
  }
  static clampLatitude(lat) {
    return Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, lat));
  }
  static getResolution(lat, z) {
    return (EARTH_CIRCUMFERENCE * Math.cos(this.toRadians(lat))) / (Math.pow(2, z) * TILE_SIZE);
  }
  static formatDistance(m) {
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
  }

  // This method is now a wrapper around the projection's method for backward compatibility.
  static tileToLonLat(x, y, z) {
    return DEFAULT_PROJECTION.tileToLatLng(x, y, z);
  }
}

// --- PROFESSIONAL OVERLAY SYSTEM ---
class PopupManager {
  constructor(map) {
    this._map = map;
    this._openPopup = null;
    this._boundCloseOnEscape = this._closeOnEscape.bind(this);
    this._boundCloseOnClickOutside = this._closeOnClickOutside.bind(this);
    this._setupGlobalListeners();
  }

  _setupGlobalListeners() {
    document.addEventListener('keydown', this._boundCloseOnEscape);
    document.addEventListener('click', this._boundCloseOnClickOutside);
  }

  _teardownGlobalListeners() {
    document.removeEventListener('keydown', this._boundCloseOnEscape);
    document.removeEventListener('click', this._boundCloseOnClickOutside);
  }

  _closeOnEscape(e) {
    if (e.key === 'Escape' && this._openPopup) {
      this._openPopup.close();
    }
  }

  _closeOnClickOutside(e) {
    if (!this._openPopup) return;

    if (this._openPopup._popupElement && this._openPopup._popupElement.contains(e.target)) {
      return;
    }

    if (this._openPopup._anchor instanceof Atlas.AtlasMarker &&
        this._openPopup._anchor._iconElement &&
        this._openPopup._anchor._iconElement.contains(e.target)) {
      return;
    }

    this._openPopup.close();
  }

  setOpenPopup(popup) {
    if (this._openPopup === popup) return;

    if (this._openPopup) {
      this._openPopup.close();
    }

    this._openPopup = popup;
  }

  getOpenPopup() {
    return this._openPopup;
  }

  clearOpenPopup(popup) {
    if (this._openPopup === popup) {
      this._openPopup = null;
    }
  }

  destroy() {
    this._teardownGlobalListeners();
    this._openPopup = null;
  }
}

class Overlay {
  constructor(options = {}) {
    this.options = options;
    this._map = null;
    this._events = {};
  }

  on(type, fn) {
    if (!this._events[type]) {
      this._events[type] = [];
    }
    this._events[type].push(fn);
    return this;
  }

  off(type, fn) {
    if (!this._events[type]) return this;
    if (!fn) {
      this._events[type] = [];
    } else {
      this._events[type] = this._events[type].filter(cb => cb !== fn);
    }
    return this;
  }

  fire(type, data = {}) {
    if (!this._events[type]) return;
    data.type = type;
    data.target = this;
    this._events[type].forEach(fn => fn(data));
  }

  addTo(map) {
    if (this._map) {
      this._map.removeOverlay(this);
    }
    this._map = map;
    map.addOverlay(this);
    return this;
  }

  remove() {
    if (this._map) {
      this._map.removeOverlay(this);
      this._map = null;
    }
    return this;
  }

  onAdd() { }
  onRemove() { }
  render() { }
}

class AtlasMarker extends Overlay {
  constructor(latlng, options = {}) {
    super(options);

    this._latlng = { ...latlng };
    this._iconElement = null;
    this._isHovered = false;
    this._isDragging = false;
    this._dragStart = null;
    this._popup = null;

    this.options = {
      draggable: false,
      riseOnHover: true,
      riseOffset: 250,
      zIndexOffset: 0,
      ...options
    };
  }

  onAdd() {
    this._iconElement = this._createIcon();
    this._map.container.appendChild(this._iconElement);

    this._iconElement.addEventListener('click', this._onClick.bind(this));
    this._iconElement.addEventListener('mouseenter', this._onMouseEnter.bind(this));
    this._iconElement.addEventListener('mouseleave', this._onMouseLeave.bind(this));

    if (this.options.draggable) {
      this._iconElement.addEventListener('mousedown', this._onMouseDown.bind(this));
      this._iconElement.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    }

    this._updatePosition();
    this._updateZIndex();
  }

  onRemove() {
    if (this._popup) {
      this._popup.remove();
    }

    if (this._iconElement && this._iconElement.parentNode) {
      this._iconElement.parentNode.removeChild(this._iconElement);
    }

    this._iconElement = null;
    this._popup = null;
  }

  render() {
    if (this._iconElement) {
      this._updatePosition();
    }
  }

  _createIcon() {
    const el = document.createElement('div');
    el.className = 'atlas-marker';

    const shadow = document.createElement('div');
    shadow.className = 'atlas-marker-shadow';
    el.appendChild(shadow);

    const icon = document.createElement('div');
    icon.className = 'atlas-marker-icon';
    icon.innerHTML = this.options.html || `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 10.5 12 24 12 24s12-13.5 12-24C24 5.4 18.6 0 12 0zm0 16.5c-2.5 0-4.5-2-4.5-4.5S9.5 7.5 12 7.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5z" fill="#ff7800" stroke="#fff" stroke-width="1.5"/>
          </svg>
        `;
    el.appendChild(icon);

    return el;
  }

  _updatePosition() {
    if (!this._iconElement || !this._map) return;
    const point = this._map.latLngToContainerPoint(this._latlng);
    this._iconElement.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
  }

  _updateZIndex() {
    if (!this._iconElement) return;

    let baseZIndex = 1000;
    if (this._isHovered && this.options.riseOnHover) {
      baseZIndex += this.options.riseOffset;
    }
    baseZIndex += this.options.zIndexOffset;

    this._iconElement.style.zIndex = baseZIndex;
  }

  _onClick(e) {
    e.stopPropagation();
    this.fire('click', { originalEvent: e });

    if (this._popup) {
      if (this._popup._isOpen) {
        this._popup.close();
      } else {
        this._popup.openOn(this);
      }
    }
  }

  _onMouseEnter(e) {
    if (!this._isDragging) {
      this._isHovered = true;
      this._updateZIndex();
      this._iconElement.classList.add('hover');
      this.fire('mouseover', { originalEvent: e });
    }
  }

  _onMouseLeave(e) {
    this._isHovered = false;
    this._updateZIndex();
    this._iconElement.classList.remove('hover');
    this.fire('mouseout', { originalEvent: e });
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this._startDrag(e.clientX, e.clientY);
    document.addEventListener('mousemove', this._onMouseMove = this._onMouseMove.bind(this));
    document.addEventListener('mouseup', this._onMouseUp = this._onMouseUp.bind(this));
  }

  _onTouchStart(e) {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    e.preventDefault();
    this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
    document.addEventListener('touchmove', this._onTouchMove = this._onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._onTouchEnd = this._onTouchEnd.bind(this));
    document.addEventListener('touchcancel', this._onTouchEnd);
  }

  _startDrag(clientX, clientY) {
    this._isDragging = true;
    this._map.stopAnimations();
    this._map.isDragging = true;
    this._map.container.classList.add('dragging');

    this._dragStart = {
      x: clientX,
      y: clientY,
      latlng: { ...this._latlng }
    };

    this._iconElement.classList.add('dragging');
    this.fire('dragstart');
  }

  _onDragMove(clientX, clientY) {
    const startPoint = this._map.latLngToContainerPoint(this._dragStart.latlng);
    const dx = clientX - this._dragStart.x;
    const dy = clientY - this._dragStart.y;
    const newPoint = { x: startPoint.x + dx, y: startPoint.y + dy };
    const newLatLng = this._map.screenToLatLon(newPoint.x, newPoint.y);

    this._latlng = {
      lat: GISUtils.clampLatitude(newLatLng.lat),
      lon: GISUtils.wrapLongitude(newLatLng.lon)
    };

    this.fire('drag', { latlng: { ...this._latlng } });
    this.render();
  }

  _onMouseMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();
    this._onDragMove(e.clientX, e.clientY);
  }

  _onTouchMove(e) {
    if (!this._isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    this._onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }

  _onMouseUp() {
    this._endDrag();
  }

  _onTouchEnd() {
    this._endDrag();
  }

  _endDrag() {
    if (!this._isDragging) return;

    this._isDragging = false;
    this._map.isDragging = false;
    this._map.container.classList.remove('dragging');
    this._iconElement.classList.remove('dragging');

    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);

    this.fire('dragend', { latlng: { ...this._latlng } });
  }

  setLatLng(latlng) {
    this._latlng = { ...latlng };
    if (this._map) {
      this._map.render();
    }
    return this;
  }

  getLatLng() {
    return { ...this._latlng };
  }

  bindPopup(content, options = {}) {
    if (this._popup) {
      this._popup.remove();
    }
    this._popup = new Atlas.AtlasPopup(content, options);
    this._popup.addTo(this._map);
    return this;
  }

  unbindPopup() {
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
    }
    return this;
  }

  togglePopup() {
    if (this._popup) {
      if (this._popup._isOpen) {
        this._popup.close();
      } else {
        this._popup.openOn(this);
      }
    }
    return this;
  }

  openPopup() {
    if (this._popup) {
      this._popup.openOn(this);
    }
    return this;
  }

  closePopup() {
    if (this._popup && this._popup._isOpen) {
      this._popup.close();
    }
    return this;
  }
}

class AtlasPopup extends Overlay {
  constructor(content, options = {}) {
    super(options);

    this._content = content;
    this._popupElement = null;
    this._isOpen = false;
    this._anchor = null;
    this._tipElement = null;

    this.options = {
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      className: '',
      maxWidth: 300,
      minWidth: 50,
      ...options
    };
  }

  onAdd() {
    this._popupElement = this._createPopupElement();
    this._map.container.appendChild(this._popupElement);

    if (this.options.closeButton) {
      const closeButton = this._popupElement.querySelector('.popup-close');
      if (closeButton) {
        closeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
        });
      }
    }

    if (!this._map._popupManager) {
      this._map._popupManager = new PopupManager(this._map);
    }
  }

  onRemove() {
    if (this._popupElement && this._popupElement.parentNode) {
      this._popupElement.parentNode.removeChild(this._popupElement);
    }
    this._popupElement = null;
    this._tipElement = null;
    this._isOpen = false;

    if (this._map && this._map._popupManager) {
      this._map._popupManager.clearOpenPopup(this);
    }
  }

  render() {
    if (!this._isOpen || !this._popupElement) return;
    this._updatePosition();
  }

  _createPopupElement() {
    const el = document.createElement('div');
    el.className = 'atlas-popup';
    if (this.options.className) {
      el.classList.add(this.options.className);
    }

    let closeButtonHtml = '';
    if (this.options.closeButton) {
      closeButtonHtml = `<button class="popup-close" aria-label="Close popup" title="Close">&times;</button>`;
    }

    el.innerHTML = `
          <div class="popup-content">${this._content}</div>
          ${closeButtonHtml}
          <div class="popup-tip"></div>
        `;

    this._tipElement = el.querySelector('.popup-tip');

    el.style.maxWidth = `${this.options.maxWidth}px`;
    el.style.minWidth = `${this.options.minWidth}px`;

    return el;
  }

  _updatePosition() {
    if (!this._anchor || !this._popupElement || !this._tipElement) return;

    let anchorPoint;
    if (this._anchor instanceof Atlas.AtlasMarker && this._anchor._iconElement) {
      const rect = this._anchor._iconElement.getBoundingClientRect();
      const containerRect = this._map.container.getBoundingClientRect();
      anchorPoint = {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top
      };
    } else if (this._anchor && typeof this._anchor.lat === 'number') {
      const point = this._map.latLngToContainerPoint(this._anchor);
      anchorPoint = { x: point.x, y: point.y };
    } else {
      return;
    }

    const popupRect = this._popupElement.getBoundingClientRect();
    const mapRect = this._map.container.getBoundingClientRect();

    const space = {
      top: anchorPoint.y,
      right: mapRect.width - anchorPoint.x,
      bottom: mapRect.height - anchorPoint.y,
      left: anchorPoint.x
    };

    let position = 'bottom';
    let tipClass = 'tip-bottom';

    if (space.bottom < popupRect.height && space.top >= popupRect.height) {
      position = 'top';
      tipClass = 'tip-top';
    } else if (space.right < popupRect.width / 2 && space.left >= popupRect.width / 2) {
      position = 'left';
      tipClass = 'tip-left';
    } else if (space.left < popupRect.width / 2 && space.right >= popupRect.width / 2) {
      position = 'right';
      tipClass = 'tip-right';
    }

    let left, top;
    switch (position) {
      case 'top':
        left = anchorPoint.x - popupRect.width / 2;
        top = anchorPoint.y - popupRect.height;
        break;
      case 'bottom':
        left = anchorPoint.x - popupRect.width / 2;
        top = anchorPoint.y;
        break;
      case 'left':
        left = anchorPoint.x - popupRect.width;
        top = anchorPoint.y - popupRect.height / 2;
        break;
      case 'right':
        left = anchorPoint.x;
        top = anchorPoint.y - popupRect.height / 2;
        break;
    }

    left = Math.max(5, Math.min(mapRect.width - popupRect.width - 5, left));
    top = Math.max(5, Math.min(mapRect.height - popupRect.height - 5, top));

    this._popupElement.style.left = `${left}px`;
    this._popupElement.style.top = `${top}px`;
    this._popupElement.classList.add('open');

    this._tipElement.className = 'popup-tip ' + tipClass;
  }

  openOn(anchor) {
    this._anchor = anchor;
    this._isOpen = true;

    if (this._map && this._map._popupManager) {
      this._map._popupManager.setOpenPopup(this);
    }

    if (this._map) {
      this._map.render();
    }

    this.fire('open');
    return this;
  }

  close() {
    this._isOpen = false;
    if (this._popupElement) {
      this._popupElement.classList.remove('open');
    }

    if (this._map && this._map._popupManager) {
      this._map._popupManager.clearOpenPopup(this);
    }

    if (this._map) {
      this._map.render();
    }

    this.fire('close');
    return this;
  }

  setContent(content) {
    this._content = content;
    if (this._popupElement) {
      this._popupElement.querySelector('.popup-content').innerHTML = content;
    }
    return this;
  }
}

// --- Professional Atlas Class (Updated to use Projection System) ---
class Atlas {
  constructor(id, options = {}) {
    this.container = document.getElementById("map-container");
    if (!this.container) {
      throw new Error('[Atlas] The required "map-container" element was not found in the DOM.');
    }
    this.canvas = document.getElementById(id);
    if (!this.canvas) {
      throw new Error(`[Atlas] The required canvas element with id "${id}" was not found in the DOM.`);
    }
    this.ctx = this.canvas.getContext("2d");

    Object.assign(CONFIG, options);
    this.center = {
      lon: GISUtils.wrapLongitude(CONFIG.defaultCenter.lon),
      lat: GISUtils.clampLatitude(CONFIG.defaultCenter.lat)
    };
    this.zoom = CONFIG.defaultZoom;
    this.bearing = 0;
    this.renderScheduled = false;
    this.zoomOverlay = document.getElementById("zoom-overlay");
    this.loadingEl = document.getElementById("loading");
    this.loadingCountEl = document.getElementById("loading-count");
    this.coordsEl = document.getElementById("coords");
    this._inertiaRAF = null;
    this._eventListeners = {};
    this._layers = [];
    this._baseLayer = null;
    this._events = {};
    this._controls = [];
    this._controlCorners = {};
    this._overlays = [];
    this._handlers = {};
    this._popupManager = null;

    // --- NEW: Initialize the default projection ---
    this.projection = DEFAULT_PROJECTION;
    // --- END NEW ---

    this.addHandler('dragPan', Atlas.DragPanHandler);
    this.addHandler('scrollZoom', Atlas.ScrollZoomHandler);
    this.addHandler('doubleClickZoom', Atlas.DoubleClickZoomHandler);
    this.addHandler('touchZoomRotate', Atlas.TouchZoomRotateHandler);
    this.addHandler('keyboardPan', Atlas.KeyboardPanHandler);

    this.notifications = new Atlas.NotificationControl(this);

    console.warn(
      `%c[Atlas] You are using map tiles.
%cPlease comply with the respective tile usage policies.
%c- OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/
%c- Esri: https://www.esri.com/en-us/legal/terms/full-master-agreement`,
      "font-weight:bold;color:#e74c3c;",
      "color:#3498db;",
      "color:#2ecc71;",
      "color:#f39c12;"
    );

    this.resize();
    this.addControl(new Atlas.ZoomControl({ position: 'top-left' }));
    this.addControl(new Atlas.LayerControl({ position: 'top-left' }));
    this.addControl(new Atlas.FullscreenControl({ position: 'top-right' }));
    this.addControl(new Atlas.ScaleControl({ position: 'bottom-right' }));
    this.addControl(new Atlas.AttributionControl({ position: 'bottom-left' }));
    this.addControl(new Atlas.CompassControl({ position: 'top-left' }));
    this.addControl(new Atlas.ResetZoomControl({ position: 'top-left' }));
    this.updateAttribution();
    this.render();
    this.fire('load');
  }

  // --- Map Event System ---
  on(type, fn) {
    if (!this._events[type]) {
      this._events[type] = [];
    }
    this._events[type].push(fn);
    return this;
  }

  off(type, fn) {
    if (!this._events[type]) return this;
    if (!fn) {
      this._events[type] = [];
    } else {
      this._events[type] = this._events[type].filter(cb => cb !== fn);
    }
    return this;
  }

  fire(type, data = {}) {
    if (!this._events[type]) return;
    data.type = type;
    data.target = this;
    this._events[type].forEach(fn => fn(data));
  }

  // --- Layer Management ---
  addLayer(layer) {
    if (!(layer instanceof Atlas.Layer)) {
      throw new Error('Argument must be an instance of Layer');
    }
    if (!this._layers.includes(layer)) {
      this._layers.push(layer);
      layer._map = this;
      layer.onAdd();
      this.render();
      if (!this._baseLayer || (layer instanceof Atlas.TileLayer && !this._baseLayer)) {
        this._baseLayer = layer;
        this.container.style.background = layer.getBackground();
      }
    }
    return this;
  }

  removeLayer(layer) {
    const index = this._layers.indexOf(layer);
    if (index !== -1) {
      this._layers.splice(index, 1);
      layer.onRemove();
      layer._map = null;
      if (this._baseLayer === layer) {
        this._baseLayer = this._layers.find(l => l instanceof Atlas.TileLayer) || null;
        if (this._baseLayer) {
          this.container.style.background = this._baseLayer.getBackground();
        }
      }
      this.render();
    }
    return this;
  }

  setBaseLayer(newLayer) {
    if (!(newLayer instanceof Atlas.TileLayer)) {
      throw new Error('Argument must be an instance of TileLayer');
    }
    if (this._baseLayer && this._baseLayer !== newLayer) {
      this.removeLayer(this._baseLayer);
    }
    if (!this._layers.includes(newLayer)) {
      this.addLayer(newLayer);
    } else {
      this._baseLayer = newLayer;
      this.container.style.background = newLayer.getBackground();
      this.zoom = Math.max(newLayer.getMinZoom(), Math.min(newLayer.getMaxZoom(), this.zoom));
      this.render();
    }
    return this;
  }

  getBaseLayer() {
    return this._baseLayer;
  }

  // --- Control Management ---
  addControl(control) {
    if (!(control instanceof Atlas.Control)) {
      throw new Error('Argument must be an instance of Control');
    }
    this._controls.push(control);
    control.addTo(this);
    return this;
  }

  removeControl(control) {
    const index = this._controls.indexOf(control);
    if (index !== -1) {
      this._controls.splice(index, 1);
      control.remove();
    }
    return this;
  }

  getControls() {
    return [...this._controls];
  }

  // --- Handler Management ---
  addHandler(name, HandlerClass) {
    if (this._handlers[name]) {
      console.warn(`Handler '${name}' already exists.`);
      return this;
    }
    this._handlers[name] = new HandlerClass(this);
    this._handlers[name].enable();
    return this;
  }

  removeHandler(name) {
    if (!this._handlers[name]) return this;
    this._handlers[name].destroy();
    delete this._handlers[name];
    return this;
  }

  getHandler(name) {
    return this._handlers[name] || null;
  }

  enableHandler(name) {
    const handler = this.getHandler(name);
    if (handler) handler.enable();
    return this;
  }

  disableHandler(name) {
    const handler = this.getHandler(name);
    if (handler) handler.disable();
    return this;
  }

  getHandlers() {
    return { ...this._handlers };
  }

  // --- Overlay Management ---
  addOverlay(overlay) {
    if (!(overlay instanceof Overlay)) {
      throw new Error('Argument must be an instance of Overlay');
    }
    if (!this._overlays.includes(overlay)) {
      this._overlays.push(overlay);
      overlay._map = this;
      overlay.onAdd();
      this.render();
    }
    return this;
  }

  removeOverlay(overlay) {
    const index = this._overlays.indexOf(overlay);
    if (index !== -1) {
      this._overlays.splice(index, 1);
      overlay.onRemove();
      overlay._map = null;
      this.render();
    }
    return this;
  }

  getOverlays() {
    return [...this._overlays];
  }

  // --- Core Map Methods ---
  setZoom(z) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const nz = Math.max(minZoom, Math.min(maxZoom, z));
    if (nz === this.zoom) return;
    this.zoom = nz;
    this.render();
    this.showZoomOverlay();
    this.updateControlsUI();
    this.fire('zoom');
  }

  setBearing(rad) {
    const nr = normalizeAngle(rad);
    if (Math.abs(nr - this.bearing) < 1e-6) return;
    this.bearing = nr;
    this.render();
    this.fire('rotate');
  }

  showZoomOverlay() {
    const overlay = this.zoomOverlay;
    overlay.textContent = `Zoom: ${this.zoom.toFixed(2)}`;
    overlay.style.opacity = 1;
    clearTimeout(this._zTimer);
    this._zTimer = setTimeout(() => overlay.style.opacity = 0, 500);
  }

  stopInertia() {
    if (this._inertiaRAF) cancelAnimationFrame(this._inertiaRAF);
    this._inertiaRAF = null;
  }

  stopAnimations() {
    this.stopInertia();
    if (this._zoomAnim?.raf) cancelAnimationFrame(this._zoomAnim.raf);
    this._zoomAnim = null;
    if (this._flyAnim?.raf) cancelAnimationFrame(this._flyAnim.raf);
    this._flyAnim = null;
  }

  resize() {
    const w = this.container.offsetWidth, h = this.container.offsetHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
    this.fire('resize');
  }

  scheduleRender() {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this._draw();
    });
  }

  render() {
    this.scheduleRender();
  }

  _snapCanvasToPixelGrid() {
    const currentTransform = this.ctx.getTransform();
    const physicalTranslateX = currentTransform.e * this.dpr;
    const physicalTranslateY = currentTransform.f * this.dpr;
    const snapX = - (physicalTranslateX % 1) / this.dpr;
    const snapY = - (physicalTranslateY % 1) / this.dpr;
    this.ctx.translate(snapX, snapY);
  }

  _draw() {
    const backgroundColor = this._baseLayer ? this._baseLayer.getBackground() : '#000';
    const w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, w, h);

    for (const layer of this._layers) {
      layer.render();
    }

    for (const overlay of this._overlays) {
      overlay.render();
    }

    this._snapCanvasToPixelGrid();

    let loadingCount = 0;
    if (this._baseLayer && this._baseLayer instanceof Atlas.TileLayer) {
      loadingCount = this._baseLayer.loadingTiles.size;
    }
    this.loadingEl.classList.toggle("visible", loadingCount > 0);
    this.loadingCountEl.textContent = loadingCount;
    this.coordsEl.textContent = `${this.center.lat.toFixed(6)}°, ${this.center.lon.toFixed(6)}° | Z: ${this.zoom.toFixed(2)} | Bearing: ${(this.bearing * RAD2DEG).toFixed(1)}° | Layer: ${this._baseLayer ? 'Custom' : 'None'}`;

    this.updateControlsUI();
    this.fire('moveend');
  }

  updateAttribution() {
    for (const control of this._controls) {
      if (control instanceof Atlas.AttributionControl && typeof control._update === 'function') {
        control._update();
      }
    }
  }

  updateControlsUI() {
    for (const control of this._controls) {
      if (typeof control._update === 'function') {
        control._update();
      }
    }
  }

  getCenter() {
    return { ...this.center };
  }

  getZoom() {
    return this.zoom;
  }

  getBearing() {
    return this.bearing;
  }

  // --- UPDATED: screenToLatLon (now uses Projection) ---
  screenToLatLon(ax, ay, zoom = this.zoom, bearing = this.bearing, center = this.center) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const zInt = Math.floor(zoom);
    const ts = TILE_SIZE * Math.pow(2, zoom - zInt);
    const ct = this.projection.latLngToTile(center, zInt);
    const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
    const v = rot(anchorVec.x / ts, anchorVec.y / ts, -bearing);
    const tpt = { x: ct.x + v.x, y: ct.y + v.y };
    const ll = this.projection.tileToLatLng(tpt.x, tpt.y, zInt);
    return {
      lon: GISUtils.wrapLongitude(ll.lon),
      lat: GISUtils.clampLatitude(ll.lat)
    };
  }

  // --- UPDATED: lonLatToTile (now uses Projection) ---
  // This is kept for backward compatibility but delegates to the projection.
  lonLatToTile(lon, lat, z) {
    return this.projection.latLngToTile({ lat, lon }, z);
  }

  // --- UPDATED: latLngToContainerPoint (now uses Projection) ---
  latLngToContainerPoint(latlng) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const zInt = Math.floor(this.zoom);
    const ts = TILE_SIZE * Math.pow(2, this.zoom - zInt);
    const ct = this.projection.latLngToTile(this.center, zInt);
    const pt = this.projection.latLngToTile(latlng, zInt);
    const trX = (pt.x - ct.x) * ts;
    const trY = (pt.y - ct.y) * ts;
    const anchorVec = rot(trX, trY, this.bearing);
    const screenX = w / 2 + anchorVec.x;
    const screenY = h / 2 + anchorVec.y;
    return { x: screenX, y: screenY };
  }

  applyZoomRotateAbout(ax, ay, newZoom, newBearing, anchorLL = null) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
    const currAnchorLL = anchorLL || this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
    const zInt = Math.floor(newZoom);
    const ts = TILE_SIZE * Math.pow(2, newZoom - zInt);
    const Ptile = this.projection.latLngToTile(currAnchorLL, zInt);
    const v = rot(anchorVec.x / ts, anchorVec.y / ts, -newBearing);
    const ctNew = { x: Ptile.x - v.x, y: Ptile.y - v.y };
    const newCenter = this.projection.tileToLatLng(ctNew.x, ctNew.y, zInt);
    this.center = {
      lon: GISUtils.wrapLongitude(newCenter.lon),
      lat: GISUtils.clampLatitude(newCenter.lat)
    };
    this.zoom = newZoom;
    this.bearing = normalizeAngle(newBearing);
  }

  showZoomIndicator(x, y) {
    if (this._zoomIndicator) {
      this.container.removeChild(this._zoomIndicator);
    }
    const indicator = document.createElement("div");
    indicator.style.position = "absolute";
    indicator.style.left = (x - 15) + "px";
    indicator.style.top = (y - 15) + "px";
    indicator.style.width = "30px";
    indicator.style.height = "30px";
    indicator.style.borderRadius = "50%";
    indicator.style.border = "2px solid #333";
    indicator.style.opacity = "0.8";
    indicator.style.pointerEvents = "none";
    indicator.style.zIndex = "100";
    indicator.style.animation = "zoom-indicator 0.6s ease-out forwards";
    this.container.appendChild(indicator);
    this._zoomIndicator = indicator;
    setTimeout(() => {
      if (this._zoomIndicator && this._zoomIndicator.parentNode) {
        this.container.removeChild(this._zoomIndicator);
        this._zoomIndicator = null;
      }
    }, 600);
  }

  animateZoomRotateAbout(ax, ay, toZoom, toBearing = this.bearing, duration = WHEEL_ZOOM_DURATION, easing = EASING.easeInOutCubic) {
    this.showZoomIndicator(ax, ay);
    this.stopAnimations();
    const startT = performance.now();
    const sZoom = this.zoom;
    const sBear = this.bearing;
    const deltaBear = shortestAngleDiff(sBear, toBearing);
    const anchorLL = this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
    const step = () => {
      const t = (performance.now() - startT) / Math.max(1, duration);
      const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
      const z = sZoom + (toZoom - sZoom) * p;
      const b = sBear + deltaBear * p;
      this.applyZoomRotateAbout(ax, ay, z, b, anchorLL);
      this.render();
      if (t < 1) {
        this._zoomAnim = { raf: requestAnimationFrame(step) };
      } else {
        this._zoomAnim = null;
        this.updateControlsUI();
        this.fire('zoomend');
      }
    };
    this._zoomAnim = { raf: requestAnimationFrame(step) };
    this.fire('zoomstart');
  }

  smoothZoomAt(ax, ay, deltaZ) {
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const target = Math.max(minZoom, Math.min(maxZoom, this.zoom + deltaZ));
    this.animateZoomRotateAbout(ax, ay, target, this.bearing, WHEEL_ZOOM_DURATION, EASING.easeInOutCubic);
  }

  flyTo({ center, zoom, bearing, duration, easing } = {}) {
    center = center || this.center;
    zoom = zoom || this.zoom;
    bearing = bearing || this.bearing;
    duration = duration || FLYTO_DURATION;
    easing = easing || EASING.easeInOutCubic;
    const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
    const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
    const targetZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    this.stopAnimations();
    const startT = performance.now();
    const sC = { ...this.center };
    const eC = { lon: GISUtils.wrapLongitude(center.lon), lat: center.lat };
    const dLon = wrapDeltaLon(eC.lon - sC.lon);
    const dLat = eC.lat - sC.lat;
    const sZ = this.zoom, eZ = targetZoom;
    const sB = this.bearing, dB = shortestAngleDiff(sB, bearing);
    const step = () => {
      const t = (performance.now() - startT) / Math.max(1, duration);
      const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
      const currentLon = sC.lon + dLon * p;
      this.center = {
        lon: t >= 1 ? GISUtils.wrapLongitude(currentLon) : currentLon,
        lat: GISUtils.clampLatitude(sC.lat + dLat * p)
      };
      this.zoom = sZ + (eZ - sZ) * p;
      this.bearing = normalizeAngle(sB + dB * p);
      this.render();
      if (t < 1) {
        this._flyAnim = { raf: requestAnimationFrame(step) };
      } else {
        this._flyAnim = null;
        this.updateControlsUI();
        this.fire('moveend');
      }
    };
    this._flyAnim = { raf: requestAnimationFrame(step) };
    this.fire('movestart');
    return this;
  }

  // --- Lifecycle ---
  destroy() {
    // Stop all animations
    this.stopAnimations();
    this.stopInertia();

    // Remove all layers
    for (const layer of [...this._layers]) {
      this.removeLayer(layer);
    }

    // Remove all controls
    for (const control of [...this._controls]) {
      this.removeControl(control);
    }

    // Clean up control corners
    for (const corner in this._controlCorners) {
      const container = this._controlCorners[corner];
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
    this._controlCorners = {};

    // Remove all handlers
    for (const name in this._handlers) {
      this.removeHandler(name);
    }

    // Remove all overlays
    for (const overlay of [...this._overlays]) {
      this.removeOverlay(overlay);
    }

    // Clean up error handler
    if (this._errorHandler) {
      this._errorHandler.destroy();
      this._errorHandler = null;
    }

    // Clean up performance monitor
    if (this._performanceMonitor) {
      this._performanceMonitor.destroy();
      this._performanceMonitor = null;
    }

    // Clean up popup manager
    if (this._popupManager) {
      this._popupManager.destroy();
      this._popupManager = null;
    }

    // NEW: Use lifecycle manager for final cleanup
    this._lifecycle.destroy();

    // Clear event listeners
    this._events = {};
    console.log("[Atlas] Instance destroyed cleanly");
  }

  /**
   * Get cleanup status
   */
  getCleanupStatus() {
    return this._lifecycle.getStats();
  }

  /**
   * Verify clean state
   */
  isClean() {
    return this._lifecycle.isClean();
  }

  /**
 * Get error report
 */
  getErrorReport() {
    return this._errorHandler?.getErrorReport() || {};
  }

  /**
 * Enable performance monitoring
 */
  enablePerformanceMonitoring() {
    this._performanceMonitor.setEnabled(true);
    this._performanceMonitor.startFrameCollection();
    return this;
  }

  /**
 * Get performance report
 */
  getPerformanceReport() {
    return this._performanceMonitor.generateReport();
  }

  /**
 * Export performance data
 */
  exportPerformanceData(format = 'json') {
    return this._performanceMonitor.exportMetrics(format);
  }
}
