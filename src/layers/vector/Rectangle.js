import {Polygon} from './Polygon.js';
import {toLatLngBounds} from '../../core/LatLngBounds.js';

export class Rectangle extends Polygon {
	constructor(latLngBounds, options) {
		super(latLngBounds, options);
		this._latLngBounds = toLatLngBounds(latLngBounds);
	}

	setBounds(latLngBounds) {
		this._latLngBounds = toLatLngBounds(latLngBounds);
		this.setLatLngs(this._boundsToLatLngs(this._latLngBounds));
	}

	_boundsToLatLngs(latLngBounds) {
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
}