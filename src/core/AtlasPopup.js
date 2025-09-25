// AtlasPopup - Classic Google Maps Info Window
export class AtlasPopup {
  constructor(content, options = {}) {
    this.content = content;
    this.options = {
      maxWidth: options.maxWidth || 300,
      minWidth: options.minWidth || 150,
      closeButton: options.closeButton !== undefined ? options.closeButton : true,
      ...options
    };
    this._map = null;
    this._element = null;
    this._isOpen = false;
    this._latlng = null;
    this._events = {};
    this._onCloseClick = this._onCloseClick.bind(this);
  }
  addTo(map) {
    this._map = map;
    this._createPopupElement();
    return this;
  }
  remove() {
    if (this._element && this._element.parentNode) {
      this._element.parentNode.removeChild(this._element);
    }
    this._map = null;
    this._isOpen = false;
    return this;
  }
  setLatLng(latlng) {
    this._latlng = { lat: latlng.lat, lon: latlng.lon };
    if (this._map && this._isOpen) {
      this._updatePosition();
    }
    return this;
  }
  getLatLng() {
    return this._latlng ? { ...this._latlng } : null;
  }
  setContent(content) {
    this.content = content;
    if (this._element) {
      this._updateContent();
    }
    return this;
  }
  open() {
    if (!this._map || !this._latlng) return this;
    if (!this._element) {
      this._createPopupElement();
    }
    if (!this._element.parentNode) {
      this._map.container.appendChild(this._element);
    }
    this._updatePosition();
    this._element.style.display = 'block';
    this._isOpen = true;
    this.fire('open');
    return this;
  }
  close() {
    if (this._element) {
      this._element.style.display = 'none';
      this._isOpen = false;
      this.fire('close');
    }
    return this;
  }
  isOpen() {
    return this._isOpen;
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
  _createPopupElement() {
    this._element = document.createElement('div');
    this._element.className = 'atlas-popup';
    this._element.style.display = 'none';
    this._element.style.maxWidth = this.options.maxWidth + 'px';
    this._element.style.minWidth = this.options.minWidth + 'px';
    // Create content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'atlas-popup-content';
    // Set content
    if (typeof this.content === 'string') {
      contentDiv.innerHTML = this.content;
    } else if (this.content instanceof HTMLElement) {
      contentDiv.appendChild(this.content);
    } else {
      contentDiv.textContent = String(this.content);
    }
    this._element.appendChild(contentDiv);
    // Add close button if enabled
    if (this.options.closeButton) {
      const closeButton = document.createElement('button');
      closeButton.className = 'atlas-popup-close';
      closeButton.innerHTML = '&times;';
      closeButton.setAttribute('aria-label', 'Close');
      closeButton.addEventListener('click', this._onCloseClick);
      this._element.appendChild(closeButton);
    }
    // Add tip (triangle pointing down)
    const tip = document.createElement('div');
    tip.className = 'atlas-popup-tip';
    this._element.appendChild(tip);
  }
  _updateContent() {
    const contentDiv = this._element.querySelector('.atlas-popup-content');
    if (contentDiv) {
      // Clear existing content
      contentDiv.innerHTML = '';
      // Set new content
      if (typeof this.content === 'string') {
        contentDiv.innerHTML = this.content;
      } else if (this.content instanceof HTMLElement) {
        contentDiv.appendChild(this.content);
      } else {
        contentDiv.textContent = String(this.content);
      }
    }
  }
  _updatePosition() {
    if (!this._map || !this._element || !this._latlng) return;
    const point = this._map.latLngToContainerPoint(this._latlng);
    // Position the popup above the marker
    this._element.style.left = point.x + 'px';
    this._element.style.top = (point.y - 10) + 'px'; // 10px above marker tip
  }
  _onCloseClick(e) {
    e.stopPropagation();
    this.close();
  }
}