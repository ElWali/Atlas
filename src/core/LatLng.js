import { EARTH_RADIUS } from '../utils/constants.js';

export function toLatLng(a, b) {
	if (a instanceof LatLng) {
		return a;
	}
	if (Array.isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new LatLng(a, b);
}

export class LatLng {
	constructor(lat, lng, alt) {
		if (isNaN(lat) || isNaN(lng)) {
			throw new Error(`Invalid LatLng object: (${lat}, ${lng})`);
		}
		this.lat = +lat;
		this.lng = +lng;
		if (alt !== undefined) {
			this.alt = +alt;
		}
	}

	equals(other, maxMargin) {
		if (!other) { return false; }
		other = toLatLng(other);
		const margin = Math.max(
		        Math.abs(this.lat - other.lat),
		        Math.abs(this.lng - other.lng));
		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	}

	toString() {
		return `LatLng(${this.lat}, ${this.lng})`;
	}

	distanceTo(other) {
		other = toLatLng(other);
		const R = EARTH_RADIUS;
		const dLat = (other.lat - this.lat) * (Math.PI / 180);
		const dLon = (other.lng - this.lng) * (Math.PI / 180);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.lat * (Math.PI / 180)) * Math.cos(other.lat * (Math.PI / 180)) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	wrap() {
		const lng = this.lng;
		this.lng = (lng + 180) % 360;
		if (this.lng < 0) {
			this.lng += 360;
		}
		this.lng -= 180;
		return this;
	}

	clone() {
		return new LatLng(this.lat, this.lng, this.alt);
	}
}