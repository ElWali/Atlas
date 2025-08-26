/*!
 * Atlas.js — MIT License
 * Atlas.js is a JavaScript library for map display and interaction.
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
  };

  /* ========= Event Emitter ========= */
  class Emitter {
    #events = {};
    on(t, f, c) {
      (this.#events[t] || (this.#events[t] = [])).push({ fn: f, ctx: c });
      return this;
    }
    off(t, f) {
      this.#events[t] = this.#events[t]?.filter((h) => h.fn !== f);
      return this;
    }
    emit(t, p) {
      this.#events[t]?.forEach((h) => h.fn.call(h.ctx || this, p));
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
    constructor(c1, c2) { this.extend(c1); this.extend(c2); }
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

  /* ========= Renderer ========= */
  class Renderer {
    constructor(world) { this._world = world; }
    onAdd() {}
    onRemove() {}
    requestRedraw() { if (this._world) this._world.emit("redraw"); }
  }
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
    #resize() {
      const size = this._world._getMapSize();
      this.#canvas.width = size.x * this.#pixelRatio;
      this.#canvas.height = size.y * this.#pixelRatio;
      this.#canvas.style.width = `${size.x}px`;
      this.#canvas.style.height = `${size.y}px`;
      this.#ctx.setTransform(1,0,0,1,0,0);
      this.#ctx.scale(this.#pixelRatio, this.#pixelRatio);
      this.#isDirty = true;
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

  /* ========= Layers ========= */
  class Layer extends Emitter {
    constructor(opt={}) { super(); this._opt = opt; }
    addTo(w) { w.addLayer(this); return this; }
    remove() { if (this._world) this._world.removeLayer(this); return this; }
    onAdd() {}
    onRemove() {}
    getBounds() { return null; }
  }
  class Path extends Layer {
    constructor(lls,opt){ super(opt); this._lls = lls.map((p)=>new LatLng(p[0],p[1])); }
    getBounds() {
      if (!this._bounds)
        this._bounds = new LatLngBounds(this._lls[0], this._lls[0]);
      this._lls.forEach((ll)=> this._bounds.extend(ll));
      return this._bounds;
    }
    _project() {
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
    contains(point) {
      for (let i=0;i<this._points.length-1;i++)
        if (Util.getSqSegDist(point, this._points[i],this._points[i+1])<25)
          return true;
      return false;
    }
    onAdd(world){ world.on("viewreset", this._project, this); }
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
    }
    contains(point) {
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
    onRemove(world){ this._el.remove(); world.off("move",this._update,this); }
    _update(){
      const pos=this._world.latLngToContainer(this._latlng);
      this._el.style.transform=`translate(${pos.x}px,${pos.y}px)`;
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
      this._tilePane.remove(); world.off("viewreset moveend",this._update,this);
      this._tiles={};
    }
    _key(x,y,z){return `${z}:${x}:${y}`;}
    _update(){
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
          this._tiles[key].remove();
          delete this._tiles[key];
        }
      }
    }
  }
  class GeoJSONLayer extends Layer {
    constructor(data,opt={}){ super(opt); this._data=data; this._childLayers=[]; }
    onAdd(world){
      const addFeature=(f)=>{
        const {type,coordinates}=f.geometry; let layer;
        if(type==="Point"){
          layer=new Pin([coordinates[1],coordinates[0]],this._opt);
        }else if(type==="LineString"){
          layer=new Path(coordinates.map((c)=>[c[1],c[0]]),this._opt);
        }else if(type==="Polygon"){
          layer=new Polygon(coordinates[0].map((c)=>[c[1],c[0]]),this._opt);
        }
        if(layer){ layer.addTo(world); this._childLayers.push(layer); }
      };
      this._data.features.forEach(addFeature);
    }
    onRemove(world){ this._childLayers.forEach((l)=>world.removeLayer(l)); this._childLayers=[]; }
  }

  /* ========= World ========= */
  class World extends Emitter {
    #root; #opts; #zoom; #center; #layers=[]; #animator; #isRTL; #lastPan; #velocity=new Point(0,0);
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

      this._renderer=new this.#opts.renderer(this);
      this._renderer.onAdd();

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
    addLayer(l){ l._world=this; this.#layers.push(l); l.onAdd(this); return this; }
    removeLayer(l){ this.#layers=this.#layers.filter((x)=>x!==l); l.onRemove(this); return this; }
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

    // Internal
    _getMapSize(){ return new Point(this.#root.clientWidth,this.#root.clientHeight); }
    project(ll,z=this.#zoom){ return this.#opts.crs.project(ll).multiplyBy(this.#opts.tileSize*(2**z)); }
    unproject(p,z=this.#zoom){ return this.#opts.crs.unproject(p.divideBy(this.#opts.tileSize*(2**z))); }
    latLngToContainer(ll){ return this.project(ll).subtract(this.project(this._getPixelOrigin())); }
    _getPixelOrigin(){ const center=this.project(this.#center); const size=this._getMapSize(); return center.subtract(size.divideBy(2)); }
    _update(){ const pixelOrigin=this._getPixelOrigin(); this._mapPane.style.transform=`translate(${-pixelOrigin.x}px, ${-pixelOrigin.y}px)`;}

    #setupEvents(){
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
  }

  // Inject CSS
  const style=document.createElement("style");
  style.innerHTML=`
  .atlas-world { position:relative; overflow:hidden; background:#ddd; user-select:none; }
  .atlas-map-pane, .atlas-overlay-pane, .atlas-marker-pane, .atlas-tile-pane { position:absolute; top:0; left:0; width:100%; height:100%; }
  .atlas-pin{ width:10px; height:10px; border-radius:50%; background:red; border:2px solid #fff; margin:-7px 0 0 -7px; position:absolute; outline:none;}
  .atlas-pin:focus{ box-shadow:0 0 0 3px rgba(0,0,255,0.5);}
  .atlas-popup{ background:#fff; border:1px solid #333; border-radius:3px; padding:4px 8px; position:absolute; transform:translate(-50%,-100%); }
  .atlas-popup-close{ cursor:pointer; position:absolute; top:2px; right:4px; }
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
    CRS,LatLng,Point,LatLngBounds,
    Renderers:{CanvasRenderer}
  };
})(typeof window!=="undefined"? window: globalThis);
