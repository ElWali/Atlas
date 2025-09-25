import { Control } from './Control.js';
import { AtlasMarker } from '../core/AtlasMarker.js';

// Geolocation control
export class GeolocationControl extends Control {
  constructor(options = {}) {
    super(options);
    this.options = {
      ...this.options,
      title: options.title || 'My location',
      markerOptions: options.markerOptions || {
        title: 'My Location',
        draggable: false,
      },
    };
    this._marker = null;
  }

  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-geolocation-control';

    const geolocateBtn = document.createElement('button');
    geolocateBtn.className = 'control-btn';
    geolocateBtn.title = this.options.title;
    geolocateBtn.setAttribute('aria-label', this.options.title);
    geolocateBtn.innerHTML = '&#9737;'; // Target symbol
    geolocateBtn.tabIndex = 0;

    const handler = () => {
      if (this._map) {
        this._map.locate();
      }
    };

    geolocateBtn.addEventListener('click', handler);
    geolocateBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });

    container.appendChild(geolocateBtn);
    this._geolocateBtn = geolocateBtn;
    this._addDomListener(geolocateBtn, 'click', handler);

    this._map.on('locationfound', (e) => {
      this.onLocationFound(e);
    });

    this._map.on('locationerror', (e) => {
      this.onLocationError(e);
    });

    return container;
  }

  onLocationFound(e) {
    if (this._marker) {
      this._marker.setLatLng(e.latlng);
    } else {
      this._marker = new AtlasMarker(e.latlng, this.options.markerOptions).addTo(this._map);
    }
  }

  onLocationError(e) {
    // You can handle location errors here, e.g., by showing a message to the user.
    console.error(e.message);
  }

  onRemove() {
    if (this._marker) {
      this._marker.remove();
      this._marker = null;
    }
  }
}