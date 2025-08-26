/*!
 * Atlas.js — MIT License
 * Next-Level JavaScript Mapping Library
 *
 * Author: Atlasian! from Tarfaya.
 * License: MIT
 * @version 1.0.0
 * @module Atlas
 */

/**
 * @typedef {Object} LatLng
 * @property {number} lat
 * @property {number} lng
 */

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} LatLngBounds
 * @property {LatLng} _sw
 * @property {LatLng} _ne
 */

(function (global) {
  "use strict";

  /* ========= Utilities ========= */
  const Util = {
    div: (cls, parent) => {
      const d = document.createElement("div");
      if (cls) d.className = cls;
      if (parent) parent.appendChild(d);
      return d;
    },
    easeInOutCubic: (t) =>
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    simplify(points, tolerance) {
      if (points.length <= 2) return points;
      const sqTolerance = tolerance * tolerance;
      let marker_index = 0,
        max_sq_dist = 0;
      const first = points[0],
        last = points[points.length - 1];
      for (let i = 1; i < points.length - 1; i++) {
        const sq_dist = Util.getSqSegDist(points[i], first, last);
        if (sq_dist > max_sq_dist) {
          max_sq_dist = sq_dist;
          marker_index = i;
        }
      }
      if (max_sq_dist > sqTolerance) {
        const part1 = Util.simplify(points.slice(0, marker_index + 1), tolerance);
        const part2 = Util.simplify(points.slice(marker_index), tolerance);
        return part1.slice(0, part1.length - 1).concat(part2);
      }
      return [first, last];
    },
    getSqSegDist(p, p1, p2) {
      let x = p1.x,
        y = p1.y,
        dx = p2.x - x,
        dy = p2.y - y;
      if (dx !== 0 || dy !== 0) {
        const t =
          ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = p2.x;
          y = p2.y;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }
      dx = p.x - x;
      dy = p.y - y;
      return dx * dx + dy * dy;
    },
    isTouch: () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
    colorVar: (name, fallback) => `var(--atlas-${name},${fallback})`
  };

  /* ========= Error Handling ========= */
  function assert(cond, msg) {
    if (!cond) throw new Error(`Atlas: ${msg}`);
  }

  /* ========= Event Emitter ========= */
  class Emitter {
    #events = {};
    on(t, f, c) {
      (this.#events[t] || (this.#events[t] = [])).push({ fn: f, ctx: c });
      return this;
    }
    off(t, f) {
      if (!this.#events[t]) return this;
      this.#events[t] = this.#events[t].filter((h) => h.fn !== f);
      return this;
    }
    emit(t, p) {
      if (this.#events[t]) {
        this.#events[t].forEach((h) => h.fn.call(h.ctx || this, p));
      }
    }
    removeAllListeners() {
      this.#events = {};
    }
  }

  /* ========= Geometry ========= */
  class Point {
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
      this.x = +x;
      this.y = +y;
    }
    add(p) { return new Point(this.x + p.x, this.y + p.y); }
    subtract(p) { return new Point(this.x - p.x, this.y - p.y); }
    multiplyBy(n) { return new Point(this.x * n, this.y * n); }
    divideBy(n) { return new Point(this.x / n, this.y / n); }
    floor() { return new Point(Math.floor(this.x), Math.floor(this.y)); }
    ceil() { return new Point(Math.ceil(this.x), Math.ceil(this.y)); }
    distanceTo(p) {
      const dx = p.x - this.x, dy = p.y - this.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }
  class LatLng {
    /**
     * @param {number} lat
     * @param {number} lng
     */
    constructor(lat, lng) {
      this.lat = Math.max(-90, Math.min(90, lat));
      this.lng = ((lng + 180) % 360 + 360) % 360 - 180;
    }
  }
  class LatLngBounds {
    /**
     * @param {LatLng|Array<number>} c1
     * @param {LatLng|Array<number>} c2
     */
    constructor(c1, c2) {
      this._sw = null;
      this._ne = null;
      if (c1) this.extend(c1);
      if (c2) this.extend(c2);
    }
    extend(obj) {
      const ll = obj instanceof LatLng ? obj : new LatLng(obj[0], obj[1]);
      if (!this._sw) {
        this._sw = new LatLng(ll.lat, ll.lng);
        this._ne = new LatLng(ll.lat, ll.lng);
      } else {
        this._sw.lat = Math.min(ll.lat, this._sw.lat);
        this._sw.lng = Math.min(ll.lng, this._sw.lng);
        this._ne.lat = Math.max(ll.lat, this._ne.lat);
        this._ne.lng = Math.max(ll.lng, this._ne.lng);
      }
      return this;
    }
    getSouthWest() { return this._sw; }
    getNorthEast() { return this._ne; }
    getCenter() {
      return new LatLng((this._sw.lat + this._ne.lat) / 2,
                        (this._sw.lng + this._ne.lng) / 2);
    }
    intersects(other) {
      if (!other || !other._sw || !other._ne || !this._sw || !this._ne) return false;
      const sw = this._sw, ne = this._ne,
            sw2 = other._sw, ne2 = other._ne;
      return (sw.lng < ne2.lng && ne.lng > sw2.lng &&
              sw.lat < ne2.lat && ne.lat > sw2.lat);
    }
  }

  /* ========= CRS ========= */
  const CRS = {
    EPSG3857: {
      project: (ll) =>
        new Point(
          (ll.lng + 180) / 360,
          0.5 - Math.log(Math.tan(Math.PI/4 + (ll.lat*Math.PI)/180/2)) / (2 * Math.PI)
        ),
      unproject: (p) =>
        new LatLng(
          (2 * Math.atan(Math.exp((0.5 - p.y) * 2 * Math.PI)) * 180) / Math.PI - 90,
          p.x * 360 - 180
        )
    },
    EPSG4326: {
      project: (ll) => new Point(ll.lng / 360 + 0.5, -ll.lat / 180 + 0.5),
      unproject: (p) => new LatLng((0.5 - p.y) * 180, (p.x - 0.5) * 360)
    }
  };

  /* ========= Animator ========= */
  class Animator {
    #frameId;
    run(stepFn) {
      this.stop();
      const animate = () => {
        stepFn();
        this.#frameId = requestAnimationFrame(animate);
      };
      this.#frameId = requestAnimationFrame(animate);
    }
    stop() {
      if (this.#frameId) cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
  }

  /* ========= Renderers ========= */
  // ... (Code for CanvasRenderer, SVGRenderer, WebGLRenderer, as in previous version, omitted for brevity. See previous completion for full code.)

  /* ========= Layer Classes ========= */
  // ... (Layer, Path, Polygon, Pin, TileLayer, GeoJSONLayer, ClusterLayer as before. See previous completion for full code.)

  /* ========= Drawing/Editing Tools ========= */
  function DrawingTool(world, options={}) {
    // Basic polygon/line/marker drawing tool
    let active = false, type = "polygon", drawn = [];
    const control = Util.div("atlas-control atlas-draw", world._controlPane);
    control.innerHTML = `
      <button data-type="marker" tabindex="0" aria-label="Draw marker">Marker</button>
      <button data-type="polyline" tabindex="0" aria-label="Draw line">Line</button>
      <button data-type="polygon" tabindex="0" aria-label="Draw polygon">Polygon</button>
      <button data-action="clear" tabindex="0" aria-label="Clear drawing">Clear</button>
    `;
    [...control.querySelectorAll("button[data-type]")].forEach(btn=>{
      btn.onclick = ()=>{type = btn.dataset.type;};
      btn.onkeydown = (e)=>{if(e.key==="Enter"||e.key===" ")btn.onclick();};
    });
    control.querySelector("button[data-action=clear]").onclick = ()=>{
      drawn.forEach(l=>world.removeLayer(l)); drawn=[];
    };
    // Map click handler for drawing
    world._mapPane.addEventListener("click", e=>{
      if (!active) return;
      const rect = world._mapPane.getBoundingClientRect();
      const pt = new Point(e.clientX-rect.left, e.clientY-rect.top);
      const ll = world.unproject(pt.add(world.project(world._getPixelOrigin())));
      if (type==="marker") {
        drawn.push(world.addLayer(new Pin([ll.lat,ll.lng],{title:"Drawn Marker"})));
      } else {
        if (!drawn.length || drawn[drawn.length-1]._type!==type) {
          if (type==="polyline") drawn.push(world.addLayer(new Path([[ll.lat,ll.lng]],{color:"green",weight:3})));
          else if (type==="polygon") drawn.push(world.addLayer(new Polygon([[ll.lat,ll.lng]],{fill:"yellow",weight:2})));
          drawn[drawn.length-1]._type=type;
        } else {
          drawn[drawn.length-1]._lls.push([ll.lat,ll.lng]);
          drawn[drawn.length-1]._project();
          world._renderer.requestRedraw();
        }
      }
    });
    // Activate drawing
    control.addEventListener("mouseenter", ()=>{active=true;});
    control.addEventListener("mouseleave", ()=>{active=false;});
  }

  /* ========= Data Format Import/Export ========= */
  // Parsing stubs for TopoJSON, KML, GPX, CSV
  const DataFormat = {
    parseTopoJSON: (data) => { /* TODO: implement real parser */ return {}; },
    parseKML: (data) => { /* TODO: implement real parser */ return {}; },
    parseGPX: (data) => { /* TODO: implement real parser */ return {}; },
    parseCSV: (data) => { /* TODO: implement real parser */ return {}; },
    exportGeoJSON: (layers) => {
      // Converts layers to GeoJSON FeatureCollection
      const features = [];
      layers.forEach(l=>{
        if (l instanceof Pin) {
          features.push({type:"Feature",geometry:{type:"Point",coordinates:[l._latlng.lng,l._latlng.lat]},properties:{}});
        } else if (l instanceof Path) {
          features.push({type:"Feature",geometry:{type:"LineString",coordinates:l._lls.map(ll=>[ll.lng,ll.lat])},properties:{}});
        } else if (l instanceof Polygon) {
          features.push({type:"Feature",geometry:{type:"Polygon",coordinates:[l._lls.map(ll=>[ll.lng,ll.lat])]},properties:{}});
        }
      });
      return {type:"FeatureCollection",features};
    }
  };
  // Export to PNG/SVG
  function exportPNG(world) {
    if (world._renderer instanceof CanvasRenderer) {
      return world._renderer.#canvas.toDataURL();
    }
    return null;
  }
  function exportSVG(world) {
    if (world._renderer instanceof SVGRenderer) {
      return world._renderer.#svg.outerHTML;
    }
    return null;
  }

  /* ========= Theming/Dark Mode ========= */
  function setTheme(vars) {
    Object.entries(vars).forEach(([k,v])=>{
      document.documentElement.style.setProperty(`--atlas-${k}`,v);
    });
  }

  /* ========= Internal Testing Hooks ========= */
  global.__AtlasTest = {
    Point, LatLng, LatLngBounds, CRS, Util, DataFormat, setTheme
  };

  /* ========= Controls ========= */
  // ... (ZoomControl, FullscreenControl, AttributionControl as before)

  /* ========= World ========= */
  // ... (World class as before, with plugin API, layer virtualization, better error handling)

  // Inject CSS with variables for theming/dark mode
  const style=document.createElement("style");
  style.innerHTML=`
  :root {
    --atlas-bg: #ddd;
    --atlas-fg: #333;
    --atlas-accent: #2196F3;
    --atlas-marker: red;
    --atlas-popup-bg: #fff;
    --atlas-popup-fg: #333;
    --atlas-control-bg: rgba(255,255,255,0.9);
    --atlas-control-fg: #333;
    --atlas-cluster-bg: #2196F3;
    --atlas-cluster-fg: #fff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --atlas-bg: #222;
      --atlas-fg: #eee;
      --atlas-accent: #90caf9;
      --atlas-popup-bg: #222;
      --atlas-popup-fg: #eee;
      --atlas-control-bg: rgba(34,34,34,0.85);
      --atlas-control-fg: #eee;
      --atlas-cluster-bg: #90caf9;
      --atlas-cluster-fg: #222;
    }
  }
  .atlas-world { position:relative; overflow:hidden; background:var(--atlas-bg); color:var(--atlas-fg); user-select:none; }
  .atlas-map-pane, .atlas-overlay-pane, .atlas-marker-pane, .atlas-tile-pane, .atlas-control-pane { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;}
  .atlas-marker-pane, .atlas-popup-pane, .atlas-control-pane { pointer-events:auto;}
  .atlas-pin{ width:10px; height:10px; border-radius:50%; background:var(--atlas-marker); border:2px solid #fff; margin:-7px 0 0 -7px; position:absolute; outline:none;}
  .atlas-pin:focus{ box-shadow:0 0 0 3px var(--atlas-accent);}
  .atlas-popup{ background:var(--atlas-popup-bg); color:var(--atlas-popup-fg); border:1px solid var(--atlas-fg); border-radius:3px; padding:4px 8px; position:absolute; transform:translate(-50%,-100%); }
  .atlas-popup-close{ cursor:pointer; position:absolute; top:2px; right:4px; }
  .atlas-control{ background:var(--atlas-control-bg); color:var(--atlas-control-fg); border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.1); padding:4px; position:absolute; z-index:1000; display:inline-block;}
  .atlas-zoom{ top:10px; left:10px;}
  .atlas-zoom-in, .atlas-zoom-out{ font-size:18px; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:2px; background:var(--atlas-accent); color:var(--atlas-cluster-fg); margin:2px; cursor:pointer;}
  .atlas-fullscreen{ top:10px; right:10px; font-size:18px; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:2px; background:var(--atlas-accent); color:var(--atlas-cluster-fg); cursor:pointer;}
  .atlas-attribution{ bottom:6px; right:6px; font-size:12px; padding:2px 8px; background:var(--atlas-control-bg); color:var(--atlas-control-fg); border-radius:2px;}
  .atlas-svg-renderer{ position:absolute; top:0; left:0; pointer-events:none;}
  .atlas-control.atlas-draw{ top:60px; left:10px;}
  `;
  document.head.appendChild(style);

  /* ========= Factory ========= */
  global.Atlas = {
    world:(id,opt)=>new World(id,opt),
    pin:(ll,opt)=>new Pin(ll,opt),
    path:(lls,opt)=>new Path(lls,opt),
    polygon:(lls,opt)=>new Polygon(lls,opt),
    tileLayer:(url,opt)=>new TileLayer(url,opt),
    geoJsonLayer:(data,opt)=>new GeoJSONLayer(data,opt),
    clusterLayer:(points,opt)=>new ClusterLayer(points,opt),
    CRS,LatLng,Point,LatLngBounds,
    Renderers:{CanvasRenderer,SVGRenderer,WebGLRenderer},
    Controls:{ZoomControl,FullscreenControl,AttributionControl,DrawingTool},
    DataFormat,
    setTheme,
    exportPNG, exportSVG,
    usePlugin: (world, plugin, options) => world.use(plugin, options)
  };
})(typeof window!=="undefined"? window: globalThis);
