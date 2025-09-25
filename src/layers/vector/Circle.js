import {Path} from './Path.js';
import {toLatLng} from '../../core/LatLng.js';

export class Circle extends Path {
	constructor(latlng, options, legacyOptions) {
		super(options);
		this._latlng = toLatLng(latlng);
		this._mRadius = legacyOptions ? legacyOptions.radius : options.radius;
	}

	setLatLng(latlng) {
		this._latlng = toLatLng(latlng);
		return this.redraw();
	}

	setRadius(radius) {
		this._mRadius = radius;
		return this.redraw();
	}

	getLatLng() {
		return this._latlng;
	}

	getRadius() {
		return this._mRadius;
	}

	getBounds() {
		const half = [this._mRadius, this._mRadius];
		return toLatLngBounds(this._map.layerPointToLatLng(this._point.subtract(half)), this._map.layerPointToLatLng(this._point.add(half)));
	}

	_project() {
		this._point = this._map.latLngToLayerPoint(this._latlng);
		this._radius = this._mRadius;
	}

	_update() {
		if (!this._map) { return; }
		this._map._renderer.updateCircle(this);
	}

	onAdd(map) {
		this._map = map;
		if (!this._map._renderer) {
			this._map._renderer = new Canvas();
			this._map.addLayer(this._map._renderer);
		}
		this._project();
		this._update();
	}

	onRemove() {
		this._map._renderer.removePath(this);
	}
}