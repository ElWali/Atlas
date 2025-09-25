// Simple spatial index in world (projected meters)
export class SimpleSpatialIndexWorld {
  constructor(cellSize = 50000) { // meters by default
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  _keyForXY(x, y) { const cx = Math.floor(x / this.cellSize); const cy = Math.floor(y / this.cellSize); return `${cx}_${cy}`; }
  insert(bbox, feature) {
    const { minX, minY, maxX, maxY } = bbox;
    const startCellX = Math.floor(minX / this.cellSize); const endCellX = Math.floor(maxX / this.cellSize);
    const startCellY = Math.floor(minY / this.cellSize); const endCellY = Math.floor(maxY / this.cellSize);
    for (let cx = startCellX; cx <= endCellX; cx++) for (let cy = startCellY; cy <= endCellY; cy++) {
      const key = `${cx}_${cy}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push({ feature, bbox });
    }
  }
  queryPoint(x, y, tolerance = 0) {
    // expand by tolerance
    const minX = x - tolerance, maxX = x + tolerance, minY = y - tolerance, maxY = y + tolerance;
    const startCellX = Math.floor(minX / this.cellSize); const endCellX = Math.floor(maxX / this.cellSize);
    const startCellY = Math.floor(minY / this.cellSize); const endCellY = Math.floor(maxY / this.cellSize);
    const results = new Set();
    for (let cx = startCellX; cx <= endCellX; cx++) for (let cy = startCellY; cy <= endCellY; cy++) {
      const key = `${cx}_${cy}`;
      const arr = this.grid.get(key);
      if (!arr) continue;
      for (const item of arr) results.add(item.feature);
    }
    return Array.from(results);
  }
  clear() { this.grid.clear(); }
}