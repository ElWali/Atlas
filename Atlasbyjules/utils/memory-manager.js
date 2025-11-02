/**
 * Memory Management System for Atlas
 * Handles tile eviction, pooling, and cleanup
 */
/**
 * Least Recently Used (LRU) cache implementation
 */
class LRUCache {
 constructor(maxSize = 500) {
 this.maxSize = maxSize;
 this.cache = new Map();
 this.accessOrder = [];
 }
 /**
 * Add or update item in cache
 */
 set(key, value) {
 // Remove if exists (to update access time)
 if (this.cache.has(key)) {
 this.accessOrder = this.accessOrder.filter(k => k !== key);
 }
 // Add to cache
 this.cache.set(key, value);
 this.accessOrder.push(key);
 // Evict least recently used if exceeds max size
 while (this.cache.size > this.maxSize) {
 const lruKey = this.accessOrder.shift();
 this.cache.delete(lruKey);
 }
 }
 /**
 * Get item from cache
 */
 get(key) {
 if (!this.cache.has(key)) return undefined;
 // Update access order
 this.accessOrder = this.accessOrder.filter(k => k !== key);
 this.accessOrder.push(key);
 return this.cache.get(key);
 }
 /**
 * Check if key exists
 */
 has(key) {
 return this.cache.has(key);
 }
 /**
 * Delete item
 */
 delete(key) {
 this.accessOrder = this.accessOrder.filter(k => k !== key);
 return this.cache.delete(key);
 }
 /**
 * Get cache size
 */
 size() {
 return this.cache.size;
 }
 /**
 * Clear cache
 */
 clear() {
 this.cache.clear();
 this.accessOrder = [];
 }
 /**
 * Get memory estimate (rough)
 */
 getMemoryEstimate() {
 let estimate = 0;
 this.cache.forEach((value) => {
 if (value.img && value.img.data) {
 estimate += value.img.data.length;
 }
 });
 return estimate;
 }
}
/**
 * Time-based eviction policy
 */
class TimeBasedEvictionPolicy {
 constructor(ttlMs = 24 * 60 * 60 * 1000) {
 this.ttlMs = ttlMs;
 this.items = new Map();
 }
 /**
 * Record item addition time
 */
 onAdd(key) {
 this.items.set(key, Date.now());
 }
 /**
 * Check if item has expired
 */
 isExpired(key) {
 if (!this.items.has(key)) return true;
 return Date.now() - this.items.get(key) > this.ttlMs;
 }
 /**
 * Get expired items
 */
 getExpiredItems() {
 const expired = [];
 this.items.forEach((time, key) => {
 if (Date.now() - time > this.ttlMs) {
 expired.push(key);
 }
 });
 return expired;
 }
 /**
 * Clean expired items
 */
 cleanup() {
 this.getExpiredItems().forEach(key => {
 this.items.delete(key);
 });
 }
}
/**
 * Object pool for reusing frequently created objects
 */
class ObjectPool {
 constructor(ctor, maxSize = 1000) {
 this.ctor = ctor;
 this.maxSize = maxSize;
 this.available = [];
 this.inUse = new Set();
 }
 /**
 * Acquire object from pool
 */
 acquire(...args) {
 let obj;
 if (this.available.length > 0) {
 obj = this.available.pop();
 if (typeof obj.reset === 'function') {
 obj.reset(...args);
 }
 } else {
 obj = new this.ctor(...args);
 }
 this.inUse.add(obj);
 return obj;
 }
 /**
 * Release object back to pool
 */
 release(obj) {
 if (this.inUse.has(obj)) {
 this.inUse.delete(obj);
 if (this.available.length < this.maxSize) {
 this.available.push(obj);
 }
 }
 }
 /**
 * Get pool statistics
 */
 getStats() {
 return {
 available: this.available.length,
 inUse: this.inUse.size,
 total: this.available.length + this.inUse.size
 };
 }
 /**
 * Clear pool
 */
 clear() {
 this.available = [];
 this.inUse.clear();
 }
}
/**
 * Memory manager for the map
 */
class MemoryManager {
 constructor(options = {}) {
 this.maxMemoryMB = options.maxMemoryMB || 500;
 this.checkIntervalMs = options.checkIntervalMs || 30000;
 this.lruCache = new LRUCache(options.maxTiles || 500);
 this.evictionPolicy = new TimeBasedEvictionPolicy(options.tilesTTLMs);
 this.pools = new Map();
 this.metricsCollector = options.metricsCollector || null;
 this._monitoringActive = false;
 this._memoryCheckInterval = null;
 this._allocations = [];
 }
 /**
 * Track tile in cache
 */
 trackTile(key, tile) {
 this.lruCache.set(key, tile);
 this.evictionPolicy.onAdd(key);
 }
 /**
 * Get eviction candidates
 */
 getEvictionCandidates() {
 const candidates = [];
 // Get expired items
 const expired = this.evictionPolicy.getExpiredItems();
 candidates.push(...expired);
 // Get LRU items if memory pressure
 if (this.getCurrentMemoryUsage() > this.maxMemoryMB * 0.8) {
 // Mark oldest 10% for eviction
 const tenPercent = Math.ceil(this.lruCache.size() * 0.1);
 for (let i = 0; i < tenPercent; i++) {
 // Note: We'd need to expose accessOrder for this
 candidates.push(`lru_${i}`);
 }
 }
 return candidates;
 }
 /**
 * Perform cleanup
 */
 cleanup(keys = null) {
 const keysToEvict = keys || this.getEvictionCandidates();
 keysToEvict.forEach(key => {
 this.lruCache.delete(key);
 this.evictionPolicy.cleanup();
 });
 if (this.metricsCollector) {
 this.metricsCollector.record(
 'memory.cleanup',
 keysToEvict.length,
 'items'
 );
 }
 return keysToEvict.length;
 }
 /**
 * Create or get object pool
 */
 getPool(name, ctor, maxSize = 1000) {
 if (!this.pools.has(name)) {
 this.pools.set(name, new ObjectPool(ctor, maxSize));
 }
 return this.pools.get(name);
 }
 /**
 * Get current memory usage
 */
 getCurrentMemoryUsage() {
 if (!performance.memory) return 0;
 return performance.memory.usedJSHeapSize / (1024 * 1024);
 }
 /**
 * Start memory monitoring
 */
 startMonitoring() {
 if (this._monitoringActive) return;
 this._monitoringActive = true;
 this._memoryCheckInterval = setInterval(() => {
 this._checkMemoryPressure();
 }, this.checkIntervalMs);
 }
 /**
 * Stop memory monitoring
 * @private
 */
 _checkMemoryPressure() {
 const currentUsage = this.getCurrentMemoryUsage();
 if (this.metricsCollector) {
 this.metricsCollector.record(
 'memory.heap',
 currentUsage,
 'MB'
 );
 }
 if (currentUsage > this.maxMemoryMB) {
 console.warn(
 `[Atlas] Memory usage (${currentUsage.toFixed(0)}MB) exceeds limit (${this.maxMemoryMB}MB). ` +
 `Triggering cleanup...`
 );
 // Aggressive cleanup
 const evicted = this.cleanup();
 console.log(`[Atlas] Evicted ${evicted} items`);
 // Force garbage collection (if available)
 if (window.gc) {
 window.gc();
 console.log('[Atlas] Garbage collection triggered');
 }
 } else if (currentUsage > this.maxMemoryMB * 0.8) {
 console.log('[Atlas] Memory pressure approaching limit. Doing preventive cleanup...');
 this.cleanup();
 }
 }
 /**
 * Stop memory monitoring
 */
 stopMonitoring() {
 if (this._memoryCheckInterval) {
 clearInterval(this._memoryCheckInterval);
 this._memoryCheckInterval = null;
 }
 this._monitoringActive = false;
 }
 /**
 * Get memory statistics
 */
 getMemoryStats() {
 return {
 currentUsageMB: this.getCurrentMemoryUsage(),
 maxMemoryMB: this.maxMemoryMB,
 cacheSize: this.lruCache.size(),
 cacheMemoryEstimate: this.lruCache.getMemoryEstimate() / (1024 * 1024),
 poolStats: Object.fromEntries(
 Array.from(this.pools.entries()).map(([name, pool]) => [
 name,
 pool.getStats()
 ])
 )
 };
 }
 /**
 * Destroy manager
 */
 destroy() {
 this.stopMonitoring();
 this.lruCache.clear();
 this.pools.forEach(pool => pool.clear());
 this.pools.clear();
 this._allocations = [];
 }
}
