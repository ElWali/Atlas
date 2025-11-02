/**
 * Configuration Validation System
 */

/**
 * Configuration schema definition
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.ConfigSchema = class {
  constructor(shape) {
    this.shape = shape;
  }

  /**
   * Validate config against schema
   */
  validate(config, path = 'config') {
    const errors = [];
    const warnings = [];

    for (const [key, rule] of Object.entries(this.shape)) {
      const value = config[key];
      const fullPath = `${path}.${key}`;

      // Check required
      if (rule.required && value === undefined) {
        errors.push({
          path: fullPath,
          message: rule.requiredMessage || `${key} is required`,
          severity: 'error'
        });
        continue;
      }

      if (value === undefined) continue;

      // Check type
      if (rule.type) {
        const types = Array.isArray(rule.type) ? rule.type : [rule.type];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (!types.includes(actualType)) {
          errors.push({
            path: fullPath,
            message: `Expected type ${types.join(' or ')}, got ${actualType}`,
            severity: 'error'
          });
          continue;
        }
      }

      // Check enum
      if (rule.enum) {
        if (!rule.enum.includes(value)) {
          errors.push({
            path: fullPath,
            message: `Must be one of: ${rule.enum.join(', ')}`,
            value,
            severity: 'error'
          });
        }
      }

      // Check range
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          path: fullPath,
          message: `Value must be >= ${rule.min}`,
          value,
          severity: 'error'
        });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          path: fullPath,
          message: `Value must be <= ${rule.max}`,
          value,
          severity: 'error'
        });
      }

      // Check custom validator
      if (rule.validate) {
        const result = rule.validate(value);
        if (result !== true) {
          errors.push({
            path: fullPath,
            message: typeof result === 'string' ? result : 'Validation failed',
            value,
            severity: 'error'
          });
        }
      }

      // Check warning condition
      if (rule.warn && rule.warn(value)) {
        warnings.push({
          path: fullPath,
          message: rule.warnMessage || `Unusual value: ${value}`,
          value,
          severity: 'warning'
        });
      }

      // Nested schema
      if (rule.schema && typeof value === 'object' && value !== null) {
        const nestedResult = rule.schema.validate(value, fullPath);
        errors.push(...nestedResult.errors);
        warnings.push(...nestedResult.warnings);
      }
    }

    return { errors, warnings };
  }
}

/**
 * Default configuration schemas
 */
const ATLAS_CONFIG_SCHEMA = new ConfigSchema({
  defaultCenter: {
    required: false,
    type: 'object',
    schema: new ConfigSchema({
      lat: {
        required: false,
        type: 'number',
        min: -85.05112878,
        max: 85.05112878,
        validate: (v) => Number.isFinite(v) || 'Must be a finite number'
      },
      lon: {
        required: false,
        type: 'number',
        min: -180,
        max: 180,
        validate: (v) => Number.isFinite(v) || 'Must be a finite number'
      }
    })
  },
  defaultZoom: {
    required: false,
    type: 'number',
    min: 0,
    max: 28,
    validate: (v) => Number.isInteger(v) || 'Must be an integer',
    warn: (v) => v > 20,
    warnMessage: 'Very high zoom level (>20) may have poor performance'
  },
  defaultLayer: { required: false, type: 'string' },
  retina: { required: false, enum: [true, false, 'auto'] },
  enablePerformanceMonitoring: { required: false, type: 'boolean' },
  enableErrorHandling: { required: false, type: 'boolean' }
});

const TILE_LAYER_SCHEMA = new ConfigSchema({
  minZoom: {
    required: false,
    type: 'number',
    min: 0,
    max: 28,
    validate: (v) => Number.isInteger(v) || 'Must be an integer'
  },
  maxZoom: {
    required: false,
    type: 'number',
    min: 0,
    max: 28,
    validate: (v) => Number.isInteger(v) || 'Must be an integer'
  },
  attribution: { required: false, type: 'string' },
  background: {
    required: false,
    type: 'string',
    validate: (v) => {
      try {
        new Option().style.color = v;
        return true;
      } catch {
        return 'Invalid CSS color';
      }
    }
  },
  supportsRetina: { required: false, type: 'boolean' },
  maxCacheSize: {
    required: false,
    type: 'number',
    min: 10,
    max: 10000,
    validate: (v) => Number.isInteger(v) || 'Must be an integer'
  }
});

const GEOJSON_LAYER_SCHEMA = new ConfigSchema({
  style: {
    required: false,
    validate: (v) => {
      return (typeof v === 'object' || typeof v === 'function') || 'Style must be object or function';
    }
  },
  interactive: { required: false, type: 'boolean' },
  validateStrict: { required: false, type: 'boolean' },
  autoRepair: { required: false, type: 'boolean' }
});

const MARKER_SCHEMA = new ConfigSchema({
  draggable: { required: false, type: 'boolean' },
  riseOnHover: { required: false, type: 'boolean' },
  riseOffset: { required: false, type: 'number', min: 0 },
  zIndexOffset: { required: false, type: 'number' },
  html: { required: false, type: 'string' }
});

/**
 * Configuration validator
 */
class ConfigValidator {
  /**
   * Validate and get result
   */
  static validate(config, schema) {
    return schema.validate(config);
  }

  /**
   * Validate and throw on error
   */
  static validateStrict(config, schema, context = 'Configuration') {
    const result = schema.validate(config);
    if (result.errors.length > 0) {
      const errorMessages = result.errors
        .map(e => ` • ${e.path}: ${e.message}`)
        .join('\n');
      throw new Error(
        `${context} validation failed:\n${errorMessages}`
      );
    }
    return result;
  }

  /**
   * Generate friendly report
   */
  static getReport(config, schema, context = 'Configuration') {
    const result = schema.validate(config);
    return {
      valid: result.errors.length === 0,
      context,
      errors: result.errors.map(e => ({
        path: e.path,
        message: e.message,
        value: e.value
      })),
      warnings: result.warnings.map(w => ({
        path: w.path,
        message: w.message,
        value: w.value
      })),
      summary: {
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      }
    };
  }

  /**
   * Merge config with defaults
   */
  static withDefaults(config, defaults) {
    const merged = { ...defaults };
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
    return merged;
  }
}
