// LRU Cache implementation (simple, based on Map insertion order)
export class LRUCache {
  constructor(maxSize = 800) {
    this.maxSize = maxSize;
    this._map = new Map(); // keys insertion order (oldest-first)
  }
  has(key) { return this._map.has(key); }
  get(key) {
    if (!this._map.has(key)) return undefined;
    const val = this._map.get(key);
    // move to newest (end)
    this._map.delete(key);
    this._map.set(key, val);
    return val;
  }
  peek(key) {
    return this._map.get(key);
  }
  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, value);
    // If over capacity, remove oldest
    if (this._map.size > this.maxSize) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    return value;
  }
  delete(key) { return this._map.delete(key); }
  clear() { this._map.clear(); }
  get size() { return this._map.size; }
  keys() { return Array.from(this._map.keys()); } // oldest->newest
  entries() { return Array.from(this._map.entries()); } // oldest->newest
  // prune: remove up to count entries not present in protectedSet (which is a Set)
  prune(count, protectedSet = new Set()) {
    const removed = [];
    if (count <= 0) return removed;
    for (const k of this._map.keys()) {
      if (removed.length >= count) break;
      if (protectedSet.has(k)) continue;
      this._map.delete(k);
      removed.push(k);
    }
    return removed;
  }
}