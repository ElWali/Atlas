import {Circle} from './Circle.js';

export class CircleMarker extends Circle {
	setRadius(radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	}

	_project() {
		this._point = this._map.latLngToLayerPoint(this._latlng);
	}
}