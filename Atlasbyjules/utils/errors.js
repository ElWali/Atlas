/**
 * Atlas.js Error Classification System
 * Provides structured error handling and recovery strategies
 */
/**
 * Base Atlas Error class
 * @extends Error
 */
const Atlas = window.Atlas || {};
Atlas.Error = Atlas.Error || {};

Atlas.Error.AtlasError = class extends Error {
 constructor(message, code, context = {}) {
 super(message);
 this.name = 'AtlasError';
 this.code = code;
 this.context = context;
 this.timestamp = new Date().toISOString();
 this.severity = 'info';
 }
 toJSON() {
 return {
 name: this.name,
 message: this.message,
 code: this.code,
 context: this.context,
 timestamp: this.timestamp,
 severity: this.severity
 };
 }
}
/**
 * Critical errors that may affect core functionality
 */
class CriticalAtlasError extends AtlasError {
 constructor(message, code, context = {}) {
 super(message, code, context);
 this.name = 'CriticalAtlasError';
 this.severity = 'critical';
 this.canRetry = false;
 }
}
/**
 * Recoverable errors that can be retried
 */
class RecoverableAtlasError extends AtlasError {
 constructor(message, code, context = {}) {
 super(message, code, context);
 this.name = 'RecoverableAtlasError';
 this.severity = 'warning';
 this.canRetry = true;
 this.retryCount = 0;
 this.maxRetries = 3;
 }
 shouldRetry() {
 return this.canRetry && this.retryCount < this.maxRetries;
 }
 incrementRetry() {
 this.retryCount++;
 }
 getBackoffDelay() {
 // Exponential backoff: 100ms, 200ms, 400ms
 return Math.min(100 * Math.pow(2, this.retryCount), 5000);
 }
}
/**
 * Network-specific errors
 */
class NetworkError extends RecoverableAtlasError {
 constructor(message, statusCode = null, context = {}) {
 super(message, 'NETWORK_ERROR', { ...context, statusCode });
 this.name = 'NetworkError';
 this.statusCode = statusCode;
 this.canRetry = statusCode !== 404 && statusCode !== 403;
 }
}
/**
 * Validation errors for coordinates, bounds, etc.
 */
class ValidationError extends CriticalAtlasError {
 constructor(message, field, value) {
 super(
 message,
 'VALIDATION_ERROR',
 { field, value }
 );
 this.name = 'ValidationError';
 this.field = field;
 this.value = value;
 }
}
/**
 * Configuration errors
 */
class ConfigError extends CriticalAtlasError {
 constructor(message, configKey, providedValue) {
 super(
 message,
 'CONFIG_ERROR',
 { configKey, providedValue }
 );
 this.name = 'ConfigError';
 this.configKey = configKey;
 this.providedValue = providedValue;
 }
}
/**
 * Tile loading specific errors
 */
class TileLoadError extends RecoverableAtlasError {
 constructor(message, tileKey, url, context = {}) {
 super(
 message,
 'TILE_LOAD_ERROR',
 { ...context, tileKey, url }
 );
 this.name = 'TileLoadError';
 this.tileKey = tileKey;
 this.url = url;
 }
}
/**
 * Error factory with strategy selection
 */
class ErrorFactory {
 static create(type, message, options = {}) {
 const errorMap = {
 'network': () => new NetworkError(message, options.statusCode, options.context),
 'tile': () => new TileLoadError(message, options.tileKey, options.url, options.context),
 'validation': () => new ValidationError(message, options.field, options.value),
 'config': () => new ConfigError(message, options.configKey, options.providedValue),
 'critical': () => new CriticalAtlasError(message, options.code, options.context),
 'recoverable': () => new RecoverableAtlasError(message, options.code, options.context)
 };
 const creator = errorMap[type];
 if (!creator) {
 return new AtlasError(message, 'UNKNOWN_ERROR', options.context);
 }
 return creator();
 }
 static isRecoverable(error) {
 return error instanceof RecoverableAtlasError;
 }
 static isCritical(error) {
 return error instanceof CriticalAtlasError;
 }
}
