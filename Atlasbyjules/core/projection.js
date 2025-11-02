// --- NEW: Projection System ---
// Base Projection Class
const Atlas = window.Atlas || {};
Atlas.Projection = class {
  // Transforms a geographical coordinate (lat, lon) into a 2D point (x, y) in the projection's coordinate space.
  project(latlng) {
    throw new Error('project() must be implemented by subclass');
  }

  // Transforms a 2D point (x, y) in the projection's coordinate space back into a geographical coordinate (lat, lon).
  unproject(point) {
    throw new Error('unproject() must be implemented by subclass');
  }
}

// Web Mercator Projection (EPSG:3857)
// This is the standard projection used by most web maps (Google Maps, OpenStreetMap, etc.).
class WebMercatorProjection extends Projection {
  constructor() {
    super();
  }

  // Converts a LatLng object to a Point in Web Mercator meters.
  project(latlng) {
    const d = EARTH_RADIUS;
    const maxLat = MAX_LATITUDE;
    const lat = Math.max(Math.min(maxLat, latlng.lat), -maxLat);
    const sin = Math.sin(lat * DEG2RAD);
    return {
      x: d * latlng.lon * DEG2RAD,
      y: d * Math.log((1 + sin) / (1 - sin)) / 2
    };
  }

  // Converts a Point in Web Mercator meters back to a LatLng object.
  unproject(point) {
    const d = EARTH_RADIUS;
    return {
      lon: (point.x / d) * RAD2DEG,
      lat: (2 * Math.atan(Math.exp(point.y / d)) - (Math.PI / 2)) * RAD2DEG
    };
  }

  // Converts a LatLng object to a Tile coordinate at a specific zoom level.
  // This is a convenience method that chains project() and the scale calculation.
  latLngToTile(latlng, zoom) {
    const scale = Math.pow(2, zoom);
    const projected = this.project(latlng);
    return {
      x: (projected.x + Math.PI * EARTH_RADIUS) / (2 * Math.PI * EARTH_RADIUS) * scale,
      y: (Math.PI * EARTH_RADIUS - projected.y) / (2 * Math.PI * EARTH_RADIUS) * scale
    };
  }

  // Converts a Tile coordinate at a specific zoom level back to a LatLng object.
  // This is a convenience method that chains the scale calculation and unproject().
  tileToLatLng(x, y, zoom) {
    const scale = Math.pow(2, zoom);
    const projected = {
      x: x / scale * 2 * Math.PI * EARTH_RADIUS - Math.PI * EARTH_RADIUS,
      y: Math.PI * EARTH_RADIUS - y / scale * 2 * Math.PI * EARTH_RADIUS
    };
    return this.unproject(projected);
  }
}

// Create a global instance of the default projection.
const DEFAULT_PROJECTION = new WebMercatorProjection();
