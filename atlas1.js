/*!
 * Atlas.js — MIT License
 * A JavaScript Mapping Library
 *
 * Author: Atlasian! from Tarfaya.
 * License: MIT
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
    isTouch() {
      return "ontouchstart" in window || navigator.maxTouchPoints > 0;
    }
  };

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
    constructor(lat, lng) {
      this.lat = Math.max(-90, Math.min(90, lat));
      this.lng = ((lng + 180) % 360 + 360) % 360 - 180;
    }
  }
  class LatLngBounds {
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
  class Renderer {
    constructor(world) { this._world = world; }
    onAdd() {}
    onRemove() {}
    requestRedraw() { if (this._world) this._world.emit("redraw"); }
  }
  // Canvas Renderer (default)
  class CanvasRenderer extends Renderer {
    #canvas; #ctx; #isDirty = true; #pixelRatio = window.devicePixelRatio || 1;
    onAdd() {
      this.#canvas = Util.div("atlas-canvas-renderer");
      this.#ctx = this.#canvas.getContext("2d");
      this._world._overlayPane.appendChild(this.#canvas);
      this._world.on("viewreset", () => { this.#isDirty = true; this._redraw(); });
      this._world.on("move", this._redraw, this);
      this._world.on("resize", this.#resize, this);
      this.#resize();
    }
    onRemove() {
      if (this.#canvas && this.#canvas.parentNode) this.#canvas.parentNode.removeChild(this.#canvas);
      this.#canvas = null;
      this.#ctx = null;
    }
    #resize() {
      const size = this._world._getMapSize();
      this.#canvas.width = size.x * this.#pixelRatio;
      this.#canvas.height = size.y * this.#pixelRatio;
      this.#canvas.style.width = `${size.x}px`;
      this.#canvas.style.height = `${size.y}px`;
      this.#ctx.setTransform(1,0,0,1,0,0);
      this.#ctx.scale(this.#pixelRatio, this.#pixelRatio);
      this.#isDirty = true;
      this._redraw();
    }
    _redraw() {
      if (this.#isDirty) {
        this.#isDirty = false;
        const size = this._world._getMapSize();
        this.#ctx.clearRect(0,0,size.x,size.y);
        this._world._layers.forEach((layer)=> {
          if (layer.draw && layer.getBounds()?.intersects(this._world.getBounds()))
            layer.draw(this.#ctx);
        });
      }
    }
    detect(point) {
      for (let i = this._world._layers.length-1; i>=0; i--) {
        const layer = this._world._layers[i];
        if (layer.contains && layer.contains(point)) return layer;
      }
      return null;
    }
  }
  // SVG Renderer
  class SVGRenderer extends Renderer {
    #svg; #isDirty = true;
    onAdd() {
      this.#svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.#svg.classList.add("atlas-svg-renderer");
      this._world._overlayPane.appendChild(this.#svg);
      this._world.on("viewreset", () => { this.#isDirty = true; this._redraw(); });
      this._world.on("move", this._redraw, this);
      this._world.on("resize", this.#resize, this);
      this.#resize();
    }
    onRemove() {
      if (this.#svg && this.#svg.parentNode) this.#svg.parentNode.removeChild(this.#svg);
      this.#svg = null;
    }
    #resize() {
      const size = this._world._getMapSize();
      this.#svg.setAttribute("width", size.x);
      this.#svg.setAttribute("height", size.y);
      this.#isDirty = true;
      this._redraw();
    }
    _redraw() {
      if (!this.#isDirty) return;
      this.#isDirty = false;
      while (this.#svg.firstChild) this.#svg.removeChild(this.#svg.firstChild);
      this._world._layers.forEach((layer)=> {
        if (layer.svgDraw && layer.getBounds()?.intersects(this._world.getBounds()))
          layer.svgDraw(this.#svg);
      });
    }
  }
  // WebGL Renderer (experimental, only for points)
  class WebGLRenderer extends Renderer {
    #canvas; #gl; #isDirty = true;
    onAdd() {
      this.#canvas = Util.div("atlas-webgl-renderer");
      this.#gl = this.#canvas.getContext("webgl");
      this._world._overlayPane.appendChild(this.#canvas);
      this._world.on("viewreset", () => { this.#isDirty = true; this._redraw(); });
      this._world.on("move", this._redraw, this);
      this._world.on("resize", this.#resize, this);
      this.#resize();
    }
    onRemove() {
      if (this.#canvas && this.#canvas.parentNode) this.#canvas.parentNode.removeChild(this.#canvas);
      this.#canvas = null;
      this.#gl = null;
    }
    #resize() {
      const size = this._world._getMapSize();
      this.#canvas.width = size.x;
      this.#canvas.height = size.y;
      this.#canvas.style.width = `${size.x}px`;
      this.#canvas.style.height = `${size.y}px`;
      this.#isDirty = true;
      this._redraw();
    }
    _redraw() {
      // For demo: just clear and draw points if available
      if (!this.#isDirty || !this.#gl) return;
      this.#isDirty = false;
      this.#gl.viewport(0,0,this.#canvas.width,this.#canvas.height);
      this.#gl.clearColor(0.95,0.95,0.95,1);
      this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
      // TODO: Implement actual WebGL drawing for layers
    }
  }

  /* ========= Plugin System ========= */
  class PluginManager {
    constructor(world) {
      this._world = world;
      this._plugins = [];
    }
    use(plugin, options) {
      plugin(this._world, options);
      this._plugins.push({plugin, options});
      return this;
    }
  }

  /* ========= Layers ========= */
  class Layer extends Emitter {
    constructor(opt={}) { super(); this._opt = opt; this._world = null;}
    addTo(w) {
      if (!w || typeof w.addLayer !== "function") throw new Error("Invalid World instance");
      w.addLayer(this);
      this._world = w;
      return this;
    }
    remove() {
      if (this._world) this._world.removeLayer(this);
      this._world = null;
      return this;
    }
    onAdd() {}
    onRemove() {}
    getBounds() { return null; }
    svgDraw(svgNode) {}  // For SVGRenderer
  }
  class Path extends Layer {
    constructor(lls,opt){
      super(opt);
      this._lls = lls.map((p)=>new LatLng(p[0],p[1]));
      this._points = null;
      this._bounds = null;
    }
    getBounds() {
      if (!this._bounds)
        this._bounds = new LatLngBounds(this._lls[0], this._lls[0]);
      this._lls.forEach((ll)=> this._bounds.extend(ll));
      return this._bounds;
    }
    _project() {
      if (!this._world) return;
      const tolerance = 4 / 2**this._world.getZoom();
      this._points = Util.simplify(this._lls, tolerance).map(
        (ll)=> this._world.latLngToContainer(ll)
      );
    }
    draw(ctx) {
      if (!this._points) this._project();
      if (this._points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = this._opt.color || "blue";
      ctx.lineWidth = this._opt.weight || 3;
      ctx.globalAlpha = this._opt.opacity ?? 1;
      if (this._opt.dashArray) ctx.setLineDash(this._opt.dashArray);
      this._points.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    svgDraw(svg) {
      if (!this._points) this._project();
      if (this._points.length < 2) return;
      const points = this._points.map(p=>`${p.x},${p.y}`).join(" ");
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.setAttribute("points", points);
      polyline.setAttribute("stroke", this._opt.color || "blue");
      polyline.setAttribute("stroke-width", this._opt.weight || 3);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("opacity", this._opt.opacity ?? 1);
      svg.appendChild(polyline);
    }
    contains(point) {
      if (!this._points) this._project();
      for (let i=0;i<this._points.length-1;i++)
        if (Util.getSqSegDist(point, this._points[i],this._points[i+1])<25)
          return true;
      return false;
    }
    onAdd(world){
      world.on("viewreset", this._project, this);
      this._project();
      if (world._renderer && typeof world._renderer.requestRedraw === "function")
        world._renderer.requestRedraw();
    }
    onRemove(world){ world.off("viewreset", this._project, this); }
  }
  class Polygon extends Path {
    draw(ctx) {
      if (!this._points) this._project();
      if (this._points.length < 3) return;
      ctx.beginPath();
      this._points.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.closePath();
      ctx.fillStyle = this._opt.fillColor || this._opt.fill || "rgba(33,150,243,0.2)";
      ctx.globalAlpha = this._opt.fillOpacity ?? 0.6;
      ctx.fill();
      const weight = this._opt.weight ?? 2;
      if (weight > 0) {
        ctx.strokeStyle = this._opt.color || "#2196F3";
        ctx.lineWidth = weight;
        ctx.globalAlpha = this._opt.opacity ?? 1;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    svgDraw(svg) {
      if (!this._points) this._project();
      if (this._points.length < 3) return;
      const points = this._points.map(p=>`${p.x},${p.y}`).join(" ");
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", points);
      polygon.setAttribute("fill", this._opt.fillColor || this._opt.fill || "rgba(33,150,243,0.2)");
      polygon.setAttribute("stroke", this._opt.color || "#2196F3");
      polygon.setAttribute("stroke-width", this._opt.weight ?? 2);
      polygon.setAttribute("opacity", this._opt.fillOpacity ?? 0.6);
      svg.appendChild(polygon);
    }
    contains(point) {
      if (!this._points) this._project();
      let inside = false;
      for (let i=0,j=this._points.length-1;i<this._points.length;j=i++) {
        const xi=this._points[i].x, yi=this._points[i].y;
        const xj=this._points[j].x, yj=this._points[j].y;
        if ((yi>point.y)!==(yj>point.y) &&
            point.x < ((xj-xi)*(point.y-yi))/(yj-yi)+xi)
          inside=!inside;
      }
      return inside;
    }
  }
  class Pin extends Layer {
    constructor(ll,opt){ super(opt); this._latlng=new LatLng(ll[0],ll[1]); }
    onAdd(world){
      this._el=Util.div("atlas-pin", world._markerPane);
      this._el.tabIndex = 0;
      this._el.setAttribute("role", "button");
      this._el.setAttribute("aria-label", this._opt.title || "Map pin");
      this._el.onclick=(e)=>{
        e.stopPropagation();
        if(this._opt.popup) world.openPopup(this._opt.popup,this._latlng);
        this.emit("click",{originalEvent:e});
      };
      this._el.onkeydown=(e)=>{
        if(e.key==="Enter"||e.key===" "){
          e.preventDefault();
          if(this._opt.popup) world.openPopup(this._opt.popup,this._latlng);
          this.emit("click",{originalEvent:e});
        }
      };
      world.on("move", this._update,this);
      this._update();
    }
    onRemove(world){
      if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
      this._el = null;
      world.off("move",this._update,this);
    }
    _update(){
      if (!this._world || !this._el) return;
      const pos=this._world.latLngToContainer(this._latlng);
      this._el.style.transform=`translate(${pos.x}px,${pos.y}px)`;
    }
    svgDraw(svg) {
      if (!this._world) return;
      const pos = this._world.latLngToContainer(this._latlng);
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pos.x);
      circle.setAttribute("cy", pos.y);
      circle.setAttribute("r", 7);
      circle.setAttribute("fill", "red");
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", 2);
      circle.setAttribute("opacity", 1);
      svg.appendChild(circle);
    }
  }
  class TileLayer extends Layer {
    constructor(url,opt){ super(opt); this.urlTemplate=url; this._tiles={}; }
    onAdd(world){
      this._tilePane=Util.div("atlas-tile-layer", world._mapPane);
      world.on("viewreset moveend",this._update,this);
      this._update();
    }
    onRemove(world){
      if (this._tilePane && this._tilePane.parentNode) this._tilePane.parentNode.removeChild(this._tilePane);
      this._tilePane = null;
      world.off("viewreset moveend",this._update,this);
      this._tiles={};
    }
    _key(x,y,z){return `${z}:${x}:${y}`;}
    _update(){
      if (!this._world || !this._tilePane) return;
      const zoom=Math.round(this._world.getZoom());
      const tileSize=this._world._opts.tileSize;
      const size=this._world._getMapSize();
      const pixelBounds={
        min:this._world.project(this._world._center,zoom).subtract(size.divideBy(2)),
        max:this._world.project(this._world._center,zoom).add(size.divideBy(2)),
      };
      const min=pixelBounds.min.divideBy(tileSize).floor();
      const max=pixelBounds.max.divideBy(tileSize).ceil();
      const keysInView=new Set();
      for(let x=min.x;x<=max.x;x++){
        for(let y=min.y;y<=max.y;y++){
          const key=this._key(x,y,zoom); keysInView.add(key);
          if(!this._tiles[key]){
            const img=new Image();
            img.src=this.urlTemplate.replace("{z}",zoom).replace("{x}",x).replace("{y}",y);
            img.style.position="absolute";
            img.style.left=x*tileSize+"px";
            img.style.top=y*tileSize+"px";
            this._tilePane.appendChild(img);
            this._tiles[key]=img;
          }
        }
      }
      for(const key in this._tiles){
        if(!keysInView.has(key)){
          if (this._tiles[key].parentNode) this._tiles[key].parentNode.removeChild(this._tiles[key]);
          delete this._tiles[key];
        }
      }
    }
  }
  class GeoJSONLayer extends Layer {
    constructor(data,opt={}){ super(opt); this._data=data; this._childLayers=[]; }
    onAdd(world){
      const addFeature=(f)=>{
        if (!f.geometry) return;
        const {type,coordinates}=f.geometry; let layer;
        if(type==="Point" && Array.isArray(coordinates)){
          layer=new Pin([coordinates[1],coordinates[0]],this._opt);
        }else if(type==="LineString" && Array.isArray(coordinates)){
          layer=new Path(coordinates.map((c)=>[c[1],c[0]]),this._opt);
        }else if(type==="Polygon" && Array.isArray(coordinates)){
          layer=new Polygon(coordinates[0].map((c)=>[c[1],c[0]]),this._opt);
        }
        if(layer){ layer.addTo(world); this._childLayers.push(layer); }
      };
      if (this._data && Array.isArray(this._data.features)) {
        this._data.features.forEach(addFeature);
      }
    }
    onRemove(world){ this._childLayers.forEach((l)=>world.removeLayer(l)); this._childLayers=[]; }
  }
  // Clustered Layer (for points)
  class ClusterLayer extends Layer {
    constructor(points, opt={radius:40}) {
      super(opt);
      this._rawPoints = points.map((p)=>new LatLng(p[0],p[1]));
      this._clusters = [];
      this._radius = opt.radius || 40;
    }
    _cluster() {
      if (!this._world) return;
      const points = this._rawPoints.map(ll=>this._world.latLngToContainer(ll));
      const clusters = [];
      for (let i=0; i<points.length; i++) {
        let added = false;
        for (let c of clusters) {
          if (c.center.distanceTo(points[i]) < this._radius) {
            c.members.push(points[i]);
            added = true;
            break;
          }
        }
        if (!added) clusters.push({center: points[i], members: [points[i]]});
      }
      this._clusters = clusters;
    }
    draw(ctx) {
      this._cluster();
      ctx.globalAlpha = 1;
      this._clusters.forEach(c=>{
        ctx.beginPath();
        ctx.arc(c.center.x, c.center.y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = "#2196F3";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.members.length.toString(), c.center.x, c.center.y);
      });
    }
    svgDraw(svg) {
      this._cluster();
      this._clusters.forEach(c => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", c.center.x);
        circle.setAttribute("cy", c.center.y);
        circle.setAttribute("r", 12);
        circle.setAttribute("fill", "#2196F3");
        circle.setAttribute("stroke", "#fff");
        circle.setAttribute("stroke-width", 2);
        svg.appendChild(circle);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", c.center.x);
        text.setAttribute("y", c.center.y+2);
        text.setAttribute("fill", "#fff");
        text.setAttribute("font-size", "12px");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-weight", "bold");
        text.textContent = c.members.length.toString();
        svg.appendChild(text);
      });
    }
  }

  /* ========= Controls ========= */
  function ZoomControl(world, options={}) {
    const btns = Util.div("atlas-control atlas-zoom", world._controlPane);
    const zoomIn = Util.div("atlas-zoom-in", btns); zoomIn.textContent = "+";
    const zoomOut = Util.div("atlas-zoom-out", btns); zoomOut.textContent = "−";
    zoomIn.setAttribute("tabindex", 0); zoomOut.setAttribute("tabindex", 0);
    zoomIn.setAttribute("role", "button"); zoomOut.setAttribute("role", "button");
    zoomIn.onclick = () => world.setZoom(world.getZoom()+1);
    zoomOut.onclick = () => world.setZoom(world.getZoom()-1);
    zoomIn.onkeydown = (e)=>{if(e.key==="Enter"||e.key===" ")zoomIn.onclick();};
    zoomOut.onkeydown = (e)=>{if(e.key==="Enter"||e.key===" ")zoomOut.onclick();};
  }
  function FullscreenControl(world, options={}) {
    const btn = Util.div("atlas-control atlas-fullscreen", world._controlPane);
    btn.textContent = "⤢";
    btn.setAttribute("tabindex", 0);
    btn.setAttribute("role", "button");
    btn.onclick = () => {
      if (!document.fullscreenElement) world._root.requestFullscreen();
      else document.exitFullscreen();
    };
    btn.onkeydown = (e)=>{if(e.key==="Enter"||e.key===" ")btn.onclick();};
  }
  function AttributionControl(world, options={text:"© Atlas.js"}) {
    const attr = Util.div("atlas-control atlas-attribution", world._controlPane);
    attr.textContent = options.text;
  }

  /* ========= World ========= */
  class World extends Emitter {
    #root; #opts; #zoom; #center; #layers=[]; #animator; #isRTL; #lastPan; #velocity=new Point(0,0); #resizeObserver;
    constructor(id,opt={}){
      super();
      this.#root=typeof id==="string"? document.getElementById(id):id;
      if(!this.#root) throw new Error("Map container not found");
      this.#root.classList.add("atlas-world");
      this.#opts={ crs:CRS.EPSG3857, zoom:2, minZoom:0, maxZoom:19,
                   focus:[0,0], tileSize:256, renderer:CanvasRenderer,
                   inertia:true, ...opt };
      this.#animator=new Animator();
      this.#isRTL=getComputedStyle(this.#root).direction==="rtl";
      if(this.#isRTL) this.#root.classList.add("atlas-rtl");

      this._mapPane=Util.div("atlas-map-pane", this.#root);
      this._tilePane=Util.div("atlas-tile-pane", this._mapPane);
      this._overlayPane=Util.div("atlas-overlay-pane", this._mapPane);
      this._markerPane=Util.div("atlas-marker-pane", this._mapPane);
      this._popupPane=Util.div("atlas-popup-pane", this.#root);
      this._controlPane=Util.div("atlas-control-pane", this.#root);

      this._renderer=new this.#opts.renderer(this);
      this._renderer.onAdd();

      this._pluginManager = new PluginManager(this);

      this.setView(this.#opts.focus,this.#opts.zoom);
      this.#setupEvents();
      this.#resizeObserver=new ResizeObserver(()=>this.emit("resize"));
      this.#resizeObserver.observe(this.#root);
    }

    // Public API
    setView(center,zoom){
      this.#zoom=zoom;
      this.#center=new LatLng(center[0],center[1]);
      this._update();
      this.emit("viewreset");
      return this;
    }
    setZoom(z){ return this.setView([this.#center.lat,this.#center.lng],z); }
    getZoom(){ return this.#zoom; }
    panBy(offset){
      const centerPoint=this.project(this.#center).add(offset);
      this.#center=this.unproject(centerPoint);
      this._update();
      this.emit("move");
      clearTimeout(this.#moveendTimeout);
      this.#moveendTimeout=setTimeout(()=>this.emit("moveend"),100);
      return this;
    }
    addLayer(l){
      l._world=this;
      this.#layers.push(l);
      l.onAdd(this);
      this._renderer.requestRedraw();
      return this;
    }
    removeLayer(l){
      this.#layers=this.#layers.filter((x)=>x!==l);
      l.onRemove(this);
      this._renderer.requestRedraw();
      return this;
    }
    openPopup(content,latlng){
      if(this._popupEl) this._popupEl.remove();
      this._popupEl=Util.div("atlas-popup", this._popupPane);
      if(typeof content==="string"){
        this._popupEl.innerHTML=`<div class="atlas-popup-content">${content}</div><span class="atlas-popup-close">×</span>`;
      }else if(content instanceof HTMLElement){
        this._popupEl.appendChild(content);
        const closeBtn=Util.div("atlas-popup-close", this._popupEl);
        closeBtn.textContent="×";
        closeBtn.onclick=()=>this._popupEl.remove();
      }
      const pos=this.latLngToContainer(latlng);
      this._popupEl.style.left=`${pos.x}px`;
      this._popupEl.style.top=`${pos.y}px`;
      const close=this._popupEl.querySelector(".atlas-popup-close");
      if(close) close.onclick=()=>this._popupEl.remove();
    }

    getBounds() {
      if (this.#layers.length === 0) return null;
      let bounds = null;
      this.#layers.forEach(layer => {
        const b = layer.getBounds && layer.getBounds();
        if (b) {
          if (!bounds) bounds = new LatLngBounds(b.getSouthWest(), b.getNorthEast());
          else bounds.extend(b.getSouthWest()).extend(b.getNorthEast());
        }
      });
      return bounds;
    }

    use(plugin, options) {
      this._pluginManager.use(plugin, options);
      return this;
    }

    // Internal
    _getMapSize(){ return new Point(this.#root.clientWidth,this.#root.clientHeight); }
    project(ll,z=this.#zoom){ return this.#opts.crs.project(ll).multiplyBy(this.#opts.tileSize*(2**z)); }
    unproject(p,z=this.#zoom){ return this.#opts.crs.unproject(p.divideBy(this.#opts.tileSize*(2**z))); }
    latLngToContainer(ll){ return this.project(ll).subtract(this.project(this._getPixelOrigin())); }
    _getPixelOrigin(){ const center=this.project(this.#center); const size=this._getMapSize(); return center.subtract(size.divideBy(2)); }
    _update(){ const pixelOrigin=this._getPixelOrigin(); this._mapPane.style.transform=`translate(${-pixelOrigin.x}px, ${-pixelOrigin.y}px)`;}

    #setupEvents(){
      // Touch support
      if (Util.isTouch()) {
        let lastTouch = null;
        this.#root.addEventListener("touchstart", e=>{
          if (e.touches.length===1) lastTouch=new Point(e.touches[0].clientX, e.touches[0].clientY);
        });
        this.#root.addEventListener("touchmove", e=>{
          if (lastTouch && e.touches.length===1) {
            const newTouch=new Point(e.touches[0].clientX, e.touches[0].clientY);
            this.panBy(lastTouch.subtract(newTouch));
            lastTouch=newTouch;
            e.preventDefault();
          }
        },{passive:false});
        this.#root.addEventListener("touchend", ()=>{lastTouch=null;});
        // Pinch zoom
        let lastDist = null;
        this.#root.addEventListener("touchmove", e=>{
          if (e.touches.length===2) {
            const p1=new Point(e.touches[0].clientX,e.touches[0].clientY);
            const p2=new Point(e.touches[1].clientX,e.touches[1].clientY);
            const dist=p1.distanceTo(p2);
            if (lastDist) {
              if (dist>lastDist+10) this.setZoom(this.getZoom()+1);
              else if (dist<lastDist-10) this.setZoom(this.getZoom()-1);
            }
            lastDist=dist;
            e.preventDefault();
          }
        },{passive:false});
        this.#root.addEventListener("touchend", ()=>{lastDist=null;});
      }

      // Mouse pan + inertia
      const onPanStart=(p)=>{ this.#animator.stop(); this.#lastPan=p;this.#velocity=new Point(0,0);};
      const onPanMove=(p)=>{ if(!this.#lastPan) return;
        this.panBy(this.#lastPan.subtract(p));
        this.#velocity=this.#lastPan.subtract(p); this.#lastPan=p;};
      const onPanEnd=()=>{ if(!this.#lastPan||!this.#opts.inertia) return; this.#lastPan=null;
        this.#animator.run(()=>{ this.panBy(this.#velocity.multiplyBy(-0.5));
          this.#velocity=this.#velocity.multiplyBy(0.92);
          if(this.#velocity.distanceTo(new Point(0,0))<0.1) this.#animator.stop();});
      };

      this.#root.addEventListener("mousedown", e=>onPanStart(new Point(e.clientX,e.clientY)));
      window.addEventListener("mousemove", e=>onPanMove(new Point(e.clientX,e.clientY)));
      window.addEventListener("mouseup", onPanEnd);

      // Wheel zoom
      this.#root.addEventListener("wheel", e=>{
        e.preventDefault();
        const delta=e.deltaY>0?-1:1;
        const newZoom=Math.min(this.#opts.maxZoom,Math.max(this.#opts.minZoom,this.#zoom+delta));
        this.setZoom(newZoom);
      });

      // Keyboard arrows
      this.#root.tabIndex=0;
      this.#root.addEventListener("keydown", e=>{
        const step=50;
        if(e.key==="ArrowUp") this.panBy(new Point(0,-step));
        if(e.key==="ArrowDown") this.panBy(new Point(0,step));
        if(e.key==="ArrowLeft") this.panBy(new Point(-step,0));
        if(e.key==="ArrowRight") this.panBy(new Point(step,0));
        if(e.key==="+"||e.key==="=") this.setZoom(this.#zoom+1);
        if(e.key==="-"||e.key==="_") this.setZoom(this.#zoom-1);
      });
    }
    destroy() {
      if (this.#resizeObserver) {
        this.#resizeObserver.disconnect();
        this.#resizeObserver = null;
      }
      if (this._renderer && typeof this._renderer.onRemove === "function") {
        this._renderer.onRemove();
      }
      this.removeAllListeners();
      this.#root = null;
    }
  }

  // Inject CSS
  const style=document.createElement("style");
  style.innerHTML=`
  .atlas-world { position:relative; overflow:hidden; background:#ddd; user-select:none; }
  .atlas-map-pane, .atlas-overlay-pane, .atlas-marker-pane, .atlas-tile-pane, .atlas-control-pane { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;}
  .atlas-marker-pane, .atlas-popup-pane, .atlas-control-pane { pointer-events:auto;}
  .atlas-pin{ width:10px; height:10px; border-radius:50%; background:red; border:2px solid #fff; margin:-7px 0 0 -7px; position:absolute; outline:none;}
  .atlas-pin:focus{ box-shadow:0 0 0 3px rgba(0,0,255,0.5);}
  .atlas-popup{ background:#fff; border:1px solid #333; border-radius:3px; padding:4px 8px; position:absolute; transform:translate(-50%,-100%); }
  .atlas-popup-close{ cursor:pointer; position:absolute; top:2px; right:4px; }
  .atlas-control{ background:rgba(255,255,255,0.9); border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.1); padding:4px; position:absolute; z-index:1000; display:inline-block;}
  .atlas-zoom{ top:10px; left:10px;}
  .atlas-zoom-in, .atlas-zoom-out{ font-size:18px; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:2px; background:#2196F3; color:#fff; margin:2px; cursor:pointer;}
  .atlas-fullscreen{ top:10px; right:10px; font-size:18px; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:2px; background:#2196F3; color:#fff; cursor:pointer;}
  .atlas-attribution{ bottom:6px; right:6px; font-size:12px; padding:2px 8px; background:rgba(255,255,255,0.7); color:#333; border-radius:2px;}
  .atlas-svg-renderer{ position:absolute; top:0; left:0; pointer-events:none;}
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
    Controls:{ZoomControl,FullscreenControl,AttributionControl},
    usePlugin: (world, plugin, options) => world.use(plugin, options)
  };
})(typeof window!=="undefined"? window: globalThis);
