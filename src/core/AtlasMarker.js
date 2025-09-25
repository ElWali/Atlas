import { AtlasPopup } from './AtlasPopup.js';

// AtlasMarker - Classic Google Maps Red Marker
export class AtlasMarker {
  constructor(latlng, options = {}) {
    this.latlng = { lat: latlng.lat, lon: latlng.lon };
    this.options = {
      title: options.title || '',
      draggable: options.draggable || false,
      icon: options.icon || null,
      ...options
    };
    this._map = null;
    this._element = null;
    this._popup = null;
    this._isDragging = false;
    this._dragStart = null;
    this._events = {};
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onClick = this._onClick.bind(this);
  }
  addTo(map) {
    this._map = map;
    this._createMarkerElement();
    this._updatePosition();
    this._map.container.appendChild(this._element);
    return this;
  }
  remove() {
    if (this._element && this._element.parentNode) {
      this._element.parentNode.removeChild(this._element);
    }
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
    }
    this._map = null;
    return this;
  }
  setLatLng(latlng) {
    this.latlng = { lat: latlng.lat, lon: latlng.lon };
    if (this._map) {
      this._updatePosition();
    }
    return this;
  }
  getLatLng() {
    return { ...this.latlng };
  }
  bindPopup(content, options = {}) {
    if (this._popup) {
      this._popup.remove();
    }
    this._popup = new AtlasPopup(content, options);
    this._popup.addTo(this._map);
    this._popup.setLatLng(this.latlng);
    // Bind click event to open popup
    this.on('click', () => {
      this._popup.open();
    });
    return this;
  }
  unbindPopup() {
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
    }
    return this;
  }
  openPopup() {
    if (this._popup) {
      this._popup.open();
    }
    return this;
  }
  closePopup() {
    if (this._popup) {
      this._popup.close();
    }
    return this;
  }
  on(type, fn) {
    if (!this._events[type]) this._events[type] = [];
    this._events[type].push(fn);
    return this;
  }
  off(type, fn) {
    if (!this._events[type]) return this;
    this._events[type] = this._events[type].filter(cb => cb !== fn);
    return this;
  }
  fire(type, data = {}) {
    if (!this._events[type]) return;
    data.type = type;
    data.target = this;
    this._events[type].forEach(fn => fn(data));
  }
  _createMarkerElement() {
    this._element = document.createElement('div');
    this._element.className = 'atlas-marker';
    if (this.options.icon) {
      this._element.style.backgroundImage = `url(${this.options.icon})`;
      this._element.style.width = this.options.iconSize ? `${this.options.iconSize[0]}px` : '24px';
      this._element.style.height = this.options.iconSize ? `${this.options.iconSize[1]}px` : '36px';
      this._element.style.backgroundSize = 'cover';
    } else {
      // Create classic Google Maps red marker
      const markerSvg = `
            <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0zm0 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill="${this.options.color || '#d50000'}"/>
              <circle cx="12" cy="12" r="2" fill="#ffffff"/>
            </svg>
          `;
      this._element.innerHTML = markerSvg;
    }
    this._element.style.cursor = this.options.draggable ? 'move' : 'pointer';
    if (this.options.title) {
      this._element.title = this.options.title;
    }
    // Add event listeners
    this._element.addEventListener('mousedown', this._onMouseDown);
    this._element.addEventListener('click', this._onClick);
  }
  _updatePosition() {
    if (!this._map || !this._element) return;
    const point = this._map.latLngToContainerPoint(this.latlng);
    this.setPos(point);
  }
  setPos(pos) {
    this._element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  }
  _onMouseDown(e) {
    if (!this.options.draggable || e.button !== 0) return;
    e.preventDefault();
    this._isDragging = true;
    this._dragStart = {
      x: e.clientX,
      y: e.clientY,
      lat: this.latlng.lat,
      lon: this.latlng.lon
    };
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    this._element.style.cursor = 'grabbing';
    this.fire('dragstart', { originalEvent: e });
  }
  _onMouseMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - this._dragStart.x;
    const deltaY = e.clientY - this._dragStart.y;
    // Convert pixel movement to lat/lng
    const currentPoint = this._map.latLngToContainerPoint(this.latlng);
    const newPoint = {
      x: currentPoint.x + deltaX,
      y: currentPoint.y + deltaY
    };
    const newLatLng = this._map.screenToLatLon(newPoint.x, newPoint.y);
    this.latlng = { lat: newLatLng.lat, lon: newLatLng.lon };
    this._updatePosition();
    if (this._popup) {
      this._popup.setLatLng(this.latlng);
    }
    this.fire('drag', { originalEvent: e, latlng: this.latlng });
  }
  _onMouseUp(e) {
    if (!this._isDragging) return;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this._isDragging = false;
    this._dragStart = null;
    this._element.style.cursor = 'move';
    this.fire('dragend', { originalEvent: e, latlng: this.latlng });
  }
  _onClick(e) {
    this.fire('click', { originalEvent: e });
  }
}