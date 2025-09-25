import {LatLng, toLatLng} from './LatLng.js';

export function toLatLngBounds(a, b) {
	if (!a || a instanceof LatLngBounds) {
		return a;
	}
	return new LatLngBounds(a, b);
}

export class LatLngBounds {
	constructor(corner1, corner2) {
		if (corner1) {
			for (let i = 0, len = corner1.length; i < len; i++) {
				this.extend(corner1[i]);
			}
		}
		if (corner2) {
			this.extend(corner2);
		}
	}

	extend(obj) {
		const latLng = toLatLng(obj);
		if (latLng) {
			if (!this._southWest && !this._northEast) {
				this._southWest = new LatLng(latLng.lat, latLng.lng);
				this._northEast = new LatLng(latLng.lat, latLng.lng);
			} else {
				this._southWest.lat = Math.min(latLng.lat, this._southWest.lat);
				this._southWest.lng = Math.min(latLng.lng, this._southWest.lng);
				this._northEast.lat = Math.max(latLng.lat, this._northEast.lat);
				this._northEast.lng = Math.max(latLng.lng, this._northEast.lng);
			}
		} else if (obj instanceof LatLngBounds) {
			this.extend(obj._southWest);
			this.extend(obj._northEast);
		}
		return this;
	}

	getCenter() {
		return new LatLng(
			(this._southWest.lat + this._northEast.lat) / 2,
			(this._southWest.lng + this._northEast.lng) / 2
		);
	}

	getSouthWest() {
		return this._southWest;
	}

	getNorthEast() {
		return this._northEast;
	}

	getNorthWest() {
		return new LatLng(this.getNorth(), this.getWest());
	}

	getSouthEast() {
		return new LatLng(this.getSouth(), this.getEast());
	}

	getWest() {
		return this._southWest.lng;
	}

	getSouth() {
		return this._southWest.lat;
	}

	getEast() {
		return this._northEast.lng;
	}

	getNorth() {
		return this._northEast.lat;
	}

	contains(obj) {
		let latLng = toLatLng(obj);
		if (latLng) {
			return (
				(latLng.lat >= this._southWest.lat) && (latLng.lat <= this._northEast.lat) &&
				(latLng.lng >= this._southWest.lng) && (latLng.lng <= this._northEast.lng)
			);
		}

		latLng = toLatLngBounds(obj);
		if (latLng) {
			return this.contains(latLng._southWest) && this.contains(latLng._northEast);
		}

		return false;
	}

	intersects(other) {
		other = toLatLngBounds(other);
		const sw = this._southWest,
		      ne = this._northEast,
		      sw2 = other._southWest,
		      ne2 = other._northEast;
		const latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat);
		const lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);
		return latIntersects && lngIntersects;
	}

	equals(other, maxMargin) {
		if (!other) { return false; }
		other = toLatLngBounds(other);
		return this._southWest.equals(other.getSouthWest(), maxMargin) &&
		       this._northEast.equals(other.getNorthEast(), maxMargin);
	}

	toBBoxString() {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	}

	isValid() {
		return !!(this._southWest && this._northEast);
	}
}