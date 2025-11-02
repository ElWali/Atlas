/**
 * Performance Metrics Collection System
 * Tracks and analyzes Atlas performance
 */
/**
 * Individual metric entry
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.MetricEntry = class {
 constructor(name, value, unit = 'ms', tags = {}) {
 this.name = name;
 this.value = value;
 this.unit = unit;
 this.tags = tags;
 this.timestamp = Date.now();
 }
 toJSON() {
 return {
 name: this.name,
 value: this.value,
 unit: this.unit,
 tags: this.tags,
 timestamp: this.timestamp
 };
 }
}
/**
 * Statistical calculator for metrics
 */
class StatisticCalculator {
 constructor(values = []) {
 this.values = [...values];
 }
 add(value) {
 this.values.push(value);
 }
 count() {
 return this.values.length;
 }
 mean() {
 if (this.values.length === 0) return 0;
 return this.values.reduce((a, b) => a + b, 0) / this.values.length;
 }
 median() {
 if (this.values.length === 0) return 0;
 const sorted = [...this.values].sort((a, b) => a - b);
 const mid = Math.floor(sorted.length / 2);
 return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
 }
 min() {
 return this.values.length === 0 ? 0 : Math.min(...this.values);
 }
 max() {
 return this.values.length === 0 ? 0 : Math.max(...this.values);
 }
 p95() {
 if (this.values.length === 0) return 0;
 const sorted = [...this.values].sort((a, b) => a - b);
 const index = Math.ceil(sorted.length * 0.95) - 1;
 return sorted[Math.max(0, index)];
 }
 p99() {
 if (this.values.length === 0) return 0;
 const sorted = [...this.values].sort((a, b) => a - b);
 const index = Math.ceil(sorted.length * 0.99) - 1;
 return sorted[Math.max(0, index)];
 }
 stdDev() {
 const mean = this.mean();
 const squaredDiffs = this.values.map(v => Math.pow(v - mean, 2));
 const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.values.length;
 return Math.sqrt(variance);
 }
 summary() {
 return {
 count: this.count(),
 mean: this.mean(),
 median: this.median(),
 min: this.min(),
 max: this.max(),
 p95: this.p95(),
 p99: this.p99(),
 stdDev: this.stdDev()
 };
 }
}
/**
 * Core metrics collector
 */
class MetricsCollector {
 constructor(options = {}) {
 this._enabled = options.enabled !== false;
 this._maxMetrics = options.maxMetrics || 10000;
 this._metrics = [];
 this._buckets = new Map();
 this._observers = [];
 this._startTime = Date.now();
 this._frameMetrics = [];
 this._isCollectingFrames = false;
 }
 /**
 * Record a metric
 */
 record(name, value, unit = 'ms', tags = {}) {
 if (!this._enabled) return;
 const entry = new MetricEntry(name, value, unit, tags);
 this._metrics.push(entry);
 // Maintain bucket statistics
 this._updateBucket(name, value, tags);
 // Trim old metrics if needed
 if (this._metrics.length > this._maxMetrics) {
 this._metrics = this._metrics.slice(-this._maxMetrics);
 }
 // Notify observers
 this._notifyObservers(entry);
 }
 /**
 * Start recording frame metrics
 */
 startFrameCollection(durationMs = 5000) {
 if (this._isCollectingFrames) return;
 this._isCollectingFrames = true;
 this._frameMetrics = [];
 const startTime = performance.now();
 let lastFrameTime = startTime;
 const measureFrame = () => {
 const currentTime = performance.now();
 const frameDelta = currentTime - lastFrameTime;
 const elapsedTotal = currentTime - startTime;
 this._frameMetrics.push({ delta: frameDelta, timestamp: currentTime, fps: 1000 / Math.max(1, frameDelta) });
 lastFrameTime = currentTime;
 if (elapsedTotal < durationMs) {
 requestAnimationFrame(measureFrame);
 } else {
 this._isCollectingFrames = false;
 }
 };
 requestAnimationFrame(measureFrame);
 }
 /**
 * Get frame statistics
 */
 getFrameStats() {
 const deltas = this._frameMetrics.map(m => m.delta);
 const fpsList = this._frameMetrics.map(m => m.fps);
 const deltaStats = new StatisticCalculator(deltas);
 const fpsStats = new StatisticCalculator(fpsList);
 return {
 frameCount: this._frameMetrics.length,
 deltaStats: deltaStats.summary(),
 fpsStats: fpsStats.summary(),
 rawFrames: this._frameMetrics.slice(-100) // Last 100 frames
 };
 }
 /**
 * Update metric bucket
 * @private
 */
 _updateBucket(name, value, tags) {
 const key = this._getBucketKey(name, tags);
 if (!this._buckets.has(key)) {
 this._buckets.set(key, new StatisticCalculator());
 }
 this._buckets.get(key).add(value);
 }
 /**
 * Generate bucket key from metric name and tags
 * @private
 */
 _getBucketKey(name, tags) {
 const tagStr = Object.entries(tags)
 .sort()
 .map(([k, v]) => `${k}:${v}`)
 .join('|');
 return `${name}${tagStr ? '|' + tagStr : ''}`;
 }
 /**
 * Register observer for metric events
 */
 observe(callback) {
 this._observers.push(callback);
 }
 /**
 * Notify all observers
 * @private
 */
 _notifyObservers(entry) {
 this._observers.forEach(observer => {
 try {
 observer(entry);
 } catch (e) {
 console.error('[Atlas] Metrics observer error:', e);
 }
 });
 }
 /**
 * Get aggregate statistics by metric name
 */
 getStatistics(name, tags = {}) {
 const key = this._getBucketKey(name, tags);
 const bucket = this._buckets.get(key);
 if (!bucket) {
 return { error: 'No data collected for this metric' };
 }
 return { name, tags, ...bucket.summary() };
 }
 /**
 * Get all collected metrics
 */
 getAllMetrics() {
 return this._metrics.map(m => m.toJSON());
 }
 /**
 * Get metrics filtered by name and time range
 */
 filterMetrics(namePattern, startTime, endTime) {
 const regex = new RegExp(namePattern);
 return this._metrics.filter(m =>
 regex.test(m.name) &&
 m.timestamp >= startTime &&
 m.timestamp <= endTime
 );
 }
 /**
 * Generate performance report
 */
 generateReport() {
 const report = {
 timestamp: Date.now(),
 uptime: Date.now() - this._startTime,
 metricsCollected: this._metrics.length,
 uniqueMetrics: this._buckets.size,
 bucketSummaries: {}
 };
 this._buckets.forEach((bucket, key) => {
 report.bucketSummaries[key] = bucket.summary();
 });
 return report;
 }
 /**
 * Export metrics as CSV
 */
 exportAsCSV() {
 let csv = 'name,value,unit,tags,timestamp\n';
 this._metrics.forEach(m => {
 const tagsStr = JSON.stringify(m.tags).replace(/"/g, '""');
 csv += `"${m.name}",${m.value},"${m.unit}","${tagsStr}",${m.timestamp}\n`;
 });
 return csv;
 }
 /**
 * Clear all metrics
 */
 clear() {
 this._metrics = [];
 this._buckets.clear();
 this._frameMetrics = [];
 }
 /**
 * Enable/disable collection
 */
 setEnabled(enabled) {
 this._enabled = enabled;
 }
 /**
 * Destroy collector
 */
 destroy() {
 this._observers = [];
 this.clear();
 }
}
/**
 * Performance timer for measuring code blocks
 */
class PerformanceTimer {
 constructor(name, collector, tags = {}) {
 this.name = name;
 this.collector = collector;
 this.tags = tags;
 this.startTime = performance.now();
 this.marks = {};
 }
 /**
 * Mark a point in time
 */
 mark(name) {
 this.marks[name] = performance.now();
 }
 /**
 * Measure duration between marks
 */
 measure(startMark, endMark) {
 const start = this.marks[startMark];
 const end = this.marks[endMark];
 if (start === undefined || end === undefined) {
 return null;
 }
 return end - start;
 }
 /**
 * End timer and record metric
 */
 end() {
 const duration = performance.now() - this.startTime;
 this.collector.record(this.name, duration, 'ms', this.tags);
 return duration;
 }
 /**
 * Get elapsed time without ending
 */
 elapsed() {
 return performance.now() - this.startTime;
 }
}
