/**
 * Bounds Management System
 */

/**
 * Geographic bounds
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.Bounds = class {
  /**
   * Creates bounds from coordinates
   *
   * @param {LatLng} ne - Northeast corner
   * @param {LatLng} sw - Southwest corner
   */
  constructor(ne, sw) {
    // Normalize to ensure valid bounds
    this.north = Math.max(ne.lat, sw.lat);
    this.south = Math.min(ne.lat, sw.lat);
    this.east = Math.max(ne.lon, sw.lon);
    this.west = Math.min(ne.lon, sw.lon);
    this._validate();
  }

  /**
   * Validate bounds
   * @private
   */
  _validate() {
    // Clamp to valid ranges
    this.north = Math.min(85.05112878, this.north);
    this.south = Math.max(-85.05112878, this.south);

    // Handle dateline crossing
    if (this.east < this.west && this.east > 0 && this.west < 0) {
      this.crossesDateline = true;
    } else {
      this.crossesDateline = false;
    }
  }

  /**
   * Get bounds as LatLng objects
   */
  toLatLng() {
    return {
      ne: { lat: this.north, lon: this.east },
      sw: { lat: this.south, lon: this.west },
      nw: { lat: this.north, lon: this.west },
      se: { lat: this.south, lon: this.east }
    };
  }

  /**
   * Get center point
   */
  getCenter() {
    let lon = (this.east + this.west) / 2;
    // Handle dateline crossing
    if (this.crossesDateline) {
      lon = lon > 0 ? lon - 180 : lon + 180;
    }
    return { lat: (this.north + this.south) / 2, lon: lon };
  }

  /**
   * Check if bounds contain point
   */
  contains(latlng) {
    if (latlng.lat < this.south || latlng.lat > this.north) {
      return false;
    }
    if (this.crossesDateline) {
      return latlng.lon >= this.west || latlng.lon <= this.east;
    }
    return latlng.lon >= this.west && latlng.lon <= this.east;
  }

  /**
   * Check intersection with another bounds
   */
  intersects(other) {
    const noIntersection = (
      this.north < other.south ||
      this.south > other.north ||
      (!this.crossesDateline && !other.crossesDateline && (this.east < other.west || this.west > other.east))
    );
    return !noIntersection;
  }

  /**
   * Get area of bounds (approximate, in degrees)
   */
  getArea() {
    const latDiff = this.north - this.south;
    const lonDiff = this.crossesDateline
      ? (180 - this.east) + (this.west + 180)
      : (this.east - this.west);
    return latDiff * lonDiff;
  }

  /**
   * Expand bounds by amount
   */
  expand(amount) {
    return new Bounds(
      {
        lat: Math.min(85.05112878, this.north + amount),
        lon: Math.min(180, this.east + amount)
      },
      {
        lat: Math.max(-85.05112878, this.south - amount),
        lon: Math.max(-180, this.west - amount)
      }
    );
  }

  /**
   * Get bounds padded by percentage
   */
  pad(percentage) {
    const latPad = (this.north - this.south) * (percentage / 100);
    const lonPad = (this.east - this.west) * (percentage / 100);
    return new Bounds(
      {
        lat: Math.min(85.05112878, this.north + latPad),
        lon: this.east + lonPad
      },
      {
        lat: Math.max(-85.05112878, this.south - latPad),
        lon: this.west - lonPad
      }
    );
  }

  /**
   * Merge with another bounds
   */
  merge(other) {
    return new Bounds(
      {
        lat: Math.max(this.north, other.north),
        lon: Math.max(this.east, other.east)
      },
      {
        lat: Math.min(this.south, other.south),
        lon: Math.min(this.west, other.west)
      }
    );
  }

  /**
   * Check if bounds are valid
   */
  isValid() {
    return (
      this.north >= -85.05112878 &&
      this.north <= 85.05112878 &&
      this.south >= -85.05112878 &&
      this.south <= 85.05112878 &&
      this.north > this.south &&
      this.east >= -180 &&
      this.east <= 180 &&
      this.west >= -180 &&
      this.west <= 180
    );
  }

  /**
   * Get serializable object
   */
  toJSON() {
    return {
      north: this.north,
      south: this.south,
      east: this.east,
      west: this.west,
      crossesDateline: this.crossesDateline
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    const bounds = new Bounds(
      { lat: data.north, lon: data.east },
      { lat: data.south, lon: data.west }
    );
    bounds.crossesDateline = data.crossesDateline || false;
    return bounds;
  }
}

/**
 * Bounds builder for constructing from multiple points
 */
class BoundsBuilder {
  constructor() {
    this.points = [];
  }

  /**
   * Add point to bounds
   */
  extend(latlng) {
    this.points.push(latlng);
    return this;
  }

  /**
   * Add multiple points
   */
  extendArray(latlngs) {
    this.points.push(...latlngs);
    return this;
  }

  /**
   * Build bounds from all points
   */
  build() {
    if (this.points.length === 0) {
      throw new Error('Cannot build bounds from no points');
    }
    if (this.points.length === 1) {
      const p = this.points[0];
      return new Bounds({ lat: p.lat, lon: p.lon }, { lat: p.lat, lon: p.lon });
    }

    let north = -Infinity,
      south = Infinity;
    let east = -Infinity,
      west = Infinity;

    for (const point of this.points) {
      north = Math.max(north, point.lat);
      south = Math.min(south, point.lat);
      east = Math.max(east, point.lon);
      west = Math.min(west, point.lon);
    }
    return new Bounds(
      { lat: north, lon: east },
      { lat: south, lon: west }
    );
  }

  /**
   * Reset builder
   */
  reset() {
    this.points = [];
    return this;
  }
}
