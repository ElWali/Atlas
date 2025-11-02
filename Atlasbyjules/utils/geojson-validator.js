/**
 * GeoJSON Validation System
 * Validates and repairs GeoJSON according to RFC 7946
 */

/**
 * Validation error
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.ValidationError = class extends Error {
  constructor(message, path = '', value = null, suggestion = '') {
    super(message);
    this.name = 'GeoJSONValidationError';
    this.path = path;
    this.value = value;
    this.suggestion = suggestion;
  }

  toString() {
    let msg = `${this.message}`;
    if (this.path) msg += ` at ${this.path}`;
    if (this.suggestion) msg += `. Suggestion: ${this.suggestion}`;
    return msg;
  }
}

/**
 * GeoJSON Validator
 */
class GeoJSONValidator {
  constructor(options = {}) {
    this.options = {
      strict: options.strict !== false,
      autoRepair: options.autoRepair || false,
      maxCoordinates: options.maxCoordinates || 100000,
      warnOnMissingProperties: options.warnOnMissingProperties !== false,
      ...options
    };
    this.errors = [];
    this.warnings = [];
    this.repairs = [];
  }

  /**
   * Validate GeoJSON
   */
  validate(geojson) {
    this.errors = [];
    this.warnings = [];
    this.repairs = [];

    if (!geojson || typeof geojson !== 'object') {
      this.errors.push(
        new ValidationError(
          'GeoJSON must be an object',
          'root',
          geojson,
          'Provide a valid GeoJSON object'
        )
      );
      return false;
    }

    // Determine type and validate accordingly
    if (geojson.type === 'FeatureCollection') {
      this._validateFeatureCollection(geojson, 'root');
    } else if (geojson.type === 'Feature') {
      this._validateFeature(geojson, 'root');
    } else if (this._isGeometryType(geojson.type)) {
      this._validateGeometry(geojson, 'root');
    } else if (Array.isArray(geojson)) {
      geojson.forEach((item, index) => {
        this._validateFeature(item, `root[${index}]`);
      });
    } else {
      this.errors.push(
        new ValidationError(
          `Unknown GeoJSON type: ${geojson.type}`,
          'root',
          geojson.type,
          'Use FeatureCollection, Feature, or valid geometry types'
        )
      );
    }

    return this.errors.length === 0;
  }

  /**
   * Repair GeoJSON
   */
  repair(geojson) {
    this.validate(geojson);
    if (this.options.autoRepair) {
      return this._autoRepair(geojson);
    }
    return geojson;
  }

  /**
   * Auto-repair GeoJSON
   * @private
   */
  _autoRepair(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      return { type: 'FeatureCollection', features: [] };
    }

    // Wrap raw geometry in feature if needed
    if (this._isGeometryType(geojson.type)) {
      this.repairs.push('Wrapped geometry in Feature');
      return { type: 'Feature', geometry: geojson, properties: {} };
    }

    // Wrap feature in FeatureCollection if needed
    if (geojson.type === 'Feature') {
      return { type: 'FeatureCollection', features: [geojson] };
    }

    if (geojson.type === 'FeatureCollection') {
      // Repair features
      geojson.features = (geojson.features || [])
        .map(f => this._repairFeature(f))
        .filter(f => f !== null);
      return geojson;
    }

    // Try to repair array of features
    if (Array.isArray(geojson)) {
      return {
        type: 'FeatureCollection',
        features: geojson
          .map(f => this._repairFeature(f))
          .filter(f => f !== null)
      };
    }

    return { type: 'FeatureCollection', features: [] };
  }

  /**
   * Repair individual feature
   * @private
   */
  _repairFeature(feature) {
    if (!feature || typeof feature !== 'object') return null;

    const repaired = {
      type: 'Feature',
      geometry: feature.geometry || null,
      properties: feature.properties || {}
    };

    // Repair geometry if valid type
    if (repaired.geometry && this._isGeometryType(repaired.geometry.type)) {
      repaired.geometry = this._repairGeometry(repaired.geometry);
    } else if (repaired.geometry === null) {
      this.repairs.push('Feature has null geometry');
    }
    return repaired;
  }

  /**
   * Repair geometry
   * @private
   */
  _repairGeometry(geometry) {
    if (!geometry.coordinates) {
      return {
        ...geometry,
        coordinates: this._getDefaultCoordinates(geometry.type)
      };
    }

    // Clamp coordinates to valid bounds
    geometry.coordinates = this._clampCoordinates(geometry.coordinates, geometry.type);
    return geometry;
  }

  /**
   * Get default coordinates for geometry type
   * @private
   */
  _getDefaultCoordinates(type) {
    const defaults = {
      'Point': [0, 0],
      'LineString': [[0, 0], [1, 1]],
      'Polygon': [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      'MultiPoint': [[0, 0]],
      'MultiLineString': [[[0, 0], [1, 1]]],
      'MultiPolygon': [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
    };
    return defaults[type] || [0, 0];
  }

  /**
   * Clamp coordinates to valid bounds
   * @private
   */
  _clampCoordinates(coords, type) {
    if (type === 'Point') {
      return this._clampCoordinate(coords);
    }
    if (type === 'LineString' || type === 'MultiPoint') {
      return coords.map(c => this._clampCoordinate(c));
    }
    if (type === 'Polygon' || type === 'MultiLineString') {
      return coords.map(ring => ring.map(c => this._clampCoordinate(c)));
    }
    if (type === 'MultiPolygon') {
      return coords.map(polygon =>
        polygon.map(ring => ring.map(c => this._clampCoordinate(c)))
      );
    }
    return coords;
  }

  /**
   * Clamp single coordinate
   * @private
   */
  _clampCoordinate([lon, lat]) {
    return [
      Math.max(-180, Math.min(180, lon)),
      Math.max(-85.05112878, Math.min(85.05112878, lat))
    ];
  }

  /**
   * Check if string is valid geometry type
   * @private
   */
  _isGeometryType(type) {
    const validTypes = [
      'Point',
      'LineString',
      'Polygon',
      'MultiPoint',
      'MultiLineString',
      'MultiPolygon'
    ];
    return validTypes.includes(type);
  }

  /**
   * Validate FeatureCollection
   * @private
   */
  _validateFeatureCollection(fc, path) {
    if (fc.type !== 'FeatureCollection') {
      this.errors.push(
        new ValidationError(
          'FeatureCollection must have type: "FeatureCollection"',
          path,
          fc.type
        )
      );
    }

    if (!Array.isArray(fc.features)) {
      this.errors.push(
        new ValidationError(
          'FeatureCollection must have features array',
          `${path}.features`,
          typeof fc.features,
          'Add a features array'
        )
      );
      return;
    }

    fc.features.forEach((feature, index) => {
      this._validateFeature(feature, `${path}.features[${index}]`);
    });
  }

  /**
   * Validate Feature
   * @private
   */
  _validateFeature(feature, path) {
    if (!feature || typeof feature !== 'object') {
      this.errors.push(
        new ValidationError('Feature must be an object', path, typeof feature)
      );
      return;
    }

    if (feature.type !== 'Feature') {
      this.errors.push(
        new ValidationError('Feature must have type: "Feature"', path, feature.type)
      );
    }

    // Geometry is required
    if (!feature.geometry) {
      if (this.options.strict) {
        this.errors.push(
          new ValidationError(
            'Feature must have geometry',
            `${path}.geometry`,
            undefined,
            'Add a geometry object or set geometry to null'
          )
        );
      } else {
        this.warnings.push(
          new ValidationError('Feature should have geometry', `${path}.geometry`)
        );
      }
    } else {
      this._validateGeometry(feature.geometry, `${path}.geometry`);
    }

    // Properties should be object
    if (feature.properties && typeof feature.properties !== 'object') {
      this.warnings.push(
        new ValidationError(
          'Feature properties should be an object',
          `${path}.properties`,
          typeof feature.properties
        )
      );
    } else if (!feature.properties && this.options.warnOnMissingProperties) {
      this.warnings.push(
        new ValidationError('Feature should have properties object', `${path}.properties`)
      );
    }
  }

  /**
   * Validate Geometry
   * @private
   */
  _validateGeometry(geometry, path) {
    if (!geometry) return; // null geometry is valid

    if (!geometry.type) {
      this.errors.push(new ValidationError('Geometry must have type', path, undefined));
      return;
    }

    if (!this._isGeometryType(geometry.type)) {
      this.errors.push(
        new ValidationError(
          `Invalid geometry type: ${geometry.type}`,
          path,
          geometry.type,
          `Use one of: Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon`
        )
      );
      return;
    }

    // Validate coordinates
    if (!Array.isArray(geometry.coordinates)) {
      this.errors.push(
        new ValidationError(
          'Geometry must have coordinates array',
          `${path}.coordinates`,
          typeof geometry.coordinates
        )
      );
      return;
    }

    this._validateCoordinates(
      geometry.coordinates,
      geometry.type,
      `${path}.coordinates`
    );
  }

  /**
   * Validate coordinates
   * @private
   */
  _validateCoordinates(coords, geometryType, path) {
    const coordCount = this._countCoordinates(coords, geometryType);
    if (coordCount > this.options.maxCoordinates) {
      this.errors.push(
        new ValidationError(
          `Too many coordinates (${coordCount} > ${this.options.maxCoordinates})`,
          path,
          coordCount,
          'Simplify geometry or split into multiple features'
        )
      );
    }

    // Type-specific validation
    switch (geometryType) {
      case 'Point':
        this._validatePointCoordinates(coords, path);
        break;
      case 'LineString':
        this._validateLineStringCoordinates(coords, path);
        break;
      case 'Polygon':
        this._validatePolygonCoordinates(coords, path);
        break;
      case 'MultiPoint':
        coords.forEach((c, i) => this._validatePointCoordinates(c, `${path}[${i}]`));
        break;
      case 'MultiLineString':
        coords.forEach((ls, i) =>
          this._validateLineStringCoordinates(ls, `${path}[${i}]`)
        );
        break;
      case 'MultiPolygon':
        coords.forEach((poly, i) =>
          this._validatePolygonCoordinates(poly, `${path}[${i}]`)
        );
        break;
    }
  }

  /**
   * Validate point coordinates
   * @private
   */
  _validatePointCoordinates(coord, path) {
    if (!Array.isArray(coord) || coord.length < 2) {
      this.errors.push(
        new ValidationError('Point coordinate must be [lon, lat]', path, coord)
      );
      return;
    }
    const [lon, lat] = coord;
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      this.errors.push(
        new ValidationError(
          'Coordinates must be numbers',
          path,
          `[${typeof lon}, ${typeof lat}]`
        )
      );
    }
    if (lon < -180 || lon > 180) {
      this.errors.push(
        new ValidationError(
          `Longitude out of bounds: ${lon}`,
          path,
          lon,
          'Longitude must be between -180 and 180'
        )
      );
    }
    if (lat < -85.05112878 || lat > 85.05112878) {
      this.warnings.push(
        new ValidationError(
          `Latitude out of web-mercator bounds: ${lat}`,
          path,
          lat,
          'Latitude should be between -85.05112878 and 85.05112878 for web projection'
        )
      );
    }
  }

  /**
   * Validate LineString coordinates
   * @private
   */
  _validateLineStringCoordinates(coords, path) {
    if (!Array.isArray(coords)) {
      this.errors.push(
        new ValidationError(
          'LineString coordinates must be an array',
          path,
          typeof coords
        )
      );
      return;
    }
    if (coords.length < 2) {
      this.errors.push(
        new ValidationError(
          'LineString must have at least 2 coordinates',
          path,
          coords.length,
          'Add more points to the line'
        )
      );
      return;
    }
    coords.forEach((coord, i) => {
      this._validatePointCoordinates(coord, `${path}[${i}]`);
    });
  }

  /**
   * Validate Polygon coordinates
   * @private
   */
  _validatePolygonCoordinates(rings, path) {
    if (!Array.isArray(rings) || rings.length === 0) {
      this.errors.push(
        new ValidationError(
          'Polygon must have at least one ring',
          path,
          rings?.length || 0
        )
      );
      return;
    }

    // Validate exterior ring
    if (rings[0].length < 4) {
      this.errors.push(
        new ValidationError(
          'Polygon exterior ring must have at least 4 coordinates',
          `${path}[0]`,
          rings[0].length,
          'Close the ring by repeating the first coordinate'
        )
      );
    }

    // Validate that rings are closed
    rings.forEach((ring, ringIndex) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!this._coordsEqual(first, last)) {
        this.errors.push(
          new ValidationError(
            'Polygon ring is not closed (first and last coordinates must match)',
            `${path}[${ringIndex}]`,
            'open ring',
            'Ensure the first and last coordinates are identical'
          )
        );
      }
    });

    // Validate all rings
    rings.forEach((ring, i) => {
      this._validateLineStringCoordinates(ring, `${path}[${i}]`);
    });
  }

  /**
   * Check if coordinates are equal
   * @private
   */
  _coordsEqual(c1, c2) {
    return c1[0] === c2[0] && c1[1] === c2[1];
  }

  /**
   * Count total coordinates
   * @private
   */
  _countCoordinates(coords, type) {
    switch (type) {
      case 'Point':
        return 1;
      case 'LineString':
        return coords.length;
      case 'MultiPoint':
        return coords.length;
      case 'Polygon':
        return coords.reduce((sum, ring) => sum + ring.length, 0);
      case 'MultiLineString':
        return coords.reduce((sum, line) => sum + line.length, 0);
      case 'MultiPolygon':
        return coords.reduce(
          (sum, poly) =>
            sum + poly.reduce((s, ring) => s + ring.length, 0),
          0
        );
      default:
        return 0;
    }
  }

  /**
   * Get validation report
   */
  getReport() {
    return {
      valid: this.errors.length === 0,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      repairCount: this.repairs.length,
      errors: this.errors.map(e => ({
        message: e.message,
        path: e.path,
        suggestion: e.suggestion
      })),
      warnings: this.warnings.map(w => ({ message: w.message, path: w.path })),
      repairs: this.repairs
    };
  }
}
