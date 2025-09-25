import { EARTH_CIRCUMFERENCE, TILE_SIZE, DEG2RAD, MIN_LATITUDE, MAX_LATITUDE } from './constants.js';

// GIS utilities
export class GISUtils {
  static wrapLongitude(l) { while (l > 180) l -= 360; while (l < -180) l += 360; return l; }
  static clampLatitude(lat) { return Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, lat)); }
  // meters per pixel at given latitude & zoom
  static getResolution(lat, z) { return (EARTH_CIRCUMFERENCE * Math.cos(lat * DEG2RAD)) / (Math.pow(2, z) * TILE_SIZE); }
  static formatDistance(m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km"; }
}