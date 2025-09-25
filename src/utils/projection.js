import { EARTH_RADIUS, MIN_LATITUDE, MAX_LATITUDE, DEG2RAD, RAD2DEG } from './constants.js';

// Projection classes
export class Projection {
  project(latlng) { throw new Error('project() must be implemented'); }
  unproject(point) { throw new Error('unproject() must be implemented'); }
}
export class WebMercatorProjection extends Projection {
  project(latlng) {
    const d = EARTH_RADIUS;
    const lat = Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, latlng.lat));
    const sin = Math.sin(lat * DEG2RAD);
    return { x: d * latlng.lon * DEG2RAD, y: d * Math.log((1 + sin) / (1 - sin)) / 2 };
  }
  unproject(point) {
    const d = EARTH_RADIUS;
    return { lon: (point.x / d) * RAD2DEG, lat: (2 * Math.atan(Math.exp(point.y / d)) - Math.PI / 2) * RAD2DEG };
  }
  latLngToTile(latlng, zoom) {
    const scale = Math.pow(2, zoom);
    const p = this.project(latlng);
    return { x: (p.x + Math.PI * EARTH_RADIUS) / (2 * Math.PI * EARTH_RADIUS) * scale, y: (Math.PI * EARTH_RADIUS - p.y) / (2 * Math.PI * EARTH_RADIUS) * scale };
  }
  tileToLatLng(x, y, zoom) {
    const scale = Math.pow(2, zoom);
    const p = { x: x / scale * 2 * Math.PI * EARTH_RADIUS - Math.PI * EARTH_RADIUS, y: Math.PI * EARTH_RADIUS - y / scale * 2 * Math.PI * EARTH_RADIUS };
    return this.unproject(p);
  }
}
export const DEFAULT_PROJECTION = new WebMercatorProjection();