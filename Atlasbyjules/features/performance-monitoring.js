
const Atlas = window.Atlas || {};
Atlas.Feature = Atlas.Feature || {};

Atlas.Feature.PerformanceMonitor = class {
 constructor(map, options = {}) {
 this._map = map;
 this._collector = new MetricsCollector(options);
 this._enabled = options.enabled !== false;
 this._monitoredMethods = new Map();
 if (this._enabled) {
 this._setupMonitoring();
 }
 }
 /**
 * Set up performance monitoring hooks
 * @private
 */
 _setupMonitoring() {
 // Monitor rendering
 this._monitorRendering();
 // Monitor tile loading
 this._monitorTileLoading();
 // Monitor interactions
 this._monitorInteractions();
 // Monitor layer operations
 this._monitorLayers();
 // Monitor memory
 this._monitorMemory();
 }
 /**
 * Monitor rendering performance
 * @private
 */
 _monitorRendering() {
 const originalDraw = this._map._draw;
 this._map._draw = function() {
 const timer = new PerformanceTimer('render.frame', this._monitor._collector, {
 zoom: Math.floor(this.zoom),
 layers: this._layers.length
 });
 originalDraw.call(this);
 timer.end();
 }.bind(this._map);
 this._map._monitor = this;
 }
 /**
 * Monitor tile loading performance
 * @private
 */
 _monitorTileLoading() {
 const baseLayer = this._map._baseLayer;
 if (!baseLayer) return;
 const originalLoadTile = baseLayer._loadTile;
 baseLayer._loadTile = async function(key, url) {
 const timer = new PerformanceTimer(
 'tile.load',
 this._map._monitor._collector,
 { tileKey: key, zoom: key.split('/')[0] }
 );
 try {
 const result = await originalLoadTile.call(this, key, url);
 timer.end();
 return result;
 } catch (error) {
 const duration = timer.elapsed();
 this._map._monitor._collector.record(
 'tile.load.error',
 duration,
 'ms',
 { tileKey: key, error: error.code }
 );
 throw error;
 }
 }.bind(baseLayer);
 baseLayer._map = this._map;
 }
 /**
 * Monitor interaction performance
 * @private
 */
 _monitorInteractions() {
 const handlers = this._map.getHandlers();
 Object.entries(handlers).forEach(([name, handler]) => {
 if (!handler) return;
 // Monitor handler-specific operations
 if (name === 'dragPan' && handler._startDrag) {
 const originalStartDrag = handler._startDrag;
 handler._startDrag = function(clientX, clientY) {
 this._map._monitor._collector.record(
 'interaction.drag.start',
 0,
 'count'
 );
 return originalStartDrag.call(this, clientX, clientY);
 }.bind(handler);
 handler._map = this._map;
 }
 });
 }
 /**
 * Monitor layer operations
 * @private
 */
 _monitorLayers() {
 const originalAddLayer = this._map.addLayer;
 this._map.addLayer = function(layer) {
 const timer = new PerformanceTimer(
 'layer.add',
 this._monitor._collector,
 { layerType: layer.constructor.name }
 );
 const result = originalAddLayer.call(this, layer);
 timer.end();
 return result;
 };
 this._map._monitor = this;
 }
 /**
 * Monitor memory usage
 * @private
 */
 _monitorMemory() {
 // Only works in browsers with performance.memory
 if (!performance.memory) return;
 const checkMemory = () => {
 this._collector.record(
 'memory.usage',
 performance.memory.usedJSHeapSize,
 'bytes'
 );
 this._collector.record(
 'memory.limit',
 performance.memory.jsHeapSizeLimit,
 'bytes'
 );
 setTimeout(checkMemory, 5000);
 };
 checkMemory();
 }
 /**
 * Get performance statistics
 */
 getStats(name) {
 return this._collector.getStatistics(name);
 }
 /**
 * Get frame statistics
 */
 getFrameStats() {
 return this._collector.getFrameStats();
 }
 /**
 * Start frame collection
 */
 startFrameCollection(durationMs = 5000) {
 this._collector.startFrameCollection(durationMs);
 }
 /**
 * Generate performance report
 */
 generateReport() {
 const report = this._collector.generateReport();
 // Add custom analysis
 report.analysis = this._analyzePerformance();
 return report;
 }
 /**
 * Analyze performance for anomalies
 * @private
 */
 _analyzePerformance() {
 const analysis = {
 warnings: [],
 recommendations: []
 };
 // Check frame time
 const renderStats = this._collector.getStatistics('render.frame');
 if (renderStats.mean && renderStats.mean > 16.67) {
 analysis.warnings.push(
 `Average frame time ${renderStats.mean.toFixed(2)}ms exceeds 60 FPS target (16.67ms)`
 );
 }
 // Check tile loading
 const tileStats = this._collector.getStatistics('tile.load');
 if (tileStats.p95 && tileStats.p95 > 5000) {
 analysis.warnings.push(
 `95th percentile tile load time ${tileStats.p95.toFixed(0)}ms is high`
 );
 }
 // Check memory
 if (performance.memory) {
 const memoryUsage =
 performance.memory.usedJSHeapSize /
 performance.memory.jsHeapSizeLimit;
 if (memoryUsage > 0.9) {
 analysis.warnings.push(
 `Memory usage at ${(memoryUsage * 100).toFixed(1)}% of limit`
 );
 analysis.recommendations.push(
 'Consider clearing unused tiles or layers'
 );
 }
 }
 return analysis;
 }
 /**
 * Export metrics
 */
 exportMetrics(format = 'json') {
 if (format === 'csv') {
 return this._collector.exportAsCSV();
 }
 return this._collector.getAllMetrics();
 }
 /**
 * Enable/disable monitoring
 */
 setEnabled(enabled) {
 this._enabled = enabled;
 this._collector.setEnabled(enabled);
 }
 /**
 * Clear metrics
 */
 clear() {
 this._collector.clear();
 }
 /**
 * Destroy monitor
 */
 destroy() {
 this._collector.destroy();
 }
}
