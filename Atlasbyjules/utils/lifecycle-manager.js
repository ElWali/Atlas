/**
 * Lifecycle Management System
 */

/**
 * Tracks and manages resource lifecycle
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.LifecycleManager = class {
  constructor() {
    this._resources = {
      timers: new Set(),
      intervals: new Set(),
      listeners: new Map(),
      observers: new Set(),
      controllers: new Set(),
      elements: new Set(),
      cleanup: new Set()
    };
    this._destroyed = false;
  }

  /**
   * Register timer
   */
  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._resources.timers.delete(id);
      fn();
    }, delay);
    this._resources.timers.add(id);
    return id;
  }

  /**
   * Register interval
   */
  setInterval(fn, interval) {
    const id = setInterval(fn, interval);
    this._resources.intervals.add(id);
    return id;
  }

  /**
   * Register event listener
   */
  addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    if (!this._resources.listeners.has(target)) {
      this._resources.listeners.set(target, []);
    }
    this._resources.listeners.get(target).push({ event, handler, options });
    return { target, event, handler, options };
  }

  /**
   * Register observer
   */
  observe(observerObj) {
    this._resources.observers.add(observerObj);
    return observerObj;
  }

  /**
   * Register abort controller
   */
  createAbortController() {
    const controller = new AbortController();
    this._resources.controllers.add(controller);
    return controller;
  }

  /**
   * Register DOM element
   */
  trackElement(element) {
    this._resources.elements.add(element);
    return element;
  }

  /**
   * Register cleanup task
   */
  onDestroy(task) {
    if (typeof task === 'function') {
      this._resources.cleanup.add(task);
    }
  }

  /**
   * Execute cleanup
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Clear timers
    for (const id of this._resources.timers) {
      clearTimeout(id);
    }
    this._resources.timers.clear();

    // Clear intervals
    for (const id of this._resources.intervals) {
      clearInterval(id);
    }
    this._resources.intervals.clear();

    // Remove event listeners
    for (const [target, listeners] of this._resources.listeners) {
      listeners.forEach(({ event, handler, options }) => {
        target.removeEventListener(event, handler, options);
      });
    }
    this._resources.listeners.clear();

    // Disconnect observers
    for (const observer of this._resources.observers) {
      if (observer.disconnect) {
        observer.disconnect();
      }
    }
    this._resources.observers.clear();

    // Abort controllers
    for (const controller of this._resources.controllers) {
      controller.abort();
    }
    this._resources.controllers.clear();

    // Remove elements
    for (const element of this._resources.elements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this._resources.elements.clear();

    // Execute cleanup tasks
    for (const task of this._resources.cleanup) {
      try {
        task();
      } catch (error) {
        console.error('[Atlas] Cleanup task failed:', error);
      }
    }
    this._resources.cleanup.clear();
  }

  /**
   * Get resource statistics
   */
  getStats() {
    return {
      timersActive: this._resources.timers.size,
      intervalsActive: this._resources.intervals.size,
      listenersActive: Array.from(this._resources.listeners.values())
        .reduce((sum, list) => sum + list.length, 0),
      observersActive: this._resources.observers.size,
      controllersActive: this._resources.controllers.size,
      elementsTracked: this._resources.elements.size,
      cleanupTasks: this._resources.cleanup.size,
      destroyed: this._destroyed
    };
  }

  /**
   * Verify clean state
   */
  isClean() {
    const stats = this.getStats();
    return stats.timersActive === 0 &&
      stats.intervalsActive === 0 &&
      stats.listenersActive === 0 &&
      stats.observersActive === 0 &&
      stats.controllersActive === 0 &&
      stats.elementsTracked === 0;
  }
}
