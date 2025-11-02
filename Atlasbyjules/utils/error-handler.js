
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.ErrorHandler = class {
 constructor(map) {
 this._map = map;
 this._errorListeners = new Map();
 this._errorHistory = [];
 this._maxHistorySize = 100;
 this._errorThrottleMap = new Map();
 }
 /**
 * Register error listener
 * @param {string} eventType - Error type to listen for
 * @param {Function} callback - Handler function
 */
 on(eventType, callback) {
 if (!this._errorListeners.has(eventType)) {
 this._errorListeners.set(eventType, []);
 }
 this._errorListeners.get(eventType).push(callback);
 }
 /**
 * Handle error with strategy selection
 * @param {Error|AtlasError} error - Error to handle
 * @param {string} context - Context information
 */
 async handle(error, context = '') {
 // Create structured error if needed
 const atlasError = error instanceof AtlasError ? error : ErrorFactory.create('recoverable', error.message, { code: 'UNKNOWN', context: { originalError: error } });
 // Log error
 this._logError(atlasError, context);
 // Check for throttling (prevent error spam)
 if (this._isThrottled(atlasError.code)) {
 return;
 }
 // Execute appropriate recovery strategy
 if (atlasError.canRetry && atlasError.shouldRetry()) {
 await this._handleRecoverable(atlasError);
 } else if (atlasError.severity === 'critical') {
 this._handleCritical(atlasError);
 } else {
 this._handleWarning(atlasError);
 }
 // Emit error event
 this._emitErrorEvent(atlasError);
 }
 /**
 * Handle recoverable errors with retry
 * @private
 */
 async _handleRecoverable(error) {
 error.incrementRetry();
 const delay = error.getBackoffDelay();
 console.warn(
 `[Atlas] Recoverable error (retry ${error.retryCount}/${error.maxRetries}): ` +
 `${error.message}. Retrying in ${delay}ms...`,
 error.context
 );
 // Emit pre-retry event
 this._emitErrorEvent(error, 'pre-retry');
 // Schedule retry
 return new Promise(resolve => {
 setTimeout(() => {
 this._emitErrorEvent(error, 'retry');
 resolve();
 }, delay);
 });
 }
 /**
 * Handle critical errors
 * @private
 */
 _handleCritical(error) {
 console.error('[Atlas] CRITICAL ERROR:', error.message, error.context);
 this._emitErrorEvent(error, 'critical');
 // Notify user if map available
 if (this._map?.notifications) {
 this._map.notifications.show(
 `Critical error: ${error.message}`,
 5000
 );
 }
 }
 /**
 * Handle warning-level errors
 * @private
 */
 _handleWarning(error) {
 console.warn('[Atlas] Warning:', error.message, error.context);
 this._emitErrorEvent(error, 'warning');
 }
 /**
 * Check if error is throttled to prevent spam
 * @private
 */
 _isThrottled(errorCode) {
 if (!this._errorThrottleMap.has(errorCode)) {
 this._errorThrottleMap.set(errorCode, { count: 0, firstTime: Date.now() });
 return false;
 }
 const throttle = this._errorThrottleMap.get(errorCode);
 throttle.count++;
 // Reset throttle after 1 minute
 if (Date.now() - throttle.firstTime > 60000) {
 this._errorThrottleMap.delete(errorCode);
 return false;
 }
 // Throttle after 10 same errors in 1 minute
 return throttle.count > 10;
 }
 /**
 * Log error to history
 * @private
 */
 _logError(error, context) {
 const entry = {
 error: error.toJSON?.() || error,
 context,
 timestamp: new Date().toISOString(),
 userAgent: navigator.userAgent,
 url: window.location.href
 };
 this._errorHistory.push(entry);
 // Maintain max history size
 if (this._errorHistory.length > this._maxHistorySize) {
 this._errorHistory.shift();
 }
 }
 /**
 * Emit error event to listeners
 * @private
 */
 _emitErrorEvent(error, eventType = 'error') {
 const listeners = this._errorListeners.get(error.code) || this._errorListeners.get('*') || [];
 listeners.forEach(callback => {
 try {
 callback({ error, type: eventType, timestamp: new Date().toISOString() });
 } catch (e) {
 console.error('[Atlas] Error in error listener:', e);
 }
 });
 }
 /**
 * Get error history
 */
 getHistory() {
 return [...this._errorHistory];
 }
 /**
 * Clear error history
 */
 clearHistory() {
 this._errorHistory = [];
 }
 /**
 * Export error report for debugging
 */
 getErrorReport() {
 return {
 timestamp: new Date().toISOString(),
 totalErrors: this._errorHistory.length,
 errorsByCode: this._groupErrorsByCode(),
 recentErrors: this._errorHistory.slice(-20),
 throttledCodes: Array.from(this._errorThrottleMap.keys())
 };
 }
 /**
 * Group errors by code for analysis
 * @private
 */
 _groupErrorsByCode() {
 const grouped = {};
 this._errorHistory.forEach(entry => {
 const code = entry.error.code;
 if (!grouped[code]) {
 grouped[code] = [];
 }
 grouped[code].push(entry);
 });
 return grouped;
 }
 /**
 * Destroy handler
 */
 destroy() {
 this._errorListeners.clear();
 this._errorHistory = [];
 this._errorThrottleMap.clear();
 }
}
