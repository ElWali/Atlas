/**
 * Event Delegation System for Atlas
 * Optimizes event handling through delegation
 */

/**
 * Event target matcher
 */
const Atlas = window.Atlas || {};
Atlas.Util = Atlas.Util || {};

Atlas.Util.EventMatcher = class {
  constructor(selector) {
    this.selector = selector;
  }

  /**
   * Check if element matches selector
   */
  matches(element) {
    if (!element) return false;
    if (this.selector === '*') return true;
    if (this.selector.startsWith('.')) {
      return element.classList.contains(this.selector.slice(1));
    }
    if (this.selector.startsWith('#')) {
      return element.id === this.selector.slice(1);
    }
    return element.tagName.toLowerCase() === this.selector.toLowerCase();
  }

  /**
   * Find closest ancestor matching selector
   */
  closest(element) {
    let current = element;
    while (current) {
      if (this.matches(current)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }
}

/**
 * Delegated event listener
 */
class DelegatedEventListener {
  constructor(eventType, selector, handler, options = {}) {
    this.eventType = eventType;
    this.selector = selector;
    this.handler = handler;
    this.options = options;
    this.matcher = new EventMatcher(selector);
    this.id = this._generateId();
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `${this.eventType}:${this.selector}:${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if listener matches event
   */
  matches(event) {
    const target = this.matcher.closest(event.target);
    return target !== null;
  }

  /**
   * Execute listener
   */
  execute(event) {
    const target = this.matcher.closest(event.target);
    if (target) {
      this.handler.call(target, event);
    }
  }

  /**
   * Check if listener should be removed
   */
  shouldRemove(selector, handler) {
    return this.selector === selector && this.handler === handler;
  }
}

/**
 * Delegation manager for a specific container
 */
class EventDelegationManager {
  constructor(container) {
    this.container = container;
    this.listeners = new Map();
    this._captureListeners = new Map();
    this._nativeListeners = new Map();
  }

  /**
   * Add delegated event listener
   */
  on(eventType, selector, handler, options = {}) {
    const listener = new DelegatedEventListener(eventType, selector, handler, options);
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
      this._setupNativeListener(eventType, options.capture || false);
    }
    this.listeners.get(eventType).push(listener);
    return listener.id;
  }

  /**
   * Remove delegated event listener
   */
  off(eventType, selector, handler) {
    if (!this.listeners.has(eventType)) return false;
    const listeners = this.listeners.get(eventType);
    const initialLength = listeners.length;
    // Remove matching listeners
    this.listeners.set(
      eventType,
      listeners.filter(l => !l.shouldRemove(selector, handler))
    );
    const removed = this.listeners.get(eventType).length < initialLength;
    // Clean up native listener if no more delegated listeners
    if (this.listeners.get(eventType).length === 0) {
      this._teardownNativeListener(eventType);
      this.listeners.delete(eventType);
    }
    return removed;
  }

  /**
   * Remove listener by ID
   */
  offById(listenerId) {
    for (const [eventType, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this._teardownNativeListener(eventType);
          this.listeners.delete(eventType);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Set up native event listener
   * @private
   */
  _setupNativeListener(eventType, capture = false) {
    const handler = (event) => {
      const listeners = this.listeners.get(eventType) || [];
      listeners.forEach(listener => {
        if (listener.matches(event)) {
          listener.execute(event);
        }
      });
    };
    const mapToUse = capture ? this._captureListeners : this._nativeListeners;
    mapToUse.set(eventType, handler);
    this.container.addEventListener(eventType, handler, { capture });
  }

  /**
   * Tear down native event listener
   * @private
   */
  _teardownNativeListener(eventType) {
    const nativeHandler = this._nativeListeners.get(eventType);
    const captureHandler = this._captureListeners.get(eventType);
    if (nativeHandler) {
      this.container.removeEventListener(eventType, nativeHandler, false);
      this._nativeListeners.delete(eventType);
    }
    if (captureHandler) {
      this.container.removeEventListener(eventType, captureHandler, true);
      this._captureListeners.delete(eventType);
    }
  }

  /**
   * Get listener count
   */
  getListenerCount(eventType = null) {
    if (eventType) {
      return (this.listeners.get(eventType) || []).length;
    }
    let total = 0;
    this.listeners.forEach(listeners => {
      total += listeners.length;
    });
    return total;
  }

  /**
   * Get all listeners
   */
  getAllListeners() {
    const result = {};
    this.listeners.forEach((listeners, eventType) => {
      result[eventType] = listeners.map(l => ({ selector: l.selector, id: l.id }));
    });
    return result;
  }

  /**
   * Destroy delegation manager
   */
  destroy() {
    for (const eventType of Array.from(this.listeners.keys())) {
      this._teardownNativeListener(eventType);
    }
    this.listeners.clear();
    this._nativeListeners.clear();
    this._captureListeners.clear();
  }
}
