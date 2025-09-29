/**
 * @fileoverview Atlas.js - A JavaScript mapping library.
 * @version 0.0.1
 * @license MIT
 */
// --- src/core/Emitter.js ---
/**
 * @fileoverview Core Event System for Atlas.js.
 * @class Emitter
 * @description Provides a simple publish/subscribe mechanism for event handling.
 */
class Emitter {
  constructor() {
    /**
     * @private
     * @type {Object.<string, Array.<{cb: Function, ctx: Object}>}
     * @description Stores event listeners.
     */
    this._events = {};
  }
  /**
   * Registers an event listener.
   * @param {string} e - The event name.
   * @param {Function} cb - The callback function.
   * @param {Object} [ctx] - The context (`this`) for the callback.
   * @returns {Emitter} This Emitter instance for chaining.
   */
  on(e, cb, ctx) {
    (this._events[e] ??= []).push({ cb, ctx });
    return this;
  }
  /**
   * Registers an event listener that will be invoked only once.
   * @param {string} e - The event name.
   * @param {Function} cb - The callback function.
   * @param {Object} [ctx] - The context (`this`) for the callback.
   * @returns {Emitter} This Emitter instance for chaining.
   */
  once(e, cb, ctx) {
    const onceWrapper = (data) => {
      cb.call(ctx, data);
      this.off(e, onceWrapper);
    };
    return this.on(e, onceWrapper, ctx);
  }
  /**
   * Unregisters an event listener, or all listeners for a given event.
   * @param {string} e - The event name.
   * @param {Function} [cb] - The specific callback function to unregister. If omitted, all listeners for `e` are removed.
   * @returns {Emitter} This Emitter instance for chaining.
   */
  off(e, cb) {
    if (!this._events[e]) return this;
    if (!cb) {
      delete this._events[e];
      return this;
    }
    this._events[e] = this._events[e].filter(f => f.cb !== cb);
    return this;
  }
  /**
   * Emits an event, invoking all registered listeners.
   * @param {string} e - The event name.
   * @param {*} [data] - The data to pass to the callback functions.
   * @returns {Emitter} This Emitter instance for chaining.
   */
  emit(e, data) {
    (this._events[e] || []).forEach(({ cb, ctx }) => {
      try {
        cb.call(ctx, data);
      } catch (error) {
        console.error(`Error in event listener for \'${e}\':`, error);
      }
    });
    return this;
  }
  /**
   * Alias for `emit`.
   * @param {string} e - The event name.
   * @param {*} [data] - The data to pass to the callback functions.
   * @returns {Emitter} This Emitter instance for chaining.
   */
  fire(e, data) {
    return this.emit(e, data);
  }
}
// --- src/utils/index.js ---
/**
 * @fileoverview General utility functions for Atlas.js.
 */
/**
 * The device pixel ratio.
 * @type {number}
 */
const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
/**
 * Returns a high-resolution timestamp.
 * @returns {number}
 */
const now = () => performance ? performance.now() : Date.now();
/**
 * Clamps a value between a minimum and maximum.
 * @param {number} v - The value to clamp.
 * @param {number} a - The minimum value.
 * @param {number} b - The maximum value.
 * @returns {number}
 */
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
/**
 * Wraps a value within a given range.
 * @param {number} v - The value to wrap.
 * @param {number} a - The minimum value of the range.
 * @param {number} b - The maximum value of the range.
 * @returns {number}
 */
const wrap = (v, a, b) => a + (((v - a) % (b - a) + (b - a)) % (b - a));
/**
 * Normalizes a longitude to be within the range [-180, 180].
 * @param {number} l - The longitude to normalize.
 * @returns {number}
 */
const normalizeLng = l => wrap(l, -180, 180);
/**
 * Cubic ease-out function for animations.
 * @param {number} t - The input value, typically between 0 and 1.
 * @returns {number}
 */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
/**
 * Calculates the Euclidean distance between two 2D points.
 * @param {number[]} a - The first point [x, y].
 * @param {number[]} b - The second point [x, y].
 * @returns {number}
 */
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/**
 * Earth\'s radius in meters.
 * @type {number}
 */
const EARTH_RADIUS = 6378137;
/**
 * Circumference of the Earth at the equator.
 * @type {number}
 */
const CIRC = 2 * Math.PI * EARTH_RADIUS;
/**
 * Converts a hexadecimal color string to an RGB array (normalized to 0-1).
 * @param {string} hex - The hexadecimal color string (e.g., \'#RRGGBB\' or \'RRGGBB\').
 * @returns {number[]} An array [r, g, b] where each component is between 0 and 1.
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : [0.5, 0.5, 0.5];
}
// --- src/geo/CRS.js ---
/**
 * @fileoverview Coordinate Reference Systems for Atlas.js.
 * @module geo/CRS
 */
/**
 * @class CRS
 * @description Provides static methods for different Coordinate Reference Systems.
 */
class CRS {
  /**
   * EPSG:3857 (Web Mercator) projection.
   * @static
   * @property {Object} EPSG3857
   * @property {Function} EPSG3857.project - Projects longitude and latitude to Web Mercator x, y.
   * @property {Function} EPSG3857.unproject - Unprojects Web Mercator x, y to longitude and latitude.
   */
  static EPSG3857 = {
    /**
     * Projects longitude and latitude to Web Mercator x, y.
     * @param {number} lng - Longitude in degrees.
     * @param {number} lat - Latitude in degrees.
     * @returns {number[]} Projected [x, y] coordinates in meters.
     */
    project: (lng, lat) => {
      const x = lng * CIRC / 360;
      const latRad = lat * Math.PI / 180;
      // Clamp latitude to avoid infinity issues near poles in Web Mercator
      const y = Math.log(Math.tan(Math.PI / 4 + clamp(latRad, -Math.PI / 2 + 1e-10, Math.PI / 2 - 1e-10) / 2)) * EARTH_RADIUS;
      return [x, y];
    },
    /**
     * Unprojects Web Mercator x, y to longitude and latitude.
     * @param {number} x - X coordinate in meters.
     * @param {number} y - Y coordinate in meters.
     * @returns {number[]} Unprojected [longitude, latitude] in degrees.
     */
    unproject: (x, y) => {
      const lng = x * 360 / CIRC;
      const lat = 90 - 2 * Math.atan(Math.exp(-y / EARTH_RADIUS)) * 180 / Math.PI;
      return [lng, lat];
    }
  };
  /**
   * EPSG:4326 (WGS84) geographic coordinates.
   * @static
   * @property {Object} EPSG4326
   * @property {Function} EPSG4326.project - Returns longitude and latitude as x, y.
   * @property {Function} EPSG4326.unproject - Returns x, y as longitude and latitude.
   */
  static EPSG4326 = {
    /**
     * Projects longitude and latitude to x, y (returns as is).
     * @param {number} lng - Longitude in degrees.
     * @param {number} lat - Latitude in degrees.
     * @returns {number[]} [longitude, latitude] in degrees.
     */
    project: (lng, lat) => [lng, lat],
    /**
     * Unprojects x, y to longitude and latitude (returns as is).
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @returns {number[]} [longitude, latitude] in degrees.
     */
    unproject: (x, y) => [x, y]
  };
  /**
   * Registers a new Coordinate Reference System.
   * @param {string} name - The name of the CRS (e.g., \'MyCustomCRS\').
   * @param {Object} crsObject - An object containing `project` and `unproject` methods.
   */
  static register(name, crsObject) {
    if (CRS[name]) {
      console.warn(`CRS with name \'${name}\' already exists and will be overwritten.`);
    }
    CRS[name] = crsObject;
  }
}
// --- src/geo/LatLngBounds.js ---
/**
 * @fileoverview Geographic bounding box class for Atlas.js.
 * @module geo/LatLngBounds
 */
/**
 * @class LatLngBounds
 * @description Represents a rectangular geographic bounding box.
 */
class LatLngBounds {
  /**
   * Creates a new LatLngBounds instance.
   * @param {number[]} [southWest] - The south-west corner as [latitude, longitude].
   * @param {number[]} [northEast] - The north-east corner as [latitude, longitude].
   */
  constructor(southWest, northEast) {
    /**
     * @private
     * @type {number[]|null}
     * @description The south-west corner [latitude, longitude].
     */
    this._southWest = southWest ? [...southWest] : null;
    /**
     * @private
     * @type {number[]|null}
     * @description The north-east corner [latitude, longitude].
     */
    this._northEast = northEast ? [...northEast] : null;
  }
  /**
   * Extends the bounds to include a given LatLng point.
   * @param {number[]} latlng - The point to include as [latitude, longitude].
   * @returns {LatLngBounds} This LatLngBounds instance for chaining.
   */
  extend(latlng) {
    if (!this._southWest) {
      this._southWest = [...latlng];
      this._northEast = [...latlng];
    } else {
      this._southWest[0] = Math.min(this._southWest[0], latlng[0]);
      this._southWest[1] = Math.min(this._southWest[1], latlng[1]);
      this._northEast[0] = Math.max(this._northEast[0], latlng[0]);
      this._northEast[1] = Math.max(this._northEast[1], latlng[1]);
    }
    return this;
  }
  /**
   * Returns the south-west corner of the bounds.
   * @returns {number[]} A new array representing the south-west corner [latitude, longitude].
   */
  getSouthWest() {
    return this._southWest ? [...this._southWest] : null;
  }
  /**
   * Returns the north-east corner of the bounds.
   * @returns {number[]} A new array representing the north-east corner [latitude, longitude].
   */
  getNorthEast() {
    return this._northEast ? [...this._northEast] : null;
  }
  /**
   * Returns the center of the bounds.
   * @returns {number[]} The center as [latitude, longitude].
   */
  getCenter() {
    if (!this.isValid()) return null;
    const centerLat = (this._southWest[0] + this._northEast[0]) / 2;
    // Handle longitude crossing the 180th meridian
    let centerLng;
    if (this._northEast[1] < this._southWest[1]) {
      centerLng = normalizeLng((this._southWest[1] + this._northEast[1] + 360) / 2);
    } else {
      centerLng = (this._southWest[1] + this._northEast[1]) / 2;
    }
    return [centerLat, centerLng];
  }
  /**
   * Checks if the bounds contain a given LatLng point.
   * @param {number[]} latlng - The point to check as [latitude, longitude].
   * @returns {boolean}
   */
  contains(latlng) {
    if (!this.isValid()) return false;
    const latContained = latlng[0] >= this._southWest[0] && latlng[0] <= this._northEast[0];
    let lngContained;
    if (this._northEast[1] < this._southWest[1]) {
      // Bounds cross the 180th meridian
      lngContained = latlng[1] >= this._southWest[1] || latlng[1] <= this._northEast[1];
    } else {
      lngContained = latlng[1] >= this._southWest[1] && latlng[1] <= this._northEast[1];
    }
    return latContained && lngContained;
  }
  /**
   * Checks if the bounds are valid (i.e., not empty).
   * @returns {boolean}
   */
  isValid() {
    return !!this._southWest;
  }
  /**
   * Returns the bounds as a BBox string (minLng,minLat,maxLng,maxLat).
   * @returns {string}
   */
  toBBoxString() {
    if (!this.isValid()) return "";
    // Note: BBox string typically expects minLng,minLat,maxLng,maxLat
    // The current implementation uses [lat, lng] for internal storage.
    // Adjusting to [lng, lat] for output.
    const minLng = this._southWest[1];
    const minLat = this._southWest[0];
    const maxLng = this._northEast[1];
    const maxLat = this._northEast[0];
    // This conversion assumes the bounds do not cross the 180th meridian for simplicity in BBox string.
    // For bounds crossing 180, a more complex representation might be needed or multiple BBoxes.
    return [minLng, minLat, maxLng, maxLat].join(",");
  }
  /**
   * Returns the western longitude of the bounds.
   * @returns {number|null}
   */
  getWest() {
    return this._southWest ? this._southWest[1] : null;
  }
  /**
   * Returns the southern latitude of the bounds.
   * @returns {number|null}
   */
  getSouth() {
    return this._southWest ? this._southWest[0] : null;
  }
  /**
   * Returns the eastern longitude of the bounds.
   * @returns {number|null}
   */
  getEast() {
    return this._northEast ? this._northEast[1] : null;
  }
  /**
   * Returns the northern latitude of the bounds.
   * @returns {number|null}
   */
  getNorth() {
    return this._northEast ? this._northEast[0] : null;
  }
  /**
   * Returns the width of the bounds in degrees of longitude.
   * Handles bounds crossing the 180th meridian.
   * @returns {number|null}
   */
  getWidth() {
    if (!this.isValid()) return null;
    if (this._northEast[1] < this._southWest[1]) {
      return (this._northEast[1] + 360) - this._southWest[1];
    } else {
      return this._northEast[1] - this._southWest[1];
    }
  }
  /**
   * Returns the height of the bounds in degrees of latitude.
   * @returns {number|null}
   */
  getHeight() {
    if (!this.isValid()) return null;
    return this._northEast[0] - this._southWest[0];
  }
  /**
   * Calculates the intersection of this bounds with another bounds.
   * @param {LatLngBounds} otherBounds - The other bounds to intersect with.
   * @returns {LatLngBounds|null} A new LatLngBounds representing the intersection, or null if no intersection.
   */
  intersect(otherBounds) {
    if (!this.isValid() || !otherBounds.isValid()) return null;
    const swLat = Math.max(this.getSouth(), otherBounds.getSouth());
    const swLng = Math.max(this.getWest(), otherBounds.getWest());
    const neLat = Math.min(this.getNorth(), otherBounds.getNorth());
    const neLng = Math.min(this.getEast(), otherBounds.getEast());
    // Check for intersection across the 180th meridian for longitude
    let intersectionLngValid = false;
    if (this.getEast() < this.getWest() || otherBounds.getEast() < otherBounds.getWest()) {
      // At least one of the bounds crosses the 180th meridian
      // This case is complex and might require splitting into two rectangles.
      // For simplicity, this basic intersection might not cover all edge cases perfectly.
      // A more robust solution would involve converting to a common coordinate system or more complex logic.
      // For now, a basic check:
      if (swLng <= neLng || (swLng > neLng && (swLng <= 180 || neLng >= -180))) {
        intersectionLngValid = true;
      }
    } else {
      intersectionLngValid = swLng <= neLng;
    }
    if (swLat < neLat && intersectionLngValid) {
      return new LatLngBounds([swLat, swLng], [neLat, neLng]);
    } else {
      return null;
    }
  }
  /**
   * Calculates the union of this bounds with another bounds.
   * @param {LatLngBounds} otherBounds - The other bounds to unite with.
   * @returns {LatLngBounds} A new LatLngBounds representing the union.
   */
  union(otherBounds) {
    if (!this.isValid()) return otherBounds.isValid() ? otherBounds.clone() : new LatLngBounds();
    if (!otherBounds.isValid()) return this.clone();
    const swLat = Math.min(this.getSouth(), otherBounds.getSouth());
    const swLng = Math.min(this.getWest(), otherBounds.getWest());
    const neLat = Math.max(this.getNorth(), otherBounds.getNorth());
    const neLng = Math.max(this.getEast(), otherBounds.getEast());
    // This union does not explicitly handle the 180th meridian crossing for longitude.
    // If both bounds cross, or one crosses and the other is contained, it might produce a larger than expected union.
    // A more sophisticated union would involve considering the shortest angular distance for longitude.
    return new LatLngBounds([swLat, swLng], [neLat, neLng]);
  }
  /**
   * Creates a clone of this LatLngBounds instance.
   * @returns {LatLngBounds}
   */
  clone() {
    return new LatLngBounds(this.getSouthWest(), this.getNorthEast());
  }
}
// --- src/math/Vec3.js ---
/**
 * @fileoverview 3D Vector class for Atlas.js.
 * @module math/Vec3
 */
/**
 * @class Vec3
 * @description Represents a 3D vector with x, y, and z components.
 */
class Vec3 {
  /**
   * Creates a new Vec3 instance.
   * @param {number} [x=0] - The x-component.
   * @param {number} [y=0] - The y-component.
   * @param {number} [z=0] - The z-component.
   */
  constructor(x = 0, y = 0, z = 0) {
    /** @type {number} */
    this.x = x;
    /** @type {number} */
    this.y = y;
    /** @type {number} */
    this.z = z;
  }
  /**
   * Adds two vectors (static, returns new Vec3).
   * @param {Vec3} a - The first vector.
   * @param {Vec3} b - The second vector.
   * @returns {Vec3} A new Vec3 representing the sum.
   */
  static add(a, b) {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  /**
   * Subtracts two vectors (static, returns new Vec3).
   * @param {Vec3} a - The first vector.
   * @param {Vec3} b - The second vector.
   * @returns {Vec3} A new Vec3 representing the difference.
   */
  static subtract(a, b) {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  /**
   * Multiplies a vector by a scalar (static, returns new Vec3).
   * @param {Vec3} a - The vector.
   * @param {number} s - The scalar.
   * @returns {Vec3} A new Vec3 representing the scaled vector.
   */
  static multiply(a, s) {
    return new Vec3(a.x * s, a.y * s, a.z * s);
  }
  /**
   * Calculates the dot product of two vectors (static).
   * @param {Vec3} a - The first vector.
   * @param {Vec3} b - The second vector.
   * @returns {number} The dot product.
   */
  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  /**
   * Calculates the cross product of two vectors (static, returns new Vec3).
   * @param {Vec3} a - The first vector.
   * @param {Vec3} b - The second vector.
   * @returns {Vec3} A new Vec3 representing the cross product.
   */
  static cross(a, b) {
    return new Vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  /**
   * Calculates the length (magnitude) of a vector (static).
   * @param {Vec3} v - The vector.
   * @returns {number} The length of the vector.
   */
  static length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
  /**
   * Normalizes a vector (static, returns new Vec3).
   * @param {Vec3} v - The vector to normalize.
   * @returns {Vec3} A new Vec3 representing the normalized vector.
   */
  static normalize(v) {
    const len = Vec3.length(v);
    if (len === 0) return new Vec3();
    return new Vec3(v.x / len, v.y / len, v.z / len);
  }
  /**
   * Calculates the distance between two vectors (static).
   * @param {Vec3} a - The first vector.
   * @param {Vec3} b - The second vector.
   * @returns {number} The distance between the vectors.
   */
  static distance(a, b) {
    return Vec3.length(Vec3.subtract(a, b));
  }
  /**
   * Adds another vector to this vector (mutable).
   * @param {Vec3} other - The vector to add.
   * @returns {Vec3} This Vec3 instance for chaining.
   */
  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }
  /**
   * Subtracts another vector from this vector (mutable).
   * @param {Vec3} other - The vector to subtract.
   * @returns {Vec3} This Vec3 instance for chaining.
   */
  subtract(other) {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }
  /**
   * Multiplies this vector by a scalar (mutable).
   * @param {number} s - The scalar.
   * @returns {Vec3} This Vec3 instance for chaining.
   */
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  /**
   * Normalizes this vector (mutable).
   * @returns {Vec3} This Vec3 instance for chaining.
   */
  normalize() {
    const len = Vec3.length(this);
    if (len === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    } else {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
  /**
   * Creates a clone of this Vec3 instance.
   * @returns {Vec3}
   */
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
}
// --- src/math/Mat4.js ---
/**
 * @fileoverview 4x4 Matrix class for Atlas.js.
 * @module math/Mat4
 */
/**
 * @class Mat4
 * @description Represents a 4x4 matrix, primarily used for 3D transformations in WebGA.
 */
class Mat4 {
  /**
   * Creates a new Mat4 instance, initialized as an identity matrix.
   */
  constructor() {
    /**
     * @type {Float32Array}
     * @description The 16 elements of the matrix, stored in column-major order.
     */
    this.elements = new Float32Array(16);
    this.identity();
  }
  /**
   * Sets this matrix to an identity matrix.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  identity() {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }
  /**
   * Sets this matrix to a perspective projection matrix.
   * @param {number} fovy - Field of view in Y direction (in radians).
   * @param {number} aspect - Aspect ratio of the viewport (width / height).
   * @param {number} near - Distance to the near clipping plane.
   * @param {number} far - Distance to the far clipping plane.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const e = this.elements;
    e[0] = f / aspect; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = f; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = (far + near) * nf; e[14] = (2 * far * near) * nf;
    e[3] = 0; e[7] = 0; e[11] = -1; e[15] = 0;
    return this;
  }
  /**
   * Sets this matrix to a look-at view matrix.
   * @param {Vec3} eye - The position of the viewer.
   * @param {Vec3} center - The point the viewer is looking at.
   * @param {Vec3} up - The up direction of the viewer.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  lookAt(eye, center, up) {
    const f = Vec3.normalize(Vec3.subtract(center, eye));
    const s = Vec3.normalize(Vec3.cross(f, up));
    const u = Vec3.cross(s, f);
    const e = this.elements;
    e[0] = s.x; e[4] = s.y; e[8] = s.z; e[12] = -Vec3.dot(s, eye);
    e[1] = u.x; e[5] = u.y; e[9] = u.z; e[13] = -Vec3.dot(u, eye);
    e[2] = -f.x; e[6] = -f.y; e[10] = -f.z; e[14] = Vec3.dot(f, eye);
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }
  /**
   * Translates this matrix by the given amounts.
   * @param {number} x - The translation amount along the x-axis.
   * @param {number} y - The translation amount along the y-axis.
   * @param {number} z - The translation amount along the z-axis.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  translate(x, y, z) {
    const e = this.elements;
    e[12] = e[0] * x + e[4] * y + e[8] * z + e[12];
    e[13] = e[1] * x + e[5] * y + e[9] * z + e[13];
    e[14] = e[2] * x + e[6] * y + e[10] * z + e[14];
    e[15] = e[3] * x + e[7] * y + e[11] * z + e[15];
    return this;
  }
  /**
   * Rotates this matrix around the x-axis.
   * @param {number} angle - The angle of rotation in radians.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  rotateX(angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const e = this.elements;
    const a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7];
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11];
    e[4] = a10 * c + a20 * s; e[5] = a11 * c + a21 * s;
    e[6] = a12 * c + a22 * s; e[7] = a13 * c + a23 * s;
    e[8] = a20 * c - a10 * s; e[9] = a21 * c - a11 * s;
    e[10] = a22 * c - a12 * s; e[11] = a23 * c - a13 * s;
    return this;
  }
  /**
   * Rotates this matrix around the y-axis.
   * @param {number} angle - The angle of rotation in radians.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  rotateY(angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const e = this.elements;
    const a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3];
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11];
    e[0] = a00 * c - a20 * s; e[1] = a01 * c - a21 * s;
    e[2] = a02 * c - a22 * s; e[3] = a03 * c - a23 * s;
    e[8] = a00 * s + a20 * c; e[9] = a01 * s + a21 * c;
    e[10] = a02 * s + a22 * c; e[11] = a03 * s + a23 * c;
    return this;
  }
  /**
   * Rotates this matrix around the z-axis.
   * @param {number} angle - The angle of rotation in radians.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  rotateZ(angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const e = this.elements;
    const a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3];
    const a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7];
    e[0] = a00 * c + a10 * s; e[1] = a01 * c + a11 * s;
    e[2] = a02 * c + a12 * s; e[3] = a03 * c + a13 * s;
    e[4] = a10 * c - a00 * s; e[5] = a11 * c - a01 * s;
    e[6] = a12 * c - a02 * s; e[7] = a13 * c - a03 * s;
    return this;
  }
  /**
   * Scales this matrix by the given amounts.
   * @param {number} x - The scaling factor along the x-axis.
   * @param {number} y - The scaling factor along the y-axis.
   * @param {number} z - The scaling factor along the z-axis.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  scale(x, y, z) {
    const e = this.elements;
    e[0] *= x; e[1] *= x; e[2] *= x; e[3] *= x;
    e[4] *= y; e[5] *= y; e[6] *= y; e[7] *= y;
    e[8] *= z; e[9] *= z; e[10] *= z; e[11] *= z;
    return this;
  }
  /**
   * Multiplies this matrix by another matrix.
   * @param {Mat4} m - The other matrix.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  multiply(m) {
    const ae = this.elements;
    const be = m.elements;
    const te = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      const ai0 = ae[i], ai1 = ae[i + 4], ai2 = ae[i + 8], ai3 = ae[i + 12];
      te[i] = ai0 * be[0] + ai1 * be[1] + ai2 * be[2] + ai3 * be[3];
      te[i + 4] = ai0 * be[4] + ai1 * be[5] + ai2 * be[6] + ai3 * be[7];
      te[i + 8] = ai0 * be[8] + ai1 * be[9] + ai2 * be[10] + ai3 * be[11];
      te[i + 12] = ai0 * be[12] + ai1 * be[13] + ai2 * be[14] + ai3 * be[15];
    }
    this.elements.set(te);
    return this;
  }
  /**
   * Calculates the inverse of this matrix.
   * @returns {Mat4|null} A new Mat4 instance representing the inverse, or null if the matrix is singular.
   */
  inverse() {
    const e = this.elements;
    const
      a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3],
      a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7],
      a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11],
      a30 = e[12], a31 = e[13], a32 = e[14], a33 = e[15];
    const
      b00 = a00 * a11 - a01 * a10,
      b01 = a00 * a12 - a02 * a10,
      b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11,
      b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30,
      b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31,
      b10 = a21 * a33 - a23 * a31,
      b11 = a22 * a33 - a23 * a32;
    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; // Matrix is singular
    det = 1.0 / det;
    const out = new Mat4();
    const o = out.elements;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b08 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  /**
   * Calculates the transpose of this matrix.
   * @returns {Mat4} This Mat4 instance for chaining.
   */
  transpose() {
    const e = this.elements;
    let tmp;
    tmp = e[1]; e[1] = e[4]; e[4] = tmp;
    tmp = e[2]; e[2] = e[8]; e[8] = tmp;
    tmp = e[3]; e[3] = e[12]; e[12] = tmp;
    tmp = e[6]; e[6] = e[9]; e[9] = tmp;
    tmp = e[7]; e[7] = e[13]; e[13] = tmp;
    tmp = e[11]; e[11] = e[14]; e[14] = tmp;
    return this;
  }
}
// --- src/geo/Projection.js ---
/**
 * @fileoverview Projection functions for Atlas.js.
 * @module geo/Projection
 */
/**
 * @class Projection
 * @description Provides static methods for projecting and unprojecting geographic coordinates.
 */
class Projection {
  /**
   * Projects longitude and latitude to pixel coordinates.
   * @param {number} lng - Longitude in degrees.
   * @param {number} lat - Latitude in degrees.
   * @param {number} [z=0] - Zoom level.
   * @param {number} [tileSize=256] - Size of the map tiles in pixels.
   * @param {Object} [crs=CRS.EPSG3857] - The Coordinate Reference System to use.
   * @returns {{x: number, y: number}} Projected pixel coordinates.
   */
  static project(lng, lat, z = 0, tileSize = 256, crs = CRS.EPSG3857) {
    const [x, y] = crs.project(lng, lat);
    const scale = tileSize * Math.pow(2, z) / CIRC;
    return { x: (x + CIRC / 2) * scale, y: -(y + CIRC / 2) * scale };
  }
  /**
   * Unprojects pixel coordinates to longitude and latitude.
   * @param {number} x - X pixel coordinate.
   * @param {number} y - Y pixel coordinate.
   * @param {number} [z=0] - Zoom level.
   * @param {number} [tileSize=256] - Size of the map tiles in pixels.
   * @param {Object} [crs=CRS.EPSG3857] - The Coordinate Reference System to use.
   * @returns {number[]} Unprojected [longitude, latitude] in degrees.
   */
  static unproject(x, y, z = 0, tileSize = 256, crs = CRS.EPSG3857) {
    const scale = tileSize * Math.pow(2, z) / CIRC;
    const px = x / scale - CIRC / 2;
    const py = -y / scale - CIRC / 2;
    return crs.unproject(px, py);
  }
}
// --- src/core/Cache.js ---
/**
 * @fileoverview Cache utility for Atlas.js, using the browser\'s CacheStorage API.
 * @module core/Cache
 */
/**
 * The name of the cache storage.
 * @type {string}
 */
const CACHE_NAME = "atlas-cache";
/**
 * The expiry time for cached assets in milliseconds (24 hours).
 * @type {number}
 */
const CACHE_EXPIRY = 86400000;
/**
 * Caches an asset with a timestamp.
 * @param {string} url - The URL of the asset to cache.
 * @param {Blob|ArrayBuffer|string} data - The data of the asset.
 * @returns {Promise<void>}
 */
async function cacheAsset(url, data) {
  try {
    if (!("caches" in self)) return; // Check if Cache API is supported
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(data, { headers: { "Cache-Timestamp": Date.now().toString() } });
    await cache.put(url, response);
  } catch (e) {
    console.warn("Failed to cache asset:", url, e);
  }
}
/**
 * Retrieves a cached asset if it\'s not expired.
 * @param {string} url - The URL of the asset to retrieve.
 * @returns {Promise<Blob|null>} The cached asset as a Blob, or null if not found or expired.
 */
async function getCachedAsset(url) {
  try {
    if (!("caches" in self)) return null; // Check if Cache API is supported
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (!response) return null;
    const timestamp = response.headers.get("Cache-Timestamp");
    if (timestamp && (Date.now() - parseInt(timestamp)) < CACHE_EXPIRY) {
      return await response.blob();
    } else {
      // Asset expired, delete it from cache
      await cache.delete(url);
      return null;
    }
  } catch (e) {
    console.warn("Failed to retrieve cached asset:", url, e);
    return null;
  }
}
// --- src/layers/Layer.js ---
/**
 * @fileoverview Base Layer class for Atlas.js.
 * @module layers/Layer
 */
/**
 * @class Layer
 * @augments Emitter
 * @description Base class for all map layers.
 */
class Layer extends Emitter {
  constructor() {
    super();
    /**
     * @protected
     * @type {object|null}
     * @description Reference to the map instance this layer is attached to.
     */
    this._map = null;
    /**
     * @protected
     * @type {HTMLElement|null}
     * @description The main DOM container element for this layer.
     */
    this._container = null;
  }
  /**
   * Called when the layer is added to the map.
   * @param {object} map - The map instance.
   * @returns {Layer} This layer instance for chaining.
   */
  onAdd(map) {
    this._map = map;
    /**
     * @event Layer#add
     * @description Fired when the layer is added to the map.
     * @property {object} map - The map instance.
     */
    this.emit("add", map);
    return this;
  }
  /**
   * Called when the layer is removed from the map.
   * @returns {Layer} This layer instance for chaining.
   */
  onRemove() {
    /**
     * @event Layer#remove
     * @description Fired when the layer is removed from the map.
     * @property {object} map - The map instance.
     */
    this.emit("remove", this._map);
    this._map = null;
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    return this;
  }
  /**
   * Returns the main DOM container element of the layer.
   * @returns {HTMLElement|null}
   */
  getContainer() {
    return this._container;
  }
  /**
   * Sets the z-index of the layer container.
   * @param {number} z - The z-index value.
   * @returns {Layer} This layer instance for chaining.
   */
  setZIndex(z) {
    if (this._container) {
      this._container.style.zIndex = z.toString();
    }
    return this;
  }
  /**
   * Returns the current z-index of the layer container.
   * @returns {number}
   */
  getZIndex() {
    return this._container ? parseInt(this._container.style.zIndex, 10) || 0 : 0;
  }
  /**
   * Brings the layer to the front (makes it appear on top of other layers).
   * @returns {Layer} This layer instance for chaining.
   */
  bringToFront() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.appendChild(this._container);
    }
    return this;
  }
  /**
   * Brings the layer to the back (makes it appear below other layers).
   * @returns {Layer} This layer instance for chaining.
   */
  bringToBack() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.insertBefore(this._container, this._container.parentNode.firstChild);
    }
    return this;
  }
}
// --- src/layers/TileLayer.js ---
/**
 * @fileoverview TileLayer class for Atlas.js, responsible for displaying map tiles.
 * @module layers/TileLayer
 */
const TILE_LOAD_RETRIES = 3;
const TILE_RETRY_DELAY_MS = 1000;
/**
 * @class TileLayer
 * @augments Emitter
 * @description Displays map tiles from a tile server.
 */
class TileLayer extends Emitter {
  /**
   * Creates a new TileLayer instance.
   * @param {string} tpl - The tile URL template (e.g., `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
   * @param {object} [opt={}] - Options for the tile layer.
   * @param {number} [opt.minZoom=0] - Minimum zoom level for the layer.
   * @param {number} [opt.maxZoom=22] - Maximum zoom level for the layer.
   * @param {number} [opt.tileSize=256] - Size of the tiles in pixels.
   * @param {string} [opt.subdomains=\'abc\'] - Subdomains for the tile URL template.
   * @param {boolean} [opt.canvas=false] - Whether to render tiles on a Canvas element.
   * @param {boolean} [opt.updateWhenIdle=false] - Whether to update tiles only when the map is idle.
   * @param {number} [opt.opacity=1] - Opacity of the layer (0-1).
   * @param {number} [opt.zIndex=0] - Z-index of the layer.
   * @param {string} [opt.attribution=\'\'] - Attribution text for the layer.
   */
  constructor(tpl, opt = {}) {
    super();
    /** @type {string} */
    this.tpl = tpl;
    /** @type {object} */
    this.opt = {
      minZoom: 0,
      maxZoom: 22,
      tileSize: 256,
      subdomains: "abc",
      canvas: false,
      updateWhenIdle: false,
      opacity: 1,
      zIndex: 0,
      attribution: "",
      ...opt,
    };
    /**
     * @private
     * @type {Map<string, {img: HTMLImageElement|HTMLCanvasElement, url: string, retries: number}>}
     * @description Stores currently loaded tiles.
     */
    this.tiles = new Map();
    /**
     * @private
     * @type {HTMLElement|null}
     * @description The DOM container for the tiles.
     */
    this._tileContainer = null;
    /**
     * @private
     * @type {Map<string, number>}
     * @description Stores retry counts for failed tile loads.
     */
    this._tileRetries = new Map();
  }
  /**
   * Called when the layer is added to the map.
   * @param {object} map - The map instance.
   */
  onAdd(map) {
    super.onAdd(map);
    this._container = document.createElement("div");
    this._container.className = "atlas-tile";
    Object.assign(this._container.style, {
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: this.opt.zIndex,
      opacity: this.opt.opacity,
    });
    if (this.opt.canvas) {
      this._tileContainer = document.createElement("canvas");
      this._tileContainer.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
      this._container.appendChild(this._tileContainer);
    } else {
      this._tileContainer = document.createElement("div");
      this._tileContainer.style.cssText = "position:absolute;left:0;top:0;";
      this._container.appendChild(this._tileContainer);
    }
    map._canvasContainer.appendChild(this._container);
    map.on("move", () => this._update());
    this._update();
    // Add attribution if present
    if (this.opt.attribution && map.attributionControl) {
      map.attributionControl.addAttribution(this.opt.attribution);
    }
  }
  /**
   * Called when the layer is removed from the map.
   */
  onRemove() {
    this.tiles.forEach((t) => URA.revokeObjectURL(t.url));
    this._container.remove();
    this.tiles.clear();
    // Remove attribution
    if (this.opt.attribution && this._map && this._map.attributionControl) {
      this._map.attributionControl.removeAttribution(this.opt.attribution);
    }
    super.onRemove();
  }
  /**
   * Generates the tile URL from the template.
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @param {number} z - Tile Z (zoom) level.
   * @returns {string} The full tile URA.
   * @private
   */
  _url(x, y, z) {
    let u = this.tpl.replace("{x}", x).replace("{y}", y).replace("{z}", z);
    if (this.opt.subdomains && u.includes("{s}"))
      u = u.replace("{s}", this.opt.subdomains[(x + y) % this.opt.subdomains.length]);
    return u;
  }
  /**
   * Loads a single tile.
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @param {number} z - Tile Z (zoom) level.
   * @private
   */
  async _load(x, y, z) {
    const k = `${x},${y},${z}`;
    if (this.tiles.has(k)) return;
    
    // Increment retry count before attempting the fetch to prevent multiple concurrent retries
    let retries = (this._tileRetries.get(k) || 0) + 1;
    this._tileRetries.set(k, retries);

    if (retries > TILE_LOAD_RETRIES) {
      console.warn(`Failed to load tile ${k} after ${TILE_LOAD_RETRIES} retries.`);
      this._showPlaceholder(x, y, z); // Show placeholder for failed tiles
      return;
    }

    const url = this._url(x, y, z);
    let blob = await getCachedAsset(url);
    if (!blob) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        blob = await response.blob();
        await cacheAsset(url, blob);
        this._tileRetries.delete(k); // Clear retries on success
      } catch (e) {
        console.error(`Error loading tile ${k} from ${url}:`, e);
        // Do NOT increment retries here, already done above
        setTimeout(() => this._load(x, y, z), TILE_RETRY_DELAY_MS * Math.pow(2, retries - 1)); // Exponential backoff
        return;
      }
    }
    const objectURL = URA.createObjectURL(blob);
    if (this.opt.canvas) {
      const canvas = /** @type {HTMLCanvasElement} */ (this._tileContainer);
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = objectURL;
      img.onload = () => {
        ctx.drawImage(
          img,
          x * this.opt.tileSize,
          y * this.opt.tileSize,
          this.opt.tileSize,
          this.opt.tileSize
        );
        URA.revokeObjectURL(objectURL);
      };
      img.onerror = () => {
        console.error(`Failed to draw tile ${k} on canvas.`);
        URA.revokeObjectURL(objectURL);
        this._showPlaceholder(x, y, z); // Show placeholder for canvas draw errors
      };
      this.tiles.set(k, { img: canvas, url: objectURL }); // Store canvas for potential future use
    } else {
      const img = document.createElement("img");
      img.src = objectURL;
      Object.assign(img.style, {
        position: "absolute",
        width: this.opt.tileSize + "px",
        height: this.opt.tileSize + "px",
      });
      img.onload = () => {
        URA.revokeObjectURL(objectURL);
      };
      img.onerror = () => {
        console.error(`Failed to load image tile ${k}.`);
        URA.revokeObjectURL(objectURL);
        this._showPlaceholder(x, y, z); // Show placeholder for image load errors
      };
      this._tileContainer.appendChild(img);
      this.tiles.set(k, { img, url: objectURL });
    }
  }
  /**
   * Displays a placeholder for a tile that failed to load.
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @param {number} z - Tile Z (zoom) level.
   * @private
   */
  _showPlaceholder(x, y, z) {
    const k = `${x},${y},${z}`;
    // Remove any existing tile element if it was partially loaded or failed
    if (this.tiles.has(k)) {
      const existingTile = this.tiles.get(k);
      if (existingTile.img && existingTile.img.parentNode) {
        existingTile.img.parentNode.removeChild(existingTile.img);
      }
      if (existingTile.url) {
        URA.revokeObjectURL(existingTile.url);
      }
      this.tiles.delete(k);
    }
    const placeholder = document.createElement("div");
    placeholder.className = "atlas-tile-placeholder";
    Object.assign(placeholder.style, {
      position: "absolute",
      width: this.opt.tileSize + "px",
      height: this.opt.tileSize + "px",
      backgroundColor: "#e0e0e0", // Light grey background
      border: "1px solid #ccc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#888",
      fontSize: "12px",
      textAlign: "center",
      boxSizing: "border-box",
    });
    placeholder.textContent = `Tile ${z}/${x}/${y} Failed`;
    this._tileContainer.appendChild(placeholder);
    this.tiles.set(k, { img: placeholder, url: "" }); // Store placeholder element
    // Position the placeholder
    const map = this._map;
    if (map) {
      const currentZoom = map._zoom;
      const currentCenter = map._center;
      const w = map.container.clientWidth;
      const h = map.container.clientHeight;
      const projectedCenter = Projection.project(
        currentCenter[0],
        currentCenter[1],
        currentZoom,
        this.opt.tileSize
      );
      // Pre-calculate unprojected coordinates to avoid recalculation in loop
      const unprojectedTileLngLat = Projection.unproject(x * this.opt.tileSize, y * this.opt.tileSize, z, this.opt.tileSize);
      const projectedTile = Projection.project(
        unprojectedTileLngLat[0],
        unprojectedTileLngLat[1],
        currentZoom,
        this.opt.tileSize
      );
      const px = w / 2 + (projectedTile.x - projectedCenter.x);
      const py = h / 2 + (projectedTile.y - projectedCenter.y);
      placeholder.style.transform = `translate(${px}px,${py}px)`;
    }
  }
  /**
   * Updates the visible tiles based on the current map view.
   * @private
   */
  _update() {
    if (this.opt.updateWhenIdle && this._map._moving) return;
    const z = Math.floor(this._map._zoom);
    if (z < this.opt.minZoom || z > this.opt.maxZoom) {
      this._clear();
      return;
    }
    const w = this._map.container.clientWidth;
    const h = this._map.container.clientHeight;
    // Calculate the visible tile grid
    const mapCenterLngLat = this._map._center;
    const mapCenterProjected = Projection.project(mapCenterLngLat[0], mapCenterLngLat[1], z, this.opt.tileSize);
    const viewPortHalfWidth = w / 2;
    const viewPortHalfHeight = h / 2;
    // Calculate the top-left and bottom-right projected coordinates of the viewport
    const tlProjected = {
      x: mapCenterProjected.x - viewPortHalfWidth,
      y: mapCenterProjected.y - viewPortHalfHeight,
    };
    const brProjected = {
      x: mapCenterProjected.x + viewPortHalfWidth,
      y: mapCenterProjected.y + viewPortHalfHeight,
    };
    // Convert projected coordinates to tile coordinates
    const minX = Math.floor(tlProjected.x / this.opt.tileSize);
    const maxX = Math.ceil(brProjected.x / this.opt.tileSize);
    const minY = Math.floor(tlProjected.y / this.opt.tileSize);
    const maxY = Math.ceil(brProjected.y / this.opt.tileSize);
    const neededTiles = new Set();
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const k = `${x},${y},${z}`;
        neededTiles.add(k);
        if (!this.tiles.has(k)) {
          this._load(x, y, z);
        }
        // Position the tile (only for non-canvas mode, canvas handles positioning internally)
        if (!this.opt.canvas) {
          const tile = this.tiles.get(k);
          if (tile && tile.img) {
            // Pre-calculate unprojected coordinates to avoid recalculation in loop
            const unprojectedTileLngLat = Projection.unproject(x * this.opt.tileSize, y * this.opt.tileSize, z, this.opt.tileSize);
            const tileProjected = Projection.project(
              unprojectedTileLngLat[0],
              unprojectedTileLngLat[1],
              this._map._zoom,
              this.opt.tileSize
            );
            const px = w / 2 + (tileProjected.x - mapCenterProjected.x);
            const py = h / 2 + (tileProjected.y - mapCenterProjected.y);
            tile.img.style.transform = `translate(${px}px,${py}px)`;
          }
        }
      }
    }
    // Remove unneeded tiles
    for (const [k, tile] of this.tiles) {
      if (!neededTiles.has(k)) {
        if (tile.img && tile.img.parentNode) {
          tile.img.parentNode.removeChild(tile.img);
        }
        if (tile.url) {
          URA.revokeObjectURL(tile.url);
        }
        this.tiles.delete(k);
        this._tileRetries.delete(k); // Also clear retries for removed tiles
      }
    }
  }
  /**
   * Clears all loaded tiles.
   * @private
   */
  _clear() {
    this.tiles.forEach((t) => {
      if (t.img && t.img.parentNode) {
        t.img.parentNode.removeChild(t.img);
      }
      if (t.url) {
        URA.revokeObjectURL(t.url);
      }
    });
    this.tiles.clear();
    this._tileRetries.clear();
  }
  /**
   * Sets the opacity of the tile layer.
   * @param {number} opacity - The opacity value (0-1).
   * @returns {TileLayer} This TileLayer instance for chaining.
   */
  setOpacity(opacity) {
    this.opt.opacity = opacity;
    if (this._container) this._container.style.opacity = opacity;
    return this;
  }
  /**
   * Returns the current opacity of the tile layer.
   * @returns {number}
   */
  getOpacity() {
    return this.opt.opacity;
  }
  /**
   * Sets a new URL template for the tile layer.
   * @param {string} url - The new tile URL template.
   * @returns {TileLayer} This TileLayer instance for chaining.
   */
  setUrl(url) {
    this.tpl = url;
    this._clear();
    if (this._map) this._update();
    return this;
  }
}
// --- src/webgl/WebGLUtils.js ---
/**
 * @fileoverview Utility functions for WebGL context and shader management.
 * @module webgl/WebGLUtils
 */
/**
 * Creates and compiles a WebGL shader.
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {number} type - The type of shader (e.g., `gl.VERTEX_SHADER`, `gl.FRAGMENT_SHADER`).
 * @param {string} source - The GLSL source code for the shader.
 * @returns {WebGLShader|null} The compiled shader, or null if compilation fails.
 */
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Shader compilation error (${type === gl.VERTEX_SHADER ? \'VERTEX\' : \'FRAGMENT\'}):`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
/**
 * Creates and links a WebGL program from vertex and fragment shaders.
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLShader} vertexShader - The compiled vertex shader.
 * @param {WebGLShader} fragmentShader - The compiled fragment shader.
 * @returns {WebGLProgram|null} The linked program, or null if linking fails.
 */
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
// --- src/webgl/shaders/terrain.vert ---
const terrainVertShader = `
attribute vec3 a_position;
attribute vec3 a_normal;
uniform mat4 u_modelViewMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_exaggeration;
varying vec3 v_normal;
varying vec3 v_position;
void main() {
  vec3 pos = a_position;
  pos.z *= u_exaggeration;
  gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(pos, 1.0);
  v_normal = a_normal;
  v_position = pos;
}
`;
// --- src/webgl/shaders/terrain.frag ---
const terrainFragShader = `
precision mediump float;
uniform vec3 u_lightDirection;
uniform vec3 u_color;
varying vec3 v_normal;
varying vec3 v_position;
void main() {
  vec3 normal = normalize(v_normal);
  float diffuse = max(dot(normal, u_lightDirection), 0.0);
  vec3 color = u_color * (0.3 + 0.7 * diffuse);
  gl_FragColor = vec4(color, 1.0);
}
`;
// --- src/layers/TerrainLayer.js ---
/**
 * @fileoverview TerrainLayer class for Atlas.js, rendering 3D terrain using WebGA.
 * @module layers/TerrainLayer
 */
/**
 * @class TerrainLayer
 * @augments Layer
 * @description Renders 3D terrain using WebGL based on elevation data.
 */
class TerrainLayer extends Layer {
  /**
   * Creates a new TerrainLayer instance.
   * @param {object} [opt={}] - Options for the terrain layer.
   * @param {number[]} [opt.elevationData=null] - A flat array of elevation values.
   * @param {number} [opt.exaggeration=1.0] - Vertical exaggeration factor for the terrain.
   * @param {boolean} [opt.wireframe=false] - Whether to render the terrain as a wireframe.
   * @param {string} [opt.color=\'#777777\'] - Base color of the terrain.
   * @param {WebGLRenderingContext} [opt.glContext=null] - Optional shared WebGL context.
   */
  constructor(opt = {}) {
    super();
    this.opt = {
      elevationData: null,
      exaggeration: 1.0,
      wireframe: false,
      color: "#777777",
      glContext: null, // Allow passing a shared WebGL context
      ...opt,
    };
    /**
     * @private
     * @type {WebGLRenderingContext|null}
     * @description The WebGL rendering context.
     */
    this._gl = null;
    /**
     * @private
     * @type {WebGLProgram|null}
     * @description The WebGL shader program.
     */
    this._program = null;
    /**
     * @private
     * @type {object}
     * @description Stores WebGL buffer objects.
     */
    this._buffers = {};
    /**
     * @private
     * @type {object}
     * @description Stores WebGL texture objects.
     */
    this._textures = {};
    /**
     * @private
     * @type {object|null}
     * @description Stores generated terrain geometry data (positions, normals, indices).
     */
    this._terrainData = null;
    /**
     * @private
     * @type {boolean}
     * @description Flag indicating if terrain data needs to be regenerated.
     */
    this._needsUpdate = true;
    /**
     * @private
     * @type {Vec3}
     * @description Direction of the light source.
     */
    this._lightDirection = Vec3.normalize(new Vec3(0.5, 0.7, 1.0));
    /**
     * @private
     * @type {boolean}
     * @description Flag indicating if the WebGL context has been lost.
     */
    this._contextLost = false;
  }
  /**
   * Called when the layer is added to the map.
   * @param {object} map - The map instance.
   */
  onAdd(map) {
    super.onAdd(map);
    // Use shared WebGL context if provided, otherwise create a new one
    this._gl = this.opt.glContext || this._map._webglContext; // Assuming map might provide a shared context
    if (!this._gl) {
      // Create canvas for WebGL if no shared context
      this._canvas = document.createElement("canvas");
      this._canvas.className = "atlas-terrain";
      this._canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
      map._canvasContainer.appendChild(this._canvas);
      this._gl = this._canvas.getContext("webgl") || this._canvas.getContext("experimental-webgl");
    }
    if (!this._gl) {
      console.warn("WebGL not supported or context could not be obtained for TerrainLayer.");
      return;
    }

    // Handle WebGL context loss and restoration
    if (this._canvas) {
      this._canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault(); // Prevent the context from being lost
        this._contextLost = true;
        console.warn('WebGL context lost. Waiting for restoration...');
      }, false);

      this._canvas.addEventListener('webglcontextrestored', () => {
        this._contextLost = false;
        this._initWebGL(); // Reinitialize everything
        console.log('WebGL context restored.');
      }, false);
    }

    this._initWebGL();
    // Listen for map events
    map.on("move", () => this._update());
    map.on("zoom", () => this._needsUpdate = true);
    this._update();
  }
  /**
   * Called when the layer is removed from the map.
   */
  onRemove() {
    if (this._canvas) {
      this._canvas.remove();
    }
    this._cleanupWebGL();
    super.onRemove();
  }
  /**
   * Initializes WebGL resources (shaders, programs, buffers).
   * @private
   */
  _initWebGL() {
    const gl = this._gl;
    if (!gl) return;
    // Create shaders and program using WebGLUtils
    const vertShader = createShader(gl, gl.VERTEX_SHADER, terrainVertShader);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, terrainFragShader);
    if (!vertShader || !fragShader) return;
    this._program = createProgram(gl, vertShader, fragShader);
    if (!this._program) return;
    gl.useProgram(this._program);
    // Get attribute and uniform locations
    this._attributes = {
      position: gl.getAttribLocation(this._program, "a_position"),
      normal: gl.getAttribLocation(this._program, "a_normal"),
    };
    this._uniforms = {
      modelViewMatrix: gl.getUniformLocation(this._program, "u_modelViewMatrix"),
      projectionMatrix: gl.getUniformLocation(this._program, "u_projectionMatrix"),
      exaggeration: gl.getUniformLocation(this._program, "u_exaggeration"),
      lightDirection: gl.getUniformLocation(this._program, "u_lightDirection"),
      color: gl.getUniformLocation(this._program, "u_color"),
    };
    // Create buffers
    this._buffers.position = gl.createBuffer();
    this._buffers.normal = gl.createBuffer();
    this._buffers.index = gl.createBuffer();
  }
  /**
   * Cleans up WebGL resources.
   * @private
   */
  _cleanupWebGL() {
    const gl = this._gl;
    if (gl) {
      Object.values(this._buffers).forEach((buffer) => {
        if (buffer) gl.deleteBuffer(buffer);
      });
      Object.values(this._textures).forEach((texture) => {
        if (texture) gl.deleteTexture(texture);
      });
      if (this._program) gl.deleteProgram(this._program);
      // If context was created by this layer, destroy it. Otherwise, it\'s shared.
      if (this._canvas && this._gl === this._canvas.getContext("webgl")) {
        // gl.getExtension("WEBGL_lose_context").loseContext(); // Not always available or recommended
      }
    }
  }
  /**
   * Sets the elevation data for the terrain.
   * @param {number[]} data - A flat array of elevation values.
   * @returns {TerrainLayer} This TerrainLayer instance for chaining.
   */
  setElevationData(data) {
    this.opt.elevationData = data;
    this._needsUpdate = true;
    this._update();
    return this;
  }
  /**
   * Sets the vertical exaggeration factor for the terrain.
   * @param {number} exaggeration - The exaggeration factor.
   * @returns {TerrainLayer} This TerrainLayer instance for chaining.
   */
  setExaggeration(exaggeration) {
    this.opt.exaggeration = exaggeration;
    this._update();
    return this;
  }
  /**
   * Sets the base color of the terrain.
   * @param {string} color - The hexadecimal color string (e.g., \'#RRGGBB\').
   * @returns {TerrainLayer} This TerrainLayer instance for chaining.
   */
  setColor(color) {
    this.opt.color = color;
    this._update();
    return this;
  }
  /**
   * Updates the terrain rendering.
   * @private
   */
  _update() {
    const gl = this._gl;
    if (!gl || !this._map || !this._program || this._contextLost) return;

    // Only update canvas size if this layer owns the canvas
    if (this._canvas) {
      this._canvas.width = this._canvas.clientWidth * dpr;
      this._canvas.height = this._canvas.clientHeight * dpr;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // Use gl.canvas for dimensions
    // Clear only if this layer owns the context or is responsible for clearing
    // For shared contexts, clearing should be managed by the main map or a scene manager
    if (!this.opt.glContext) { // If not using a shared context, clear
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    gl.enable(gl.DEPTH_TEST);
    if (this._needsUpdate || !this._terrainData) {
      this._generateTerrain();
      this._needsUpdate = false;
    }
    if (!this._terrainData) return;
    gl.useProgram(this._program);
    // Set up matrices (simplified for now, needs map integration)
    const projectionMatrix = new Mat4().perspective(
      Math.PI / 4,
      gl.canvas.width / gl.canvas.height,
      0.1,
      1000.0
    );
    // TODO: Integrate with map camera for dynamic view
    const viewMatrix = new Mat4().lookAt(
      new Vec3(0, 0, 5),
      new Vec3(0, 0, 0),
      new Vec3(0, 1, 0)
    );
    const modelViewMatrix = new Mat4().multiply(viewMatrix);
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, this._terrainData.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.position);
    gl.vertexAttribPointer(this._attributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, this._terrainData.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.normal);
    gl.vertexAttribPointer(this._attributes.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buffers.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._terrainData.indices, gl.STATIC_DRAW);
    // Set uniforms
    gl.uniformMatrix4fv(this._uniforms.projectionMatrix, false, projectionMatrix.elements);
    gl.uniformMatrix4fv(this._uniforms.modelViewMatrix, false, modelViewMatrix.elements);
    gl.uniform1f(this._uniforms.exaggeration, this.opt.exaggeration);
    gl.uniform3fv(this._uniforms.lightDirection, [this._lightDirection.x, this._lightDirection.y, this._lightDirection.z]);
    gl.uniform3fv(this._uniforms.color, hexToRgb(this.opt.color));
    // Draw
    gl.drawElements(gl.TRIANGLES, this._terrainData.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  /**
   * Generates the terrain geometry (positions, normals, indices).
   * @private
   */
  _generateTerrain() {
    if (!this.opt.elevationData) return;
    const width = 100; // Example fixed width
    const height = 100; // Example fixed height
    const size = width * height;
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const indices = new Uint16Array((width - 1) * (height - 1) * 6);
    // Generate positions
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 3;
        const elevation = this.opt.elevationData[y * width + x] || 0;
        positions[index] = (x / width - 0.5) * 2;
        positions[index + 1] = (y / height - 0.5) * 2;
        positions[index + 2] = elevation * 0.01; // Scale elevation
      }
    }
    // Generate normals (improved calculation)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        const p = new Vec3(positions[i], positions[i + 1], positions[i + 2]);
        // Approximate normals using cross product of adjacent edges
        let normal = new Vec3(0, 0, 0);
        // Right edge
        if (x < width - 1) {
          const pRight = new Vec3(positions[i + 3], positions[i + 4], positions[i + 5]);
          // Down edge
          if (y < height - 1) {
            const pDown = new Vec3(positions[i + width * 3], positions[i + width * 3 + 1], positions[i + width * 3 + 2]);
            normal.add(Vec3.cross(Vec3.subtract(pRight, p), Vec3.subtract(pDown, p)));
          }
          // Up edge
          if (y > 0) {
            const pUp = new Vec3(positions[i - width * 3], positions[i - width * 3 + 1], positions[i - width * 3 + 2]);
            normal.add(Vec3.cross(Vec3.subtract(pUp, p), Vec3.subtract(pRight, p)));
          }
        }
        // Left edge
        if (x > 0) {
          const pLeft = new Vec3(positions[i - 3], positions[i - 2], positions[i - 1]);
          // Down edge
          if (y < height - 1) {
            const pDown = new Vec3(positions[i + width * 3], positions[i + width * 3 + 1], positions[i + width * 3 + 2]);
            normal.add(Vec3.cross(Vec3.subtract(pDown, p), Vec3.subtract(pLeft, p)));
          }
          // Up edge
          if (y > 0) {
            const pUp = new Vec3(positions[i - width * 3], positions[i - width * 3 + 1], positions[i - width * 3 + 2]);
            normal.add(Vec3.cross(Vec3.subtract(pLeft, p), Vec3.subtract(pUp, p)));
          }
        }
        normal.normalize();
        normals[i] = normal.x;
        normals[i + 1] = normal.y;
        normals[i + 2] = normal.z;
      }
    }
    // Generate indices
    let idx = 0;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const a = y * width + x;
        const b = y * width + (x + 1);
        const c = (y + 1) * width + x;
        const d = (y + 1) * width + (x + 1);
        indices[idx++] = a;
        indices[idx++] = b;
        indices[idx++] = c;
        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = c;
      }
    }
    this._terrainData = {
      positions,
      normals,
      indices,
    };
  }
}
// --- src/webgl/shaders/building.vert ---
const buildingVertShader = `
attribute vec3 a_position;
attribute vec3 a_normal;
uniform mat4 u_modelViewMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_height;
varying vec3 v_position;
varying float v_height;
varying vec3 v_normal;
void main() {
  vec3 pos = a_position;
  pos.z *= u_height;
  gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(pos, 1.0);
  v_position = pos;
  v_height = u_height;
  v_normal = a_normal;
}
`;
// --- src/webgl/shaders/building.frag ---
const buildingFragShader = `
precision mediump float;
uniform vec3 u_baseColor;
uniform vec3 u_heightColor;
uniform vec3 u_lightDirection;
varying vec3 v_position;
varying float v_height;
varying vec3 v_normal;
void main() {
  float heightFactor = clamp(v_height / 200.0, 0.0, 1.0);
  vec3 interpolatedColor = mix(u_baseColor, u_heightColor, heightFactor);
  vec3 normal = normalize(v_normal);
  float diffuse = max(dot(normal, u_lightDirection), 0.0);
  vec3 finalColor = interpolatedColor * (0.3 + 0.7 * diffuse);
  gl_FragColor = vec4(finalColor, 1.0);
}
`;
// --- src/layers/BuildingLayer.js ---
/**
 * @fileoverview BuildingLayer class for Atlas.js, rendering 3D buildings using WebGA.
 * @module layers/BuildingLayer
 */
/**
 * @class BuildingLayer
 * @augments Layer
 * @description Renders 3D buildings using WebGA.
 */
class BuildingLayer extends Layer {
  /**
   * Creates a new BuildingLayer instance.
   * @param {object} [opt={}] - Options for the building layer.
   * @param {Array<object>} [opt.data=[]] - Array of building data. Each object should have:
   *   - `polygon`: Array of [lng, lat] pairs defining the building footprint.
   *   - `height`: Height of the building in meters.
   * @param {string} [opt.baseColor=\'#aaaaaa\'] - Base color of the buildings.
   * @param {string} [opt.heightColor=\'#ff7700\'] - Color for the top of the buildings, blended with baseColor.
   * @param {number} [opt.minHeight=0] - Minimum height for color blending.
   * @param {number} [opt.maxHeight=200] - Maximum height for color blending.
   * @param {WebGLRenderingContext} [opt.glContext=null] - Optional shared WebGL context.
   */
  constructor(opt = {}) {
    super();
    this.opt = {
      data: [],
      baseColor: "#aaaaaa",
      heightColor: "#ff7700",
      minHeight: 0,
      maxHeight: 200,
      glContext: null, // Allow passing a shared WebGL context
      ...opt,
    };
    /**
     * @private
     * @type {WebGLRenderingContext|null}
     * @description The WebGL rendering context.
     */
    this._gl = null;
    /**
     * @private
     * @type {WebGLProgram|null}
     * @description The WebGL shader program.
     */
    this._program = null;
    /**
     * @private
     * @type {object}
     * @description Stores WebGL buffer objects.
     */
    this._buffers = {};
    /**
     * @private
     * @type {object|null}
     * @description Stores generated building geometry data (positions, normals, indices).
     */
    this._buildingData = null;
    /**
     * @private
     * @type {boolean}
     * @description Flag indicating if building data needs to be regenerated.
     */
    this._needsUpdate = true;
    /**
     * @private
     * @type {Vec3}
     * @description Direction of the light source.
     */
    this._lightDirection = Vec3.normalize(new Vec3(0.5, 0.7, 1.0));
    /**
     * @private
     * @type {boolean}
     * @description Flag indicating if the WebGL context has been lost.
     */
    this._contextLost = false;
  }
  /**
   * Called when the layer is added to the map.
   * @param {object} map - The map instance.
   */
  onAdd(map) {
    super.onAdd(map);
    // Use shared WebGL context if provided, otherwise create a new one
    this._gl = this.opt.glContext || this._map._webglContext; // Assuming map might provide a shared context
    if (!this._gl) {
      // Create canvas for WebGL if no shared context
      this._canvas = document.createElement("canvas");
      this._canvas.className = "atlas-buildings";
      this._canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
      map._canvasContainer.appendChild(this._canvas);
      this._gl = this._canvas.getContext("webgl") || this._canvas.getContext("experimental-webgl");
    }
    if (!this._gl) {
      console.warn("WebGL not supported or context could not be obtained for BuildingLayer.");
      return;
    }

    // Handle WebGL context loss and restoration
    if (this._canvas) {
      this._canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault(); // Prevent the context from being lost
        this._contextLost = true;
        console.warn('WebGL context lost. Waiting for restoration...');
      }, false);

      this._canvas.addEventListener('webglcontextrestored', () => {
        this._contextLost = false;
        this._initWebGL(); // Reinitialize everything
        console.log('WebGL context restored.');
      }, false);
    }

    this._initWebGL();
    // Listen for map events
    map.on("move", () => this._update());
    map.on("zoom", () => this._needsUpdate = true);
    this._update();
  }
  /**
   * Called when the layer is removed from the map.
   */
  onRemove() {
    if (this._canvas) {
      this._canvas.remove();
    }
    this._cleanupWebGL();
    super.onRemove();
  }
  /**
   * Initializes WebGL resources (shaders, programs, buffers).
   * @private
   */
  _initWebGL() {
    const gl = this._gl;
    if (!gl) return;
    // Create shaders and program using WebGLUtils
    const vertShader = createShader(gl, gl.VERTEX_SHADER, buildingVertShader);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, buildingFragShader);
    if (!vertShader || !fragShader) return;
    this._program = createProgram(gl, vertShader, fragShader);
    if (!this._program) return;
    gl.useProgram(this._program);
    // Get attribute and uniform locations
    this._attributes = {
      position: gl.getAttribLocation(this._program, "a_position"),
      normal: gl.getAttribLocation(this._program, "a_normal"),
    };
    this._uniforms = {
      modelViewMatrix: gl.getUniformLocation(this._program, "u_modelViewMatrix"),
      projectionMatrix: gl.getUniformLocation(this._program, "u_projectionMatrix"),
      height: gl.getUniformLocation(this._program, "u_height"),
      baseColor: gl.getUniformLocation(this._program, "u_baseColor"),
      heightColor: gl.getUniformLocation(this._program, "u_heightColor"),
      lightDirection: gl.getUniformLocation(this._program, "u_lightDirection"),
    };
    // Create buffers
    this._buffers.position = gl.createBuffer();
    this._buffers.normal = gl.createBuffer();
    this._buffers.index = gl.createBuffer();
    // Set up lighting
    this._lightDirection = Vec3.normalize(new Vec3(0.5, 0.7, 1.0));
  }
  /**
   * Cleans up WebGL resources.
   * @private
   */
  _cleanupWebGL() {
    const gl = this._gl;
    if (gl) {
      Object.values(this._buffers).forEach((buffer) => {
        if (buffer) gl.deleteBuffer(buffer);
      });
      if (this._program) gl.deleteProgram(this._program);
      // If context was created by this layer, destroy it. Otherwise, it\'s shared.
      if (this._canvas && this._gl === this._canvas.getContext("webgl")) {
        // gl.getExtension("WEBGL_lose_context").loseContext(); // Not always available or recommended
      }
    }
  }
  /**
   * Sets the building data for the layer.
   * @param {Array<object>} data - Array of building data.
   * @returns {BuildingLayer} This BuildingLayer instance for chaining.
   */
  setData(data) {
    this.opt.data = data;
    this._needsUpdate = true;
    this._update();
    return this;
  }
  /**
   * Updates the building rendering.
   * @private
   */
  _update() {
    const gl = this._gl;
    if (!gl || !this._map || !this._program || this._contextLost) return;

    // Only update canvas size if this layer owns the canvas
    if (this._canvas) {
      this._canvas.width = this._canvas.clientWidth * dpr;
      this._canvas.height = this._canvas.clientHeight * dpr;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // Use gl.canvas for dimensions
    // Clear only if this layer owns the context or is responsible for clearing
    if (!this.opt.glContext) { // If not using a shared context, clear
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    gl.enable(gl.DEPTH_TEST);
    if (this._needsUpdate || !this._buildingData) {
      this._generateBuildings();
      this._needsUpdate = false;
    }
    if (!this._buildingData) return;
    gl.useProgram(this._program);
    // Set up matrices (simplified for now, needs map integration)
    const projectionMatrix = new Mat4().perspective(
      Math.PI / 4,
      gl.canvas.width / gl.canvas.height,
      0.1,
      1000.0
    );
    // TODO: Integrate with map camera for dynamic view
    const viewMatrix = new Mat4().lookAt(
      new Vec3(0, 0, 5),
      new Vec3(0, 0, 0),
      new Vec3(0, 1, 0)
    );
    const modelViewMatrix = new Mat4().multiply(viewMatrix);
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, this._buildingData.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.position);
    gl.vertexAttribPointer(this._attributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, this._buildingData.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.normal);
    gl.vertexAttribPointer(this._attributes.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buffers.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._buildingData.indices, gl.STATIC_DRAW);
    // Set uniforms
    gl.uniformMatrix4fv(this._uniforms.projectionMatrix, false, projectionMatrix.elements);
    gl.uniformMatrix4fv(this._uniforms.modelViewMatrix, false, modelViewMatrix.elements);
    gl.uniform3fv(this._uniforms.baseColor, hexToRgb(this.opt.baseColor));
    gl.uniform3fv(this._uniforms.heightColor, hexToRgb(this.opt.heightColor));
    gl.uniform3fv(this._uniforms.lightDirection, [this._lightDirection.x, this._lightDirection.y, this._lightDirection.z]);
    // Draw each building
    let offset = 0;
    this._buildingData.drawCalls.forEach(drawCall => {
      gl.uniform1f(this._uniforms.height, drawCall.height);
      gl.drawElements(gl.TRIANGLES, drawCall.count, gl.UNSIGNED_SHORT, offset * Uint16Array.BYTES_PER_ELEMENT);
      offset += drawCall.count;
    });
  }
  /**
   * Generates the building geometry (positions, normals, indices) from the provided data.
   * @private
   */
  _generateBuildings() {
    if (!this.opt.data || this.opt.data.length === 0) return;
    const allPositions = [];
    const allNormals = [];
    const allIndices = [];
    const drawCalls = [];
    let vertexOffset = 0;
    this.opt.data.forEach(building => {
      const polygon = building.polygon;
      const height = building.height || 10; // Default height
      if (polygon.length < 3) return; // Need at least a triangle
      const baseVertices = [];
      const topVertices = [];
      // Project polygon points to 2D space (assuming EPSG:3857 for simplicity here)
      // In a real scenario, this would use the map\'s projection system
      polygon.forEach(point => {
        // For simplicity, using a direct projection without map context
        // This needs to be integrated with the map\'s projection system (e.g., Projection.project)
        // For now, let\'s just use the raw lng/lat as x/y and z=0 for base
        baseVertices.push(point[0], point[1], 0);
        topVertices.push(point[0], point[1], height);
      });
      const numPoints = polygon.length;
      // Generate roof (top face)
      // Simple triangulation for convex polygons (fan triangulation)
      for (let i = 1; i < numPoints - 1; i++) {
        allIndices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
        allNormals.push(0, 0, 1, 0, 0, 1, 0, 0, 1); // Normal pointing up
      }
      // Generate walls (side faces)
      for (let i = 0; i < numPoints; i++) {
        const p1Index = i;
        const p2Index = (i + 1) % numPoints;
        // Vertices for the current wall segment
        const v1 = new Vec3(baseVertices[p1Index * 3], baseVertices[p1Index * 3 + 1], baseVertices[p1Index * 3 + 2]);
        const v2 = new Vec3(baseVertices[p2Index * 3], baseVertices[p2Index * 3 + 1], baseVertices[p2Index * 3 + 2]);
        const v3 = new Vec3(topVertices[p2Index * 3], topVertices[p2Index * 3 + 1], topVertices[p2Index * 3 + 2]);
        const v4 = new Vec3(topVertices[p1Index * 3], topVertices[p1Index * 3 + 1], topVertices[p1Index * 3 + 2]);
        // Triangle 1: v1, v2, v3
        allPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        const normal1 = Vec3.normalize(Vec3.cross(Vec3.subtract(v2, v1), Vec3.subtract(v3, v1)));
        allNormals.push(normal1.x, normal1.y, normal1.z, normal1.x, normal1.y, normal1.z, normal1.x, normal1.y, normal1.z);
        allIndices.push(vertexOffset + allPositions.length / 3 - 3, vertexOffset + allPositions.length / 3 - 2, vertexOffset + allPositions.length / 3 - 1);
        // Triangle 2: v1, v3, v4
        allPositions.push(v1.x, v1.y, v1.z, v3.x, v3.y, v3.z, v4.x, v4.y, v4.z);
        const normal2 = Vec3.normalize(Vec3.cross(Vec3.subtract(v3, v1), Vec3.subtract(v4, v1)));
        allNormals.push(normal2.x, normal2.y, normal2.z, normal2.x, normal2.y, normal2.z, normal2.x, normal2.y, normal2.z);
        allIndices.push(vertexOffset + allPositions.length / 3 - 3, vertexOffset + allPositions.length / 3 - 2, vertexOffset + allPositions.length / 3 - 1);
      }
      drawCalls.push({
        height: height,
        count: (numPoints - 2) * 3 + numPoints * 6 // Indices for roof + walls
      });
      vertexOffset += numPoints * 2; // Each polygon contributes numPoints base and numPoints top vertices
    });
    this._buildingData = {
      positions: new Float32Array(allPositions),
      normals: new Float32Array(allNormals),
      indices: new Uint16Array(allIndices),
      drawCalls: drawCalls,
    };
  }
}
// --- src/layers/LayerGroup.js ---
/**
 * @fileoverview LayerGroup class for Atlas.js, managing a collection of layers.
 * @module layers/LayerGroup
 */
/**
 * @class LayerGroup
 * @augments Layer
 * @description Manages a collection of layers as a single unit.
 */
class LayerGroup extends Layer {
  /**
   * Creates a new LayerGroup instance.
   * @param {Array<Layer>} [layers=[]] - An array of layers to add to the group.
   */
  constructor(layers = []) {
    super();
    /**
     * @private
     * @type {Map<string, Layer>}
     * @description Stores layers by a unique ID for efficient access and removal.
     */
    this._layers = new Map();
    layers.forEach(layer => this.addLayer(layer));
  }
  /**
   * Adds a layer to the group.
   * @param {Layer} layer - The layer to add.
   * @returns {LayerGroup} This LayerGroup instance for chaining.
   */
  addLayer(layer) {
    const id = layer.id || `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    layer.id = id; // Assign an ID if not already present
    this._layers.set(id, layer);
    if (this._map) {
      layer.onAdd(this._map);
    }
    return this;
  }
  /**
   * Removes a layer from the group.
   * @param {Layer} layer - The layer to remove.
   * @returns {LayerGroup} This LayerGroup instance for chaining.
   */
  removeLayer(layer) {
    if (this._layers.has(layer.id)) {
      if (this._map) {
        layer.onRemove();
      }
      this._layers.delete(layer.id);
    }
    return this;
  }
  /**
   * Checks if the group contains a given layer.
   * @param {Layer} layer - The layer to check.
   * @returns {boolean}
   */
  hasLayer(layer) {
    return this._layers.has(layer.id);
  }
  /**
   * Returns all layers in the group as an array.
   * @returns {Array<Layer>}
   */
  getLayers() {
    return Array.from(this._layers.values());
  }
  /**
   * Called when the layer group is added to the map.
   * @param {object} map - The map instance.
   */
  onAdd(map) {
    super.onAdd(map);
    this._layers.forEach(layer => layer.onAdd(map));
    return this;
  }
  /**
   * Called when the layer group is removed from the map.
   */
  onRemove() {
    this._layers.forEach(layer => layer.onRemove());
    super.onRemove();
    return this;
  }
  /**
   * Iterates over each layer in the group.
   * @param {Function} fn - The function to call for each layer.
   * @param {object} [context] - The context (`this`) for the function.
   * @returns {LayerGroup} This LayerGroup instance for chaining.
   */
  eachLayer(fn, context) {
    this._layers.forEach(layer => fn.call(context, layer));
    return this;
  }
  /**
   * Removes all layers from the group.
   * @returns {LayerGroup} This LayerGroup instance for chaining.
   */
  clearLayers() {
    this.eachLayer(layer => this.removeLayer(layer));
    return this;
  }
}
// --- src/webgl/WebGLContextManager.js ---
/**
 * @fileoverview Manages a shared WebGL context for multiple layers.
 * @module webgl/WebGLContextManager
 */
/**
 * @class WebGLContextManager
 * @description Manages a single WebGL rendering context to be shared across multiple layers.
 */
class WebGLContextManager {
  constructor() {
    /**
     * @private
     * @type {HTMLCanvasElement|null}
     * @description The canvas element used for the shared WebGL context.
     */
    this._canvas = null;
    /**
     * @private
     * @type {WebGLRenderingContext|null}
     * @description The shared WebGL rendering context.
     */
    this._gl = null;
    /**
     * @private
     * @type {Set<object>}
     * @description A set of layers currently using this context.
     */
    this._users = new Set();
  }
  /**
   * Initializes or retrieves the shared WebGL context.
   * @param {HTMLElement} parentContainer - The DOM element to append the canvas to.
   * @returns {WebGLRenderingContext|null} The WebGL rendering context.
   */
  getContext(parentContainer) {
    if (!this._gl) {
      this._canvas = document.createElement("canvas");
      this._canvas.className = "atlas-webgl-shared-canvas";
      this._canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;";
      parentContainer.appendChild(this._canvas);
      this._gl = this._canvas.getContext("webgl") || this._canvas.getContext("experimental-webgl");
      if (!this._gl) {
        console.error("WebGL not supported or context could not be obtained.");
        return null;
      }
    }
    return this._gl;
  }
  /**
   * Returns the canvas element associated with the shared WebGL context.
   * @returns {HTMLCanvasElement|null}
   */
  getCanvas() {
    return this._canvas;
  }
  /**
   * Adds a user (layer) to the context manager.
   * @param {object} user - The layer or object using the context.
   */
  addUser(user) {
    this._users.add(user);
  }
  /**
   * Removes a user (layer) from the context manager.
   * If no more users, the context is destroyed.
   * @param {object} user - The layer or object no longer using the context.
   */
  removeUser(user) {
    this._users.delete(user);
    if (this._users.size === 0) {
      this._destroyContext();
    }
  }
  /**
   * Destroys the WebGL context and removes the canvas from the DOM.
   * @private
   */
  _destroyContext() {
    if (this._gl) {
      // Attempt to lose context if extension is available
      const loseContext = this._gl.getExtension("WEBGL_lose_context");
      if (loseContext) {
        loseContext.loseContext();
      }
      this._gl = null;
    }
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
      this._canvas = null;
    }
  }
  /**
   * Resizes the shared WebGL canvas.
   * @param {number} width - The new width.
   * @param {number} height - The new height.
   */
  resize(width, height) {
    if (this._canvas) {
      this._canvas.width = width;
      this._canvas.height = height;
    }
  }
  /**
   * Clears the shared WebGL context.
   */
  clear() {
    if (this._gl) {
      this._gl.clearColor(0, 0, 0, 0);
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
    }
  }
}

// Global Atlas object
const Atlas = {
  Emitter,
  dpr,
  now,
  clamp,
  wrap,
  normalizeLng,
  easeOutCubic,
  distance,
  EARTH_RADIUS,
  CIRC,
  hexToRgb,
  CRS,
  LatLngBounds,
  Vec3,
  Mat4,
  Projection,
  cacheAsset,
  getCachedAsset,
  Layer,
  TileLayer,
  TerrainLayer,
  BuildingLayer,
  LayerGroup,
  createShader,
  createProgram,
  WebGLContextManager,
  terrainVertShader,
  terrainFragShader,
  buildingVertShader,
  buildingFragShader,
};

window.Atlas = Atlas;
