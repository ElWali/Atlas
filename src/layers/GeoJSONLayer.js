import { Layer } from './Layer.js';
import { SimpleSpatialIndexWorld } from '../utils/spatial-index.js';
import { GISUtils } from '../utils/gis.js';
import { rot } from '../utils/constants.js';

// GeoJSON Layer using world-space spatial index to avoid rebuilds on pan/zoom
export class GeoJSONLayer extends Layer {
  constructor(geojson, options = {}) {
    super(options);
    this._geojson = this._normalizeGeoJSON(geojson);
    this._features = [];
    this._featureCache = new Map();
    this._worldIndex = null;
    this._worldBBoxes = new Map(); // Map feature -> bbox in projected coords
    this.options.style = options.style || { color: '#3388ff', weight: 3, opacity: 1, fillColor: '#3388ff', fillOpacity: 0.2 };
    this.options.interactive = options.interactive !== undefined ? options.interactive : true;
    this.options.draggable = options.draggable !== undefined ? options.draggable : false;
    this._draggingFeature = null;
    this._dragStartPoint = null;
    this._originalCoords = null;
    this._lastProcessed = { zoom: null, center: null, bearing: null };
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseOut = this._onMouseOut.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMoveDrag = this._onMouseMoveDrag.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }
  _normalizeGeoJSON(input) {
    if (!input) return { type: 'FeatureCollection', features: [] };
    if (Array.isArray(input)) return { type: 'FeatureCollection', features: input.map(f => f.type === 'Feature' ? f : { type: 'Feature', geometry: f, properties: {} }) };
    if (input.type === 'FeatureCollection') return input;
    if (input.type === 'Feature') return { type: 'FeatureCollection', features: [input] };
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: input, properties: {} }] };
  }
  _latLngToScreenPoint(coord) {
    if (!this._map) return { x: 0, y: 0 };
    const [lon, lat] = coord;
    const w = this._map.canvas.width / this._map.dpr;
    const h = this._map.canvas.height / this._map.dpr;
    const zInt = Math.floor(this._map.zoom);
    const ts = TILE_SIZE * Math.pow(2, this._map.zoom - zInt);
    const ct = this._map.projection.latLngToTile(this._map.center, zInt);
    const pt = this._map.projection.latLngToTile({ lat, lon }, zInt);
    const trX = (pt.x - ct.x) * ts;
    const trY = (pt.y - ct.y) * ts;
    const anchorVec = rot(trX, trY, this._map.bearing);
    return { x: w / 2 + anchorVec.x, y: h / 2 + anchorVec.y };
  }
  _getFeatureStyle(feature) { return typeof this.options.style === 'function' ? this.options.style(feature) : this.options.style; }
  _processFeature(feature) {
    // Always return fresh screen-space coordinates for current map transform (no screen cache across views)
    if (!this._map) return null;
    const geometry = feature.geometry;
    const processed = { type: geometry.type, coordinates: null, properties: feature.properties };
    switch (geometry.type) {
      case 'Point': processed.coordinates = this._latLngToScreenPoint(geometry.coordinates); break;
      case 'MultiPoint': processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord)); break;
      case 'LineString': processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord)); break;
      case 'MultiLineString': processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord))); break;
      case 'Polygon': processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord))); break;
      case 'MultiPolygon': processed.coordinates = geometry.coordinates.map(polygon => polygon.map(ring => ring.map(coord => this._latLngToScreenPoint(coord)))); break;
      default: return null;
    }
    return processed;
  }
  _renderPoint(ctx, feature, style) {
    const { x, y } = feature.coordinates;
    ctx.beginPath(); ctx.arc(x, y, style.radius || 5, 0, 2 * Math.PI);
    ctx.fillStyle = style.fillColor || style.color || '#3388ff'; ctx.fill();
    if (style.stroke !== false) { ctx.strokeStyle = style.color || '#3388ff'; ctx.lineWidth = style.weight || 2; ctx.globalAlpha = style.opacity || 1; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  _renderLineString(ctx, feature, style) {
    const coords = feature.coordinates;
    if (coords.length < 2) return;
    ctx.beginPath(); ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
    ctx.strokeStyle = style.color || '#3388ff'; ctx.lineWidth = style.weight || 3; ctx.globalAlpha = style.opacity || 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  _renderPolygon(ctx, feature, style) {
    const rings = feature.coordinates;
    if (rings.length === 0) return;
    ctx.beginPath();
    for (const ring of rings) {
      if (ring.length < 3) continue;
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x, ring[i].y);
      ctx.closePath();
    }
    if (style.fill !== false) { ctx.fillStyle = style.fillColor || style.color || '#3388ff'; ctx.globalAlpha = style.fillOpacity || 0.2; ctx.fill(); ctx.globalAlpha = 1; }
    if (style.stroke !== false) { ctx.strokeStyle = style.color || '#3388ff'; ctx.lineWidth = style.weight || 3; ctx.globalAlpha = style.opacity || 1; ctx.stroke(); ctx.globalAlpha = 1; }
  }
  _pointInPolygon(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, yi = ring[i].y;
      const xj = ring[j].x, yj = ring[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  // HIT detection using world index -> reduce rebuilds on pan/zoom.
  _hitDetect(x, y) {
    if (!this._spatialIndex || !this._map) return null;
    // convert screen x,y to world meters using map.screenToLatLon + projection
    const latlon = this._map.screenToLatLon(x, y);
    const meters = this._map.projection.project({ lat: latlon.lat, lon: latlon.lon });
    // tolerance in pixels -> meters
    const tolerancePx = 8;
    const res = GISUtils.getResolution(this._map.center.lat, this._map.zoom); // meters per pixel
    const tolMeters = tolerancePx * res;
    const nearby = this._spatialIndex.queryPoint(meters.x, meters.y, tolMeters);
    for (const feature of nearby) {
      const processed = this._processFeature(feature);
      if (!processed) continue;
      switch (processed.type) {
        case 'Point':
          const dist = Math.hypot(x - processed.coordinates.x, y - processed.coordinates.y);
          if (dist <= (this._getFeatureStyle(feature).radius || 5) + 5) return feature;
          break;
        case 'Polygon':
          for (const ring of processed.coordinates) if (this._pointInPolygon(x, y, ring)) return feature;
          break;
      }
    }
    return null;
  }
  _getFeatureBBoxWorld(feature) {
    // compute bbox in projected meters for the feature geometry
    if (!feature || !feature.geometry) return null;
    const geometry = feature.geometry;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const addPoint = (lon, lat) => {
      const p = this._map.projection.project({ lat, lon });
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    };
    switch (geometry.type) {
      case 'Point': addPoint(geometry.coordinates[0], geometry.coordinates[1]); break;
      case 'MultiPoint': geometry.coordinates.forEach(c => addPoint(c[0], c[1])); break;
      case 'LineString': geometry.coordinates.forEach(c => addPoint(c[0], c[1])); break;
      case 'MultiLineString': geometry.coordinates.forEach(line => line.forEach(c => addPoint(c[0], c[1]))); break;
      case 'Polygon': geometry.coordinates.forEach(ring => ring.forEach(c => addPoint(c[0], c[1]))); break;
      case 'MultiPolygon': geometry.coordinates.forEach(p => p.forEach(ring => ring.forEach(c => addPoint(c[0], c[1])))); break;
      default: return null;
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }
  _buildSpatialIndex() {
    this._worldIndex = new SimpleSpatialIndexWorld(50000);
    this._worldBBoxes.clear();
    for (const feature of this._features) {
      const bbox = this._getFeatureBBoxWorld(feature);
      if (bbox) {
        this._worldIndex.insert(bbox, feature);
        this._worldBBoxes.set(feature, bbox);
      }
    }
    // alias to older name used above
    this._spatialIndex = this._worldIndex;
  }
  _onMouseMove(e) {
    if (this._draggingFeature) return;
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const feature = this._hitDetect(x, y);
    if (feature) { this._map.canvas.style.cursor = 'pointer'; this.fire('mousemove', { originalEvent: e, feature }); }
    else { this._map.canvas.style.cursor = 'grab'; this.fire('mouseout', { originalEvent: e }); }
  }
  _onMouseOut(e) { this._map.canvas.style.cursor = 'grab'; this.fire('mouseout', { originalEvent: e }); }
  _onClick(e) {
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const feature = this._hitDetect(x, y);
    if (feature) this.fire('click', { originalEvent: e, feature });
  }
  _onMouseDown(e) {
    if (!this.options.draggable || e.button !== 0) return;
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const feature = this._hitDetect(x, y);
    if (feature && feature.geometry.type === 'Point') {
      e.preventDefault();
      this._startDrag(feature, x, y);
    }
  }
  _startDrag(feature, clientX, clientY) {
    if (feature.geometry.type !== 'Point') return;
    this._draggingFeature = feature;
    this._dragStartPoint = { x: clientX, y: clientY };
    this._originalCoords = [...feature.geometry.coordinates];
    this._map.canvas.style.cursor = 'grabbing';
    this._map.container.classList.add('dragging');
    // listen to move/up at document level
    document.addEventListener('mousemove', this._onMouseMoveDrag);
    document.addEventListener('mouseup', this._onMouseUp);
  }
  _onMouseMoveDrag(e) {
    if (!this._draggingFeature) return;
    e.preventDefault();
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newLatLng = this._map.screenToLatLon(x, y);
    this._draggingFeature.geometry.coordinates = [newLatLng.lon, newLatLng.lat];
    // update world bbox + spatial index (we rebuild index for simplicity on feature move)
    this._buildSpatialIndex();
    if (this._map) this._map.render();
    this.fire('drag', { originalEvent: e, feature: this._draggingFeature, latlng: newLatLng });
  }
  _onMouseUp(e) {
    if (!this._draggingFeature) return;
    const rect = this._map.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const finalLatLng = this._map.screenToLatLon(x, y);
    // keep reference to dragged feature for the event
    const draggedFeature = this._draggingFeature;
    draggedFeature.geometry.coordinates = [finalLatLng.lon, finalLatLng.lat];
    this._buildSpatialIndex();
    this._draggingFeature = null;
    this._dragStartPoint = null;
    this._originalCoords = null;
    this._map.canvas.style.cursor = 'grab';
    this._map.container.classList.remove('dragging');
    document.removeEventListener('mousemove', this._onMouseMoveDrag);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.fire('dragend', { originalEvent: e, feature: draggedFeature, latlng: finalLatLng });
    if (this._map) this._map.render();
  }
  onAdd() {
    this._features = this._geojson.features || [];
    if (!this._map) return;
    this._buildSpatialIndex();
    if (this.options.interactive) {
      this.addDomListener(this._map.canvas, 'mousemove', this._onMouseMove, { passive: true });
      this.addDomListener(this._map.canvas, 'mouseout', this._onMouseOut, { passive: true });
      this.addDomListener(this._map.canvas, 'click', this._onClick, { passive: true });
      if (this.options.draggable) this.addDomListener(this._map.canvas, 'mousedown', this._onMouseDown, { passive: false });
    }
    this.fire('add');
  }
  onRemove() {
    if (this.options.interactive) {
      // remove stored dom listeners
      this.removeDomListeners();
      if (this.options.draggable) {
        document.removeEventListener('mousemove', this._onMouseMoveDrag);
        document.removeEventListener('mouseup', this._onMouseUp);
      }
    }
    this._featureCache.clear();
    if (this._spatialIndex) this._spatialIndex.clear();
    this.fire('remove');
  }
  render() {
    if (!this._map) return;
    const ctx = this._map.ctx;
    ctx.save();
    for (const feature of this._features) {
      const processed = this._processFeature(feature);
      if (!processed) continue;
      const style = this._getFeatureStyle(feature);
      switch (processed.type) {
        case 'Point': this._renderPoint(ctx, processed, style); break;
        case 'LineString': this._renderLineString(ctx, processed, style); break;
        case 'Polygon': this._renderPolygon(ctx, processed, style); break;
        case 'MultiPoint': processed.coordinates.forEach(c => { this._renderPoint(ctx, { coordinates: c }, style); }); break;
        case 'MultiLineString': processed.coordinates.forEach(ls => this._renderLineString(ctx, { coordinates: ls }, style)); break;
        case 'MultiPolygon': processed.coordinates.forEach(p => this._renderPolygon(ctx, { coordinates: p }, style)); break;
      }
    }
    ctx.restore();
  }
  setData(geojson) { this._geojson = this._normalizeGeoJSON(geojson); this._features = this._geojson.features || []; this._featureCache.clear(); this._buildSpatialIndex(); if (this._map) this._map.render(); return this; }
  getData() { return this._geojson; }
}