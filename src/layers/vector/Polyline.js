import {Path} from './Path.js';
import {toLatLngBounds} from '../../core/LatLngBounds.js';
import {toLatLng} from '../../core/LatLng.js';

export class Polyline extends Path {
	constructor(latlngs, options) {
		super(options);
		this._latlngs = this._convertLatLngs(latlngs);
	}

	getLatLngs() {
		return this._latlngs;
	}

	setLatLngs(latlngs) {
		this._latlngs = this._convertLatLngs(latlngs);
		return this.redraw();
	}

	addLatLng(latlng) {
		this._latlngs.push(toLatLng(latlng));
		return this.redraw();
	}

	getBounds() {
		return toLatLngBounds(this._latlngs);
	}

	_convertLatLngs(latlngs) {
		const result = [];
		for (let i = 0, len = latlngs.length; i < len; i++) {
			result[i] = toLatLng(latlngs[i]);
		}
		return result;
	}

	redraw() {
		if (this._map) {
			this._project();
			this._update();
		}
		return this;
	}

	_project() {
		this._points = [];
		for (let i = 0, len = this._latlngs.length; i < len; i++) {
			this._points[i] = this._map.latLngToLayerPoint(this._latlngs[i]);
		}
	}

	_update() {
		if (!this._map) { return; }
		this._map._renderer.updatePoly(this);
	}

	onAdd(map) {
		this._map = map;
		this.options.renderer = this._map._renderer;
		this._project();
		this._update();
	}

	onRemove() {
		this._map._renderer.removePath(this);
	}
}