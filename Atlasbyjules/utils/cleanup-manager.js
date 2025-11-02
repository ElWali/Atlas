/**
 * Cleanup Manager for Atlas resources
 * Ensures proper cleanup and prevents memory leaks
 */
class CleanupManager {
 constructor() {
 this._cleanupTasks = [];
 this._isDestroyed = false;
 }
 /**
 * Register cleanup task
 */
 onDestroy(task) {
 if (typeof task === 'function') {
 this._cleanupTasks.push(task);
 }
 }
 /**
 * Execute all cleanup tasks
 */
 executeCleanup() {
 if (this._isDestroyed) return;
 this._cleanupTasks.forEach((task, index) => {
 try {
 task();
 } catch (error) {
 console.error(`[Atlas] Cleanup task ${index} failed:`, error);
 }
 });
 this._cleanupTasks = [];
 this._isDestroyed = true;
 }
 /**
 * Get cleanup queue size
 */
 getQueueSize() {
 return this._cleanupTasks.length;
 }
}
