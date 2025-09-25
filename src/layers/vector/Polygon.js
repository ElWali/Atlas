import {Polyline} from './Polyline.js';
import {toLatLng} from '../../core/LatLng.js';

export class Polygon extends Polyline {
	constructor(latlngs, options) {
		super(latlngs, options);
		this.options.fill = true;
	}

	getLatLngs() {
		return this._latlngs;
	}

	setLatLngs(latlngs) {
		this._latlngs = this._convertLatLngs(latlngs);
		this.redraw();
	}

	_convertLatLngs(latlngs) {
		const result = [];
		for (let i = 0, len = latlngs.length; i < len; i++) {
			result[i] = Array.isArray(latlngs[i]) ? this._convertLatLngs(latlngs[i]) : toLatLng(latlngs[i]);
		}
		return result;
	}

	_update() {
		if (!this._map) { return; }
		this._map._renderer.updatePolygon(this);
	}
}