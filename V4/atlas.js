/*!
 * Atlas.js v0.1 — MIT License
 * JavaScript Mapping Library.
 * Author: ElWali ElAlaoui, Atlasian, Tarfaya
 */

// ==========================================
// Core Event System
// ==========================================
class Emitter {
  constructor(){ this._events={}; }
  on(e,cb,ctx){ (this._events[e]??=[]).push({cb,ctx}); return this; }
  once(e,cb,ctx){ const once=(d)=>{cb.call(ctx,d);this.off(e,once);}; return this.on(e,once,ctx); }
  off(e,cb){
    if(!this._events[e])return this;
    if(!cb){ delete this._events[e]; return this; }
    this._events[e]=this._events[e].filter(f=>f.cb!==cb); return this;
  }
  emit(e,d){
    (this._events[e]||[]).forEach(({cb,ctx})=>cb.call(ctx,d));
    return this;
  }
  fire(e,d){ return this.emit(e,d); }
}

// ==========================================
// Utilities
// ==========================================
const dpr=typeof window!=="undefined"?window.devicePixelRatio||1:1;
const now=()=>performance?performance.now():Date.now();
const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
const wrap=(v,a,b)=>a+(((v-a)%(b-a)+(b-a))%(b-a));
const normalizeLng=l=>wrap(l,-180,180);
const easeOutCubic=t=>1-Math.pow(1-t,3);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const EARTH_RADIUS=6378137, CIRC=2*Math.PI*EARTH_RADIUS;

// ==========================================
// Coordinate Reference Systems
// ==========================================
class CRS {
  static EPSG3857 = {
    project: (lng, lat) => {
      const x = lng * CIRC / 360;
      const latRad = lat * Math.PI / 180;
      const y = Math.log(Math.tan(Math.PI/4 + latRad/2)) * EARTH_RADIUS;
      return [x, y];
    },
    unproject: (x, y) => {
      const lng = x * 360 / CIRC;
      const lat = 90 - 2 * Math.atan(Math.exp(-y / EARTH_RADIUS)) * 180 / Math.PI;
      return [lng, lat];
    }
  };
  
  static EPSG4326 = {
    project: (lng, lat) => [lng, lat],
    unproject: (x, y) => [x, y]
  };
}

// ==========================================
// Bounds
// ==========================================
class LatLngBounds {
  constructor(sw, ne) {
    if (!sw) return;
    this._southWest = [...sw];
    this._northEast = [...ne];
  }
  
  extend(latlng) {
    if (!this._southWest) {
      this._southWest = [...latlng];
      this._northEast = [...latlng];
    } else {
      this._southWest[0] = Math.min(this._southWest[0], latlng[0]);
      this._southWest[1] = Math.min(this._southWest[1], latlng[1]);
      this._northEast[0] = Math.max(this._northEast[0], latlng[0]);
      this._northEast[1] = Math.max(this._northEast[1], latlng[1]);
    }
    return this;
  }
  
  getSouthWest() { return this._southWest; }
  getNorthEast() { return this._northEast; }
  getCenter() {
    return [
      (this._southWest[0] + this._northEast[0]) / 2,
      (this._southWest[1] + this._northEast[1]) / 2
    ];
  }
  
  contains(latlng) {
    return latlng[0] >= this._southWest[0] && latlng[0] <= this._northEast[0] &&
           latlng[1] >= this._southWest[1] && latlng[1] <= this._northEast[1];
  }
  
  isValid() { return !!this._southWest; }
  
  toBBoxString() {
    return [this._southWest[1], this._southWest[0], this._northEast[1], this._northEast[0]].join(',');
  }
}

// ==========================================
// 3D Math Utilities
// ==========================================
class Vec3 {
  constructor(x=0, y=0, z=0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  static add(a, b) {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  
  static subtract(a, b) {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  
  static multiply(a, s) {
    return new Vec3(a.x * s, a.y * s, a.z * s);
  }
  
  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  
  static cross(a, b) {
    return new Vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  
  static length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
  
  static normalize(v) {
    const len = Vec3.length(v);
    if (len === 0) return new Vec3();
    return new Vec3(v.x / len, v.y / len, v.z / len);
  }
  
  static distance(a, b) {
    return Vec3.length(Vec3.subtract(a, b));
  }
}

class Mat4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }
  
  identity() {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }
  
  perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const e = this.elements;
    
    e[0] = f / aspect; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = f; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = (far + near) * nf; e[14] = (2 * far * near) * nf;
    e[3] = 0; e[7] = 0; e[11] = -1; e[15] = 0;
    return this;
  }
  
  lookAt(eye, center, up) {
    const f = Vec3.normalize(Vec3.subtract(center, eye));
    const s = Vec3.normalize(Vec3.cross(f, up));
    const u = Vec3.cross(s, f);
    
    const e = this.elements;
    e[0] = s.x; e[4] = s.y; e[8] = s.z; e[12] = -Vec3.dot(s, eye);
    e[1] = u.x; e[5] = u.y; e[9] = u.z; e[13] = -Vec3.dot(u, eye);
    e[2] = -f.x; e[6] = -f.y; e[10] = -f.z; e[14] = Vec3.dot(f, eye);
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }
  
  translate(x, y, z) {
    const e = this.elements;
    e[12] = e[0] * x + e[4] * y + e[8] * z + e[12];
    e[13] = e[1] * x + e[5] * y + e[9] * z + e[13];
    e[14] = e[2] * x + e[6] * y + e[10] * z + e[14];
    e[15] = e[3] * x + e[7] * y + e[11] * z + e[15];
    return this;
  }
  
  rotateX(angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const e = this.elements;
    
    const a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7];
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11];
    
    e[4] = a10 * c + a20 * s; e[5] = a11 * c + a21 * s;
    e[6] = a12 * c + a22 * s; e[7] = a13 * c + a23 * s;
    e[8] = a20 * c - a10 * s; e[9] = a21 * c - a11 * s;
    e[10] = a22 * c - a12 * s; e[11] = a23 * c - a13 * s;
    return this;
  }
  
  rotateY(angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const e = this.elements;
    
    const a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3];
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11];
    
    e[0] = a00 * c - a20 * s; e[1] = a01 * c - a21 * s;
    e[2] = a02 * c - a22 * s; e[3] = a03 * c - a23 * s;
    e[8] = a00 * s + a20 * c; e[9] = a01 * s + a21 * c;
    e[10] = a02 * s + a22 * c; e[11] = a03 * s + a23 * c;
    return this;
  }
  
  multiply(m) {
    const ae = this.elements;
    const be = m.elements;
    const te = new Float32Array(16);
    
    for (let i = 0; i < 4; i++) {
      const ai0 = ae[i], ai1 = ae[i + 4], ai2 = ae[i + 8], ai3 = ae[i + 12];
      te[i] = ai0 * be[0] + ai1 * be[1] + ai2 * be[2] + ai3 * be[3];
      te[i + 4] = ai0 * be[4] + ai1 * be[5] + ai2 * be[6] + ai3 * be[7];
      te[i + 8] = ai0 * be[8] + ai1 * be[9] + ai2 * be[10] + ai3 * be[11];
      te[i + 12] = ai0 * be[12] + ai1 * be[13] + ai2 * be[14] + ai3 * be[15];
    }
    
    this.elements.set(te);
    return this;
  }
}

// ==========================================
// Projection
// ==========================================
function project(lng,lat,z=0,t=256,crs=CRS.EPSG3857){
  const [x, y] = crs.project(lng, lat);
  const s=t*Math.pow(2,z)/CIRC;
  return {x:(x+CIRC/2)*s, y:-(y+CIRC/2)*s};
}
function unproject(x,y,z=0,t=256,crs=CRS.EPSG3857){
  const s=t*Math.pow(2,z)/CIRC;
  const px = x/s - CIRC/2;
  const py = -y/s - CIRC/2;
  return crs.unproject(px, py);
}

// ==========================================
// Cache (Offline Tiles)
// ==========================================
const CACHE_NAME="atlas-cache",CACHE_EXPIRY=86400000;
async function cacheAsset(url,data){
  try{if(!caches)return;const c=await caches.open(CACHE_NAME);
  const r=new Response(data,{headers:{'Cache-Timestamp':Date.now()}});
  await c.put(url,r);}catch(e){}
}
async function getCachedAsset(url){
  try{if(!caches)return null;const c=await caches.open(CACHE_NAME);
  const r=await c.match(url); if(!r)return null;
  const ts=r.headers.get("Cache-Timestamp");
  if(ts&&(Date.now()-+ts)<CACHE_EXPIRY)return await r.blob();
  await c.delete(url);
  }catch(e){}
  return null;
}

// ==========================================
// Base Classes
// ==========================================
class Layer extends Emitter{ 
  constructor(){super();this._map=null;this._container=null;}
  onAdd(map){ this._map=map; }
  onRemove(){ this._map=null; }
  getContainer(){ return this._container; }
  setZIndex(z){ if(this._container) this._container.style.zIndex = z; }
  getZIndex(){ return this._container ? parseInt(this._container.style.zIndex) || 0 : 0; }
  bringToFront(){ if(this._container && this._container.parentNode) this._container.parentNode.appendChild(this._container); return this; }
  bringToBack(){ if(this._container && this._container.parentNode) this._container.parentNode.insertBefore(this._container, this._container.parentNode.firstChild); return this; }
}

class Control extends Emitter{
  constructor(pos="top-right"){super();this.position=pos;
    this.el=document.createElement('div');this.el.className='atlas-control';}
  onAdd(map){ this._map=map; }
  onRemove(){ this._map=null; }
  getElement(){ return this.el; }
}

// ==========================================
// Layer Group
// ==========================================
class LayerGroup extends Layer {
  constructor(layers=[]){
    super();
    this._layers = new Map();
    layers.forEach((layer, id) => this.addLayer(layer, id));
  }
  
  addLayer(layer, id){
    id = id || this._getUniqueId();
    this._layers.set(id, layer);
    if(this._map) {
      layer.onAdd(this._map);
      this._map._layers.push(layer);
    }
    return this;
  }
  
  removeLayer(id){
    const layer = this._layers.get(id);
    if(layer && this._map) {
      layer.onRemove();
      const index = this._map._layers.indexOf(layer);
      if(index > -1) this._map._layers.splice(index, 1);
    }
    this._layers.delete(id);
    return this;
  }
  
  hasLayer(id){ return this._layers.has(id); }
  getLayer(id){ return this._layers.get(id); }
  getLayers(){ return Array.from(this._layers.values()); }
  clearLayers(){ this._layers.forEach((_, id) => this.removeLayer(id)); return this; }
  
  onAdd(map){
    super.onAdd(map);
    this._layers.forEach(layer => layer.onAdd(map));
  }
  
  onRemove(){
    this._layers.forEach(layer => layer.onRemove());
    super.onRemove();
  }
  
  _getUniqueId(){
    return 'layer_' + Math.random().toString(36).substr(2, 9);
  }
}

// ==========================================
// TileLayer with optional Canvas rendering
// ==========================================
class TileLayer extends Layer {
  constructor(tpl,opt={}){ 
    super(); 
    this.tpl=tpl;
    this.opt={
      minZoom:0,
      maxZoom:22,
      tileSize:256,
      subdomains:'abc',
      canvas:false,
      updateWhenIdle:false,
      opacity: 1,
      zIndex: 0,
      attribution: '',
      ...opt
    };
    this.tiles=new Map(); 
    this._tileContainer = null;
  }
  
  onAdd(map){ 
    super.onAdd(map);
    this._container=document.createElement('div'); 
    this._container.className='atlas-tile';
    Object.assign(this._container.style,{
      position:'absolute',
      width:'100%',
      height:'100%',
      zIndex: this.opt.zIndex,
      opacity: this.opt.opacity
    });
    
    this._tileContainer = document.createElement('div');
    this._tileContainer.style.cssText = 'position:absolute;left:0;top:0;';
    this._container.appendChild(this._tileContainer);
    
    map._canvasContainer.appendChild(this._container); 
    map.on('move',()=>this._update()); 
    this._update();
    
    // Add attribution if present
    if(this.opt.attribution && map.attributionControl) {
      map.attributionControl.addAttribution(this.opt.attribution);
    }
  }
  
  onRemove(){
    this.tiles.forEach(t=>URL.revokeObjectURL(t.url)); 
    this._container.remove(); 
    this.tiles.clear(); 
    
    // Remove attribution
    if(this.opt.attribution && this._map && this._map.attributionControl) {
      this._map.attributionControl.removeAttribution(this.opt.attribution);
    }
    
    super.onRemove();
  }
  
  _url(x,y,z){ 
    let u=this.tpl.replace('{x}',x).replace('{y}',y).replace('{z}',z);
    if(this.opt.subdomains&&u.includes('{s}')) 
      u=u.replace('{s}',this.opt.subdomains[(x+y)%this.opt.subdomains.length]); 
    return u; 
  }
  
  async _load(x,y,z){
    const k=`${x},${y},${z}`; 
    if(this.tiles.has(k))return; 
    const url=this._url(x,y,z);
    let b=await getCachedAsset(url); 
    if(!b){
      try{
        const r=await fetch(url); 
        b=await r.blob(); 
        await cacheAsset(url,b);
      }catch(e){return;}
    }
    const ou=URL.createObjectURL(b); 
    if(this.opt.canvas){
      const img=new Image(); 
      img.src=ou; 
      img.onload=()=>{
        this._tileContainer.getContext('2d').drawImage(
          img,
          x*this.opt.tileSize,
          y*this.opt.tileSize,
          this.opt.tileSize,
          this.opt.tileSize
        );
      }
      this.tiles.set(k,{img,url:ou}); 
    } else {
      const img=document.createElement('img'); 
      img.src=ou;
      Object.assign(img.style,{
        position:'absolute',
        width:this.opt.tileSize+'px',
        height:this.opt.tileSize+'px'
      });
      this._tileContainer.appendChild(img); 
      this.tiles.set(k,{img,url:ou});
    }
  }
  
  _update(){
    if(this.opt.updateWhenIdle && this._map._moving) return;
    
    const z=Math.floor(this._map._zoom); 
    if(z<this.opt.minZoom||z>this.opt.maxZoom){
      this._clear();
      return;
    }
    
    const w=this._map.container.clientWidth,h=this._map.container.clientHeight;
    const tl=this._map._pointToLngLat(-256,-256),br=this._map._pointToLngLat(w+256,h+256);
    const tpl=project(...tl,z,this.opt.tileSize),brp=project(...br,z,this.opt.tileSize);
    const minX=Math.floor(tpl.x/this.opt.tileSize),maxX=Math.ceil(brp.x/this.opt.tileSize);
    const minY=Math.floor(tpl.y/this.opt.tileSize),maxY=Math.ceil(brp.y/this.opt.tileSize);
    const need=new Set();
    
    for(let x=minX;x<=maxX;x++) 
      for(let y=minY;y<=maxY;y++){
        const k=`${x},${y},${z}`; 
        need.add(k); 
        if(!this.tiles.has(k)) this._load(x,y,z);
        if(!this.opt.canvas){
          const t=this.tiles.get(k); 
          if(t){
            const c=project(...this._map._center,this._map._zoom);
            const px=w/2+(x*this.opt.tileSize-c.x); 
            const py=h/2+(y*this.opt.tileSize-c.y);
            t.img.style.transform=`translate(${px}px,${py}px)`;
          }
        }
      }
    
    for(const [k,t] of this.tiles) 
      if(!need.has(k)){ 
        if(!this.opt.canvas){t.img.remove();} 
        URL.revokeObjectURL(t.url); 
        this.tiles.delete(k);
      }
  }
  
  _clear(){
    this.tiles.forEach(t=>{
      if(!this.opt.canvas)t.img.remove(); 
      URL.revokeObjectURL(t.url);
    }); 
    this.tiles.clear();
  }
  
  setOpacity(opacity){
    this.opt.opacity = opacity;
    if(this._container) this._container.style.opacity = opacity;
    return this;
  }
  
  getOpacity(){ return this.opt.opacity; }
  
  setUrl(url){
    this.tpl = url;
    this._clear();
    if(this._map) this._update();
    return this;
  }
}

// ==========================================
// 3D Terrain Layer
// ==========================================
class TerrainLayer extends Layer {
  constructor(opt={}){
    super();
    this.opt = {
      elevationData: null,
      exaggeration: 1.0,
      wireframe: false,
      color: '#777777',
      ...opt
    };
    this._webglContext = null;
    this._program = null;
    this._buffers = {};
    this._textures = {};
    this._terrainData = null;
    this._needsUpdate = true;
  }
  
  onAdd(map){
    super.onAdd(map);
    
    // Create canvas for WebGL
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'atlas-terrain';
    this._canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    map._canvasContainer.appendChild(this._canvas);
    
    // Initialize WebGL
    this._initWebGL();
    
    // Listen for map events
    map.on('move', () => this._update());
    map.on('zoom', () => this._needsUpdate = true);
    
    this._update();
  }
  
  onRemove(){
    if(this._canvas) {
      this._canvas.remove();
    }
    this._cleanupWebGL();
    super.onRemove();
  }
  
  _initWebGL(){
    try {
      this._webglContext = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
      if(!this._webglContext) throw new Error('WebGL not supported');
      
      // Vertex shader source
      const vertShaderSrc = `
        attribute vec3 a_position;
        attribute vec3 a_normal;
        uniform mat4 u_modelViewMatrix;
        uniform mat4 u_projectionMatrix;
        uniform float u_exaggeration;
        varying vec3 v_normal;
        varying vec3 v_position;
        
        void main() {
          vec3 pos = a_position;
          pos.z *= u_exaggeration;
          gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(pos, 1.0);
          v_normal = a_normal;
          v_position = pos;
        }
      `;
      
      // Fragment shader source
      const fragShaderSrc = `
        precision mediump float;
        uniform vec3 u_lightDirection;
        uniform vec3 u_color;
        varying vec3 v_normal;
        varying vec3 v_position;
        
        void main() {
          vec3 normal = normalize(v_normal);
          float diffuse = max(dot(normal, u_lightDirection), 0.0);
          vec3 color = u_color * (0.3 + 0.7 * diffuse);
          gl_FragColor = vec4(color, 1.0);
        }
      `;
      
      // Create shaders
      const vertShader = this._createShader(this._webglContext.VERTEX_SHADER, vertShaderSrc);
      const fragShader = this._createShader(this._webglContext.FRAGMENT_SHADER, fragShaderSrc);
      
      // Create program
      this._program = this._createProgram(vertShader, fragShader);
      this._webglContext.useProgram(this._program);
      
      // Get attribute and uniform locations
      this._attributes = {
        position: this._webglContext.getAttribLocation(this._program, 'a_position'),
        normal: this._webglContext.getAttribLocation(this._program, 'a_normal')
      };
      
      this._uniforms = {
        modelViewMatrix: this._webglContext.getUniformLocation(this._program, 'u_modelViewMatrix'),
        projectionMatrix: this._webglContext.getUniformLocation(this._program, 'u_projectionMatrix'),
        exaggeration: this._webglContext.getUniformLocation(this._program, 'u_exaggeration'),
        lightDirection: this._webglContext.getUniformLocation(this._program, 'u_lightDirection'),
        color: this._webglContext.getUniformLocation(this._program, 'u_color')
      };
      
      // Create buffers
      this._buffers.position = this._webglContext.createBuffer();
      this._buffers.normal = this._webglContext.createBuffer();
      this._buffers.index = this._webglContext.createBuffer();
      
      // Set up lighting
      this._lightDirection = Vec3.normalize(new Vec3(0.5, 0.7, 1.0));
      
    } catch(e) {
      console.warn('WebGL terrain initialization failed:', e);
    }
  }
  
  _createShader(type, source) {
    const shader = this._webglContext.createShader(type);
    this._webglContext.shaderSource(shader, source);
    this._webglContext.compileShader(shader);
    
    if(!this._webglContext.getShaderParameter(shader, this._webglContext.COMPILE_STATUS)) {
      console.error(this._webglContext.getShaderInfoLog(shader));
      this._webglContext.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  _createProgram(vertexShader, fragmentShader) {
    const program = this._webglContext.createProgram();
    this._webglContext.attachShader(program, vertexShader);
    this._webglContext.attachShader(program, fragmentShader);
    this._webglContext.linkProgram(program);
    
    if(!this._webglContext.getProgramParameter(program, this._webglContext.LINK_STATUS)) {
      console.error(this._webglContext.getProgramInfoLog(program));
      this._webglContext.deleteProgram(program);
      return null;
    }
    
    return program;
  }
  
  _cleanupWebGL(){
    if(this._webglContext) {
      // Clean up WebGL resources
      Object.values(this._buffers).forEach(buffer => {
        if(buffer) this._webglContext.deleteBuffer(buffer);
      });
      
      Object.values(this._textures).forEach(texture => {
        if(texture) this._webglContext.deleteTexture(texture);
      });
      
      if(this._program) this._webglContext.deleteProgram(this._program);
    }
  }
  
  setElevationData(data){
    this.opt.elevationData = data;
    this._needsUpdate = true;
    this._update();
    return this;
  }
  
  setExaggeration(exaggeration){
    this.opt.exaggeration = exaggeration;
    this._update();
    return this;
  }
  
  setColor(color){
    this.opt.color = color;
    this._update();
    return this;
  }
  
  _update(){
    if(!this._webglContext || !this._map) return;
    
    const gl = this._webglContext;
    const canvas = this._canvas;
    
    // Update canvas size
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Clear
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    
    if(this._needsUpdate || !this._terrainData) {
      this._generateTerrain();
      this._needsUpdate = false;
    }
    
    if(!this._terrainData) return;
    
    // Set up matrices
    const projectionMatrix = new Mat4().perspective(
      Math.PI / 4, 
      canvas.width / canvas.height, 
      0.1, 
      1000.0
    );
    
    const viewMatrix = new Mat4().lookAt(
      new Vec3(0, 0, 5), 
      new Vec3(0, 0, 0), 
      new Vec3(0, 1, 0)
    );
    
    const modelViewMatrix = new Mat4().multiply(viewMatrix);
    
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, this._terrainData.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.position);
    gl.vertexAttribPointer(this._attributes.position, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, this._terrainData.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.normal);
    gl.vertexAttribPointer(this._attributes.normal, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buffers.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._terrainData.indices, gl.STATIC_DRAW);
    
    // Set uniforms
    gl.uniformMatrix4fv(this._uniforms.projectionMatrix, false, projectionMatrix.elements);
    gl.uniformMatrix4fv(this._uniforms.modelViewMatrix, false, modelViewMatrix.elements);
    gl.uniform1f(this._uniforms.exaggeration, this.opt.exaggeration);
    gl.uniform3fv(this._uniforms.lightDirection, [this._lightDirection.x, this._lightDirection.y, this._lightDirection.z]);
    gl.uniform3fv(this._uniforms.color, this._hexToRgb(this.opt.color));
    
    // Draw
    gl.drawElements(gl.TRIANGLES, this._terrainData.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  
  _generateTerrain(){
    if(!this.opt.elevationData) return;
    
    const width = 100;
    const height = 100;
    const size = width * height;
    
    // Create position and normal arrays
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const indices = new Uint16Array((width - 1) * (height - 1) * 6);
    
    // Generate positions
    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        const index = (y * width + x) * 3;
        const elevation = this.opt.elevationData[y * width + x] || 0;
        
        positions[index] = (x / width - 0.5) * 2;
        positions[index + 1] = (y / height - 0.5) * 2;
        positions[index + 2] = elevation * 0.01; // Scale elevation
      }
    }
    
    // Generate normals
    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        const index = (y * width + x) * 3;
        
        // Simple normal calculation (could be improved)
        normals[index] = 0;
        normals[index + 1] = 0;
        normals[index + 2] = 1;
      }
    }
    
    // Generate indices
    let idx = 0;
    for(let y = 0; y < height - 1; y++) {
      for(let x = 0; x < width - 1; x++) {
        const a = y * width + x;
        const b = y * width + (x + 1);
        const c = (y + 1) * width + x;
        const d = (y + 1) * width + (x + 1);
        
        indices[idx++] = a;
        indices[idx++] = b;
        indices[idx++] = c;
        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = c;
      }
    }
    
    this._terrainData = {
      positions,
      normals,
      indices
    };
  }
  
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.5, 0.5, 0.5];
  }
}

// ==========================================
// 3D Building Layer
// ==========================================
class BuildingLayer extends Layer {
  constructor(opt={}){
    super();
    this.opt = {
      data: [],
      baseColor: '#aaaaaa',
      heightColor: '#ff7700',
      minHeight: 0,
      maxHeight: 200,
      ...opt
    };
    this._webglContext = null;
    this._program = null;
    this._buffers = {};
    this._buildings = [];
  }
  
  onAdd(map){
    super.onAdd(map);
    
    // Create canvas for WebGL
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'atlas-buildings';
    this._canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    map._canvasContainer.appendChild(this._canvas);
    
    // Initialize WebGL
    this._initWebGL();
    
    // Listen for map events
    map.on('move', () => this._update());
    
    this._update();
  }
  
  onRemove(){
    if(this._canvas) {
      this._canvas.remove();
    }
    this._cleanupWebGL();
    super.onRemove();
  }
  
  _initWebGL(){
    try {
      this._webglContext = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
      if(!this._webglContext) throw new Error('WebGL not supported');
      
      // Vertex shader source
      const vertShaderSrc = `
        attribute vec3 a_position;
        uniform mat4 u_modelViewMatrix;
        uniform mat4 u_projectionMatrix;
        uniform float u_height;
        varying vec3 v_position;
        varying float v_height;
        
        void main() {
          vec3 pos = a_position;
          pos.z *= u_height;
          gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(pos, 1.0);
          v_position = pos;
          v_height = u_height;
        }
      `;
      
      // Fragment shader source
      const fragShaderSrc = `
        precision mediump float;
        uniform vec3 u_baseColor;
        uniform vec3 u_heightColor;
        varying vec3 v_position;
        varying float v_height;
        
        void main() {
          float heightFactor = clamp(v_height / 200.0, 0.0, 1.0);
          vec3 color = mix(u_baseColor, u_heightColor, heightFactor);
          gl_FragColor = vec4(color, 1.0);
        }
      `;
      
      // Create shaders
      const vertShader = this._createShader(this._webglContext.VERTEX_SHADER, vertShaderSrc);
      const fragShader = this._createShader(this._webglContext.FRAGMENT_SHADER, fragShaderSrc);
      
      // Create program
      this._program = this._createProgram(vertShader, fragShader);
      this._webglContext.useProgram(this._program);
      
      // Get attribute and uniform locations
      this._attributes = {
        position: this._webglContext.getAttribLocation(this._program, 'a_position')
      };
      
      this._uniforms = {
        modelViewMatrix: this._webglContext.getUniformLocation(this._program, 'u_modelViewMatrix'),
        projectionMatrix: this._webglContext.getUniformLocation(this._program, 'u_projectionMatrix'),
        height: this._webglContext.getUniformLocation(this._program, 'u_height'),
        baseColor: this._webglContext.getUniformLocation(this._program, 'u_baseColor'),
        heightColor: this._webglContext.getUniformLocation(this._program, 'u_heightColor')
      };
      
      // Create buffer
      this._buffers.position = this._webglContext.createBuffer();
      
    } catch(e) {
      console.warn('WebGL buildings initialization failed:', e);
    }
  }
  
  _createShader(type, source) {
    const shader = this._webglContext.createShader(type);
    this._webglContext.shaderSource(shader, source);
    this._webglContext.compileShader(shader);
    
    if(!this._webglContext.getShaderParameter(shader, this._webglContext.COMPILE_STATUS)) {
      console.error(this._webglContext.getShaderInfoLog(shader));
      this._webglContext.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  _createProgram(vertexShader, fragmentShader) {
    const program = this._webglContext.createProgram();
    this._webglContext.attachShader(program, vertexShader);
    this._webglContext.attachShader(program, fragmentShader);
    this._webglContext.linkProgram(program);
    
    if(!this._webglContext.getProgramParameter(program, this._webglContext.LINK_STATUS)) {
      console.error(this._webglContext.getProgramInfoLog(program));
      this._webglContext.deleteProgram(program);
      return null;
    }
    
    return program;
  }
  
  _cleanupWebGL(){
    if(this._webglContext) {
      // Clean up WebGL resources
      Object.values(this._buffers).forEach(buffer => {
        if(buffer) this._webglContext.deleteBuffer(buffer);
      });
      
      if(this._program) this._webglContext.deleteProgram(this._program);
    }
  }
  
  setData(buildings){
    this.opt.data = buildings || [];
    this._update();
    return this;
  }
  
  _update(){
    if(!this._webglContext || !this._map) return;
    
    const gl = this._webglContext;
    const canvas = this._canvas;
    
    // Update canvas size
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Clear
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    
    // Render each building
    this.opt.data.forEach(building => {
      this._renderBuilding(building);
    });
  }
  
  _renderBuilding(building){
    const gl = this._webglContext;
    
    // Create cube geometry for building
    const width = building.width || 10;
    const depth = building.depth || 10;
    const height = Math.max(this.opt.minHeight, Math.min(building.height || 50, this.opt.maxHeight));
    
    // Cube vertices
    const vertices = new Float32Array([
      // Front face
      -width/2, -depth/2, 0,
       width/2, -depth/2, 0,
       width/2,  depth/2, 0,
      -width/2,  depth/2, 0,
      
      // Back face
      -width/2, -depth/2, height,
       width/2, -depth/2, height,
       width/2,  depth/2, height,
      -width/2,  depth/2, height,
    ]);
    
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._attributes.position);
    gl.vertexAttribPointer(this._attributes.position, 3, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    const projectionMatrix = new Mat4().perspective(
      Math.PI / 4, 
      this._canvas.width / this._canvas.height, 
      0.1, 
      1000.0
    );
    
    const viewMatrix = new Mat4().lookAt(
      new Vec3(0, 0, 100), 
      new Vec3(0, 0, 0), 
      new Vec3(0, 1, 0)
    );
    
    const modelViewMatrix = new Mat4().multiply(viewMatrix);
    
    gl.uniformMatrix4fv(this._uniforms.projectionMatrix, false, projectionMatrix.elements);
    gl.uniformMatrix4fv(this._uniforms.modelViewMatrix, false, modelViewMatrix.elements);
    gl.uniform1f(this._uniforms.height, height);
    gl.uniform3fv(this._uniforms.baseColor, this._hexToRgb(this.opt.baseColor));
    gl.uniform3fv(this._uniforms.heightColor, this._hexToRgb(this.opt.heightColor));
    
    // Draw cube (simplified - just front and back faces)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4); // Front
    gl.drawArrays(gl.TRIANGLE_FAN, 4, 4); // Back
  }
  
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.5, 0.5, 0.5];
  }
}

// ==========================================
// WebGL Vector Layer with Clustering
// ==========================================
class WebGLVectorLayer extends Layer {
  constructor(opt={}){
    super(); 
    this.opt={
      tileSize:512,
      style:{},
      interactive: true,
      cluster: false,
      clusterRadius: 40,
      clusterMaxZoom: 14,
      heatmap: false,
      heatmapRadius: 25,
      heatmapBlur: 15,
      heatmapGradient: {
        0.0: 'blue',
        0.25: 'lime',
        0.5: 'yellow',
        0.75: 'orange',
        1.0: 'red'
      },
      ...opt
    }; 
    this._features=[];
    this._featureIndex = new Map();
    this._clusters = [];
    this._clusterIndex = new Map();
    this._webglContext = null;
    this._program = null;
    this._buffers = {};
    this._textures = {};
  }
  
  onAdd(map){ 
    super.onAdd(map);
    this._canvas=document.createElement('canvas');
    this._canvas.className='atlas-webgl-vector'; 
    this._canvas.style.cssText = 'position:absolute;left:0;top:0;';
    map._canvasContainer.appendChild(this._canvas);
    
    // Initialize WebGL
    this._initWebGL();
    
    map.on('move',()=>this._update()); 
    this._update();
    
    if(this.opt.interactive) {
      this._setupInteractivity();
    }
  }
  
  onRemove(){
    this._canvas.remove(); 
    this._cleanupWebGL();
    super.onRemove();
  }
  
  _initWebGL(){
    try {
      this._webglContext = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
      if(!this._webglContext) throw new Error('WebGL not supported');
      
      // Vertex shader source
      const vertShaderSrc = `
        attribute vec2 a_position;
        attribute vec4 a_color;
        uniform vec2 u_resolution;
        uniform float u_pointSize;
        varying vec4 v_color;
        
        void main() {
          vec2 zeroToOne = a_position / u_resolution;
          vec2 zeroToTwo = zeroToOne * 2.0;
          vec2 clipSpace = zeroToTwo - 1.0;
          gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
          gl_PointSize = u_pointSize;
          v_color = a_color;
        }
      `;
      
      // Fragment shader source
      const fragShaderSrc = `
        precision mediump float;
        varying vec4 v_color;
        
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
          if(dist > 0.5) discard;
          gl_FragColor = v_color;
        }
      `;
      
      // Create shaders
      const vertShader = this._createShader(this._webglContext.VERTEX_SHADER, vertShaderSrc);
      const fragShader = this._createShader(this._webglContext.FRAGMENT_SHADER, fragShaderSrc);
      
      // Create program
      this._program = this._createProgram(vertShader, fragShader);
      this._webglContext.useProgram(this._program);
      
      // Get attribute locations
      this._buffers.position = this._webglContext.createBuffer();
      this._buffers.color = this._webglContext.createBuffer();
      
      // Get uniform locations
      this._uniforms = {
        resolution: this._webglContext.getUniformLocation(this._program, 'u_resolution'),
        pointSize: this._webglContext.getUniformLocation(this._program, 'u_pointSize')
      };
    } catch(e) {
      console.warn('WebGL initialization failed, falling back to Canvas');
      this._fallbackToCanvas();
    }
  }
  
  _createShader(type, source) {
    const shader = this._webglContext.createShader(type);
    this._webglContext.shaderSource(shader, source);
    this._webglContext.compileShader(shader);
    
    if(!this._webglContext.getShaderParameter(shader, this._webglContext.COMPILE_STATUS)) {
      console.error(this._webglContext.getShaderInfoLog(shader));
      this._webglContext.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  _createProgram(vertexShader, fragmentShader) {
    const program = this._webglContext.createProgram();
    this._webglContext.attachShader(program, vertexShader);
    this._webglContext.attachShader(program, fragmentShader);
    this._webglContext.linkProgram(program);
    
    if(!this._webglContext.getProgramParameter(program, this._webglContext.LINK_STATUS)) {
      console.error(this._webglContext.getProgramInfoLog(program));
      this._webglContext.deleteProgram(program);
      return null;
    }
    
    return program;
  }
  
  _fallbackToCanvas(){
    this._canvas.remove();
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'atlas-vector';
    this._canvas.style.cssText = 'position:absolute;left:0;top:0;';
    this._map._canvasContainer.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');
    this._renderCanvas = true;
  }
  
  _cleanupWebGL(){
    if(this._webglContext) {
      // Clean up WebGL resources
      Object.values(this._buffers).forEach(buffer => {
        if(buffer) this._webglContext.deleteBuffer(buffer);
      });
      
      Object.values(this._textures).forEach(texture => {
        if(texture) this._webglContext.deleteTexture(texture);
      });
      
      if(this._program) this._webglContext.deleteProgram(this._program);
    }
  }
  
  addFeature(f, id){
    id = id || this._getUniqueId();
    f.id = id;
    this._features.push(f); 
    this._featureIndex.set(id, f);
    this._update();
    return this;
  }
  
  removeFeature(id){
    const feature = this._featureIndex.get(id);
    if(feature) {
      const index = this._features.indexOf(feature);
      if(index > -1) this._features.splice(index, 1);
      this._featureIndex.delete(id);
      this._update();
    }
    return this;
  }
  
  getFeature(id){ return this._featureIndex.get(id); }
  getFeatures(){ return [...this._features]; }
  
  _update(){ 
    if(this.opt.cluster && this._map._zoom <= this.opt.clusterMaxZoom) {
      this._clusters = this._clusterFeatures();
      this._renderClusters();
    } else {
      this._renderFeatures();
    }
  }
  
  _clusterFeatures(){
    const clusters = [];
    const processed = new Set();
    
    for(let i = 0; i < this._features.length; i++) {
      if(processed.has(i)) continue;
      
      const feature = this._features[i];
      if(feature.geometry.type !== 'Point') continue;
      
      const point = this._map._lngLatToPoint(...feature.geometry.coordinates);
      const cluster = {
        points: [point],
        features: [feature],
        center: point
      };
      
      for(let j = i + 1; j < this._features.length; j++) {
        if(processed.has(j)) continue;
        
        const otherFeature = this._features[j];
        if(otherFeature.geometry.type !== 'Point') continue;
        
        const otherPoint = this._map._lngLatToPoint(...otherFeature.geometry.coordinates);
        const dist = distance([point.x, point.y], [otherPoint.x, otherPoint.y]);
        
        if(dist <= this.opt.clusterRadius) {
          cluster.points.push(otherPoint);
          cluster.features.push(otherFeature);
          processed.add(j);
          
          // Update cluster center
          const totalPoints = cluster.points.length;
          cluster.center = {
            x: cluster.points.reduce((sum, p) => sum + p.x, 0) / totalPoints,
            y: cluster.points.reduce((sum, p) => sum + p.y, 0) / totalPoints
          };
        }
      }
      
      processed.add(i);
      clusters.push(cluster);
    }
    
    return clusters;
  }
  
  _renderClusters(){
    if(this._renderCanvas) {
      this._renderClustersCanvas();
    } else {
      this._renderClustersWebGL();
    }
  }
  
  _renderClustersWebGL(){
    const gl = this._webglContext;
    const canvas = this._canvas;
    
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if(this._clusters.length === 0) return;
    
    // Prepare data
    const positions = [];
    const colors = [];
    
    this._clusters.forEach(cluster => {
      const count = cluster.features.length;
      const size = Math.min(40, 20 + count * 0.5);
      
      positions.push(cluster.center.x * dpr, cluster.center.y * dpr);
      
      // Color based on count
      const intensity = Math.min(1, count / 100);
      colors.push(intensity, 0.5, 1.0 - intensity, 0.8);
    });
    
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(this._program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    const colorLocation = gl.getAttribLocation(this._program, 'a_color');
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniform2f(this._uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(this._uniforms.pointSize, 30);
    
    // Draw
    gl.drawArrays(gl.POINTS, 0, this._clusters.length);
  }
  
  _renderClustersCanvas(){
    const ctx = this._ctx;
    const canvas = this._canvas;
    
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    this._clusters.forEach(cluster => {
      const count = cluster.features.length;
      const size = Math.min(40, 20 + count * 0.5);
      
      ctx.beginPath();
      ctx.arc(cluster.center.x, cluster.center.y, size/2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 100, 0.6)`;
      ctx.fill();
      
      // Draw count
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count.toString(), cluster.center.x, cluster.center.y);
    });
  }
  
  _renderFeatures(){
    if(this._renderCanvas) {
      this._renderFeaturesCanvas();
    } else {
      this._renderFeaturesWebGL();
    }
  }
  
  _renderFeaturesWebGL(){
    const gl = this._webglContext;
    const canvas = this._canvas;
    
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if(this._features.length === 0) return;
    
    // Prepare data
    const positions = [];
    const colors = [];
    
    this._features.forEach(feature => {
      if(feature.geometry.type === 'Point') {
        const point = this._map._lngLatToPoint(...feature.geometry.coordinates);
        positions.push(point.x * dpr, point.y * dpr);
        
        const color = feature.properties.color || '#3388ff';
        const rgba = this._hexToRgba(color, 0.7);
        colors.push(rgba.r, rgba.g, rgba.b, rgba.a);
      }
    });
    
    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(this._program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    const colorLocation = gl.getAttribLocation(this._program, 'a_color');
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniform2f(this._uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(this._uniforms.pointSize, 10);
    
    // Draw
    gl.drawArrays(gl.POINTS, 0, this._features.filter(f => f.geometry.type === 'Point').length);
  }
  
  _renderFeaturesCanvas(){
    const ctx = this._ctx;
    const canvas = this._canvas;
    
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    this._features.forEach(feature => {
      this._drawFeature(ctx, feature);
    });
  }
  
  _drawFeature(ctx, f){
    ctx.beginPath();
    if(f.geometry.type==="Point"){ 
      const p=this._map._lngLatToPoint(...f.geometry.coordinates); 
      ctx.arc(p.x,p.y,f.properties.radius||5,0,Math.PI*2); 
      ctx.fillStyle=f.properties.color||'rgba(0,0,255,0.6)'; 
      ctx.fill();
      if(f.properties.stroke) {
        ctx.strokeStyle = f.properties.stroke;
        ctx.lineWidth = f.properties.strokeWidth || 1;
        ctx.stroke();
      }
    } else if(f.geometry.type==="LineString") {
      const coords = f.geometry.coordinates;
      if(coords.length < 2) return;
      
      ctx.beginPath();
      const start = this._map._lngLatToPoint(...coords[0]);
      ctx.moveTo(start.x, start.y);
      
      for(let i=1; i<coords.length; i++) {
        const p = this._map._lngLatToPoint(...coords[i]);
        ctx.lineTo(p.x, p.y);
      }
      
      ctx.strokeStyle = f.properties.color || '#3388ff';
      ctx.lineWidth = f.properties.weight || 3;
      ctx.lineCap = f.properties.lineCap || 'round';
      ctx.lineJoin = f.properties.lineJoin || 'round';
      ctx.stroke();
    } else if(f.geometry.type==="Polygon") {
      const rings = f.geometry.coordinates;
      ctx.beginPath();
      
      rings.forEach((ring, i) => {
        if(ring.length < 3) return;
        
        const start = this._map._lngLatToPoint(...ring[0]);
        ctx.moveTo(start.x, start.y);
        
        for(let j=1; j<ring.length; j++) {
          const p = this._map._lngLatToPoint(...ring[j]);
          ctx.lineTo(p.x, p.y);
        }
        
        ctx.closePath();
      });
      
      if(f.properties.fill !== false) {
        ctx.fillStyle = f.properties.fillColor || f.properties.color || '#3388ff';
        ctx.globalAlpha = f.properties.fillOpacity || 0.2;
        ctx.fill();
      }
      
      if(f.properties.stroke !== false) {
        ctx.strokeStyle = f.properties.color || '#3388ff';
        ctx.lineWidth = f.properties.weight || 3;
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    }
  }
  
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b, a: alpha };
  }
  
  _setupInteractivity(){
    const handleClick = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Check clusters first
      if(this.opt.cluster && this._clusters.length > 0) {
        for(const cluster of this._clusters) {
          const dist = distance([x, y], [cluster.center.x, cluster.center.y]);
          if(dist <= 20) {
            this.emit('clusterclick', {cluster, originalEvent: e});
            return;
          }
        }
      }
      
      // Simple hit testing for points
      for(let i = this._features.length - 1; i >= 0; i--) {
        const f = this._features[i];
        if(f.geometry.type === "Point") {
          const p = this._map._lngLatToPoint(...f.geometry.coordinates);
          const radius = f.properties.radius || 5;
          const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
          
          if(distance <= radius) {
            this.emit('featureclick', {feature: f, originalEvent: e});
            return;
          }
        }
      }
    };
    
    this._canvas.addEventListener('click', handleClick);
  }
  
  queryRenderedFeatures(point){
    // Simplified implementation
    return this._features.filter(f => {
      if(f.geometry.type === "Point") {
        const p = this._map._lngLatToPoint(...f.geometry.coordinates);
        const radius = f.properties.radius || 5;
        const distance = Math.sqrt(
          Math.pow(p.x - point.x, 2) + 
          Math.pow(p.y - point.y, 2)
        );
        return distance <= radius;
      }
      return false;
    });
  }
  
  _getUniqueId(){
    return 'feature_' + Math.random().toString(36).substr(2, 9);
  }
  
  setStyle(style){
    this.opt.style = {...this.opt.style, ...style};
    this._update();
    return this;
  }
  
  setData(features){
    this._features = features || [];
    this._featureIndex.clear();
    this._features.forEach((f, i) => {
      const id = f.id || this._getUniqueId();
      f.id = id;
      this._featureIndex.set(id, f);
    });
    this._update();
    return this;
  }
}

// ==========================================
// GeoJSON Layer
// ==========================================
class GeoJSONLayer extends WebGLVectorLayer {
  constructor(geojson, opt={}){
    super(opt);
    this.geojson = geojson;
    this._processGeoJSON();
  }
  
  _processGeoJSON(){
    if(!this.geojson || !this.geojson.features) return;
    
    this.geojson.features.forEach(feature => {
      this.addFeature(feature);
    });
  }
  
  setGeoJSON(geojson){
    this.geojson = geojson;
    this._featureIndex.clear();
    this._features = [];
    this._processGeoJSON();
    this._update();
    return this;
  }
}

// ==========================================
// Heatmap Layer
// ==========================================
class HeatmapLayer extends Layer {
  constructor(opt={}){
    super();
    this.opt = {
      radius: 25,
      blur: 15,
      gradient: {
        0.0: 'blue',
        0.25: 'lime',
        0.5: 'yellow',
        0.75: 'orange',
        1.0: 'red'
      },
      minOpacity: 0.05,
      max: 1.0,
      ...opt
    };
    this._data = [];
    this._canvas = null;
    this._ctx = null;
  }
  
  onAdd(map){
    super.onAdd(map);
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'atlas-heatmap';
    this._canvas.style.cssText = 'position:absolute;left:0;top:0;';
    map._canvasContainer.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');
    map.on('move', () => this._redraw());
    this._redraw();
  }
  
  onRemove(){
    if(this._canvas) {
      this._canvas.remove();
    }
    super.onRemove();
  }
  
  addData(point){
    this._data.push(point);
    this._redraw();
    return this;
  }
  
  setData(points){
    this._data = points || [];
    this._redraw();
    return this;
  }
  
  _redraw(){
    if(!this._ctx || !this._map) return;
    
    const canvas = this._canvas;
    const ctx = this._ctx;
    
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    if(this._data.length === 0) return;
    
    // Create intensity map
    const intensityMap = new Uint8ClampedArray(canvas.clientWidth * canvas.clientHeight);
    const radius = this.opt.radius;
    
    this._data.forEach(point => {
      const p = this._map._lngLatToPoint(point[0], point[1]);
      const value = point[2] || 1;
      
      // Simple intensity distribution (could be optimized)
      for(let y = Math.max(0, p.y - radius); y < Math.min(canvas.clientHeight, p.y + radius); y++) {
        for(let x = Math.max(0, p.x - radius); x < Math.min(canvas.clientWidth, p.x + radius); x++) {
          const dx = x - p.x;
          const dy = y - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if(distance <= radius) {
            const intensity = value * (1 - distance / radius);
            const index = y * canvas.clientWidth + x;
            intensityMap[index] = Math.min(255, intensityMap[index] + intensity * 255);
          }
        }
      }
    });
    
    // Create gradient
    const gradientCanvas = document.createElement('canvas');
    const gradientCtx = gradientCanvas.getContext('2d');
    gradientCanvas.width = 1;
    gradientCanvas.height = 256;
    
    const gradient = gradientCtx.createLinearGradient(0, 0, 0, 256);
    Object.keys(this.opt.gradient).forEach(key => {
      gradient.addColorStop(parseFloat(key), this.opt.gradient[key]);
    });
    
    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, 1, 256);
    
    const gradientPixels = gradientCtx.getImageData(0, 0, 1, 256).data;
    
    // Apply gradient to intensity map
    const imageData = ctx.createImageData(canvas.clientWidth, canvas.clientHeight);
    const data = imageData.data;
    
    for(let i = 0; i < intensityMap.length; i++) {
      const intensity = intensityMap[i];
      if(intensity > 0) {
        const alpha = Math.min(255, intensity * (255 / this.opt.max));
        if(alpha > this.opt.minOpacity * 255) {
          const gradientIndex = Math.min(255, Math.floor(intensity / 255 * 255)) * 4;
          data[i * 4] = gradientPixels[gradientIndex];       // R
          data[i * 4 + 1] = gradientPixels[gradientIndex + 1]; // G
          data[i * 4 + 2] = gradientPixels[gradientIndex + 2]; // B
          data[i * 4 + 3] = alpha; // A
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
}

// ==========================================
// Marker & Popup
// ==========================================
class Marker extends Layer {
  constructor(ll,opt={}){
    super(); 
    this.ll=ll; 
    this.opt={
      icon:'📍',
      draggable: false,
      title: '',
      zIndexOffset: 0,
      ...opt
    }; 
    this._onMove=()=>this._update(); 
  }
  
  onAdd(m){ 
    super.onAdd(m);
    this.el=document.createElement('div'); 
    this.el.className='atlas-marker'; 
    this.el.textContent=this.opt.icon;
    if(this.opt.title) this.el.title = this.opt.title;
    
    // Set z-index
    this.el.style.zIndex = 1000 + this.opt.zIndexOffset;
    
    m._canvasContainer.appendChild(this.el); 
    m.on('move',this._onMove); 
    this._update();
    
    if(this.opt.draggable) {
      this._setupDragging();
    }
  }
  
  onRemove(){
    this.el.remove();
    this._map.off('move',this._onMove);
    super.onRemove();
  }
  
  _update(){
    const p=this._map._lngLatToPoint(...this.ll); 
    this.el.style.left=p.x+"px"; 
    this.el.style.top=p.y+"px"; 
  }
  
  setLatLng(ll){
    this.ll = ll;
    if(this._map) this._update();
    return this;
  }
  
  getLatLng(){ return [...this.ll]; }
  
  setIcon(icon){
    this.opt.icon = icon;
    if(this.el) this.el.textContent = icon;
    return this;
  }
  
  _setupDragging(){
    let isDragging = false;
    let startX, startY;
    let startLng, startLat;
    
    const startDrag = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLng = this.ll[0];
      startLat = this.ll[1];
      this.el.style.cursor = 'grabbing';
      this.emit('dragstart', {latlng: this.ll});
      e.preventDefault();
    };
    
    const doDrag = (e) => {
      if(!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      const newPoint = this._map._lngLatToPoint(startLng, startLat);
      newPoint.x += dx;
      newPoint.y += dy;
      
      const newLatLng = this._map._pointToLngLat(newPoint.x, newPoint.y);
      this.setLatLng(newLatLng);
      this.emit('drag', {latlng: newLatLng});
    };
    
    const endDrag = () => {
      if(isDragging) {
        isDragging = false;
        this.el.style.cursor = 'grab';
        this.emit('dragend', {latlng: this.ll});
      }
    };
    
    this.el.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);
  }
  
  togglePopup(){
    if(this._popup && this._map.hasLayer(this._popup)) {
      this.closePopup();
    } else {
      this.openPopup();
    }
    return this;
  }
  
  bindPopup(content, options){
    if(this._popup) {
      this._popup.remove();
    }
    
    this._popup = new Popup(options).setContent(content);
    return this;
  }
  
  openPopup(){
    if(!this._popup || !this._map) return this;
    
    this._popup.setLngLat(this.ll);
    this._map.addLayer(this._popup);
    this.emit('popupopen', {popup: this._popup});
    return this;
  }
  
  closePopup(){
    if(!this._popup || !this._map) return this;
    
    this._map.removeLayer(this._popup);
    this.emit('popupclose', {popup: this._popup});
    return this;
  }
}

class Popup extends Layer {
  constructor(opt={}){
    super(); 
    this.opt={
      closeButton: true,
      autoClose: true,
      closeOnClick: false,
      className: '',
      ...opt
    }; 
    this._onMove=()=>this._update(); 
  }
  
  setLngLat(ll){
    this.ll=ll;
    this._update();
    return this;
  }
  
  setHTML(h){
    this.html=h; 
    if(this.el) this.el.querySelector('.atlas-popup-content').innerHTML=h;
    return this;
  }
  
  setContent(content){
    return this.setHTML(content);
  }
  
  openOn(map){
    map.addLayer(this);
    return this;
  }
  
  close(){
    if(this._map) this._map.removeLayer(this);
    return this;
  }
  
  onAdd(m){ 
    super.onAdd(m);
    this.el=document.createElement('div'); 
    this.el.className='atlas-popup ' + (this.opt.className || '');
    const c=document.createElement('div');
    c.className='atlas-popup-content';
    c.innerHTML=this.html||''; 
    this.el.appendChild(c);
    
    if(this.opt.closeButton){
      const b=document.createElement('button');
      b.className='atlas-popup-close-button';
      b.textContent='×';
      b.onclick=()=>this.close();
      this.el.appendChild(b);
    }
    
    m._canvasContainer.appendChild(this.el); 
    m.on('move',this._onMove); 
    this._update();
    
    if(this.opt.closeOnClick) {
      m.on('click', () => this.close());
    }
    
    this.emit('add');
  }
  
  onRemove(){
    this.el.remove();
    this._map.off('move',this._onMove);
    if(this.opt.closeOnClick) {
      this._map.off('click', () => this.close());
    }
    this.emit('remove');
    super.onRemove();
  }
  
  _update(){ 
    if(!this._map||!this.ll)return; 
    const p=this._map._lngLatToPoint(...this.ll),w=this._map.container.clientWidth;
    if(p.x<40)this.el.style.transform="translate(0,-100%)"; 
    else if(p.x>w-40)this.el.style.transform="translate(-100%,-100%)";
    else this.el.style.transform="translate(-50%,-100%)"; 
    this.el.style.left=p.x+"px"; 
    this.el.style.top=p.y+"px"; 
  }
}

// ==========================================
// Built-in Controls
// ==========================================
class ZoomControl extends Control {
  constructor(opt={}){
    super(opt.position || 'top-right');
    this.opt = {
      zoomInText: '+',
      zoomOutText: '−',
      zoomInTitle: 'Zoom in',
      zoomOutTitle: 'Zoom out',
      ...opt
    };
  }
  
  onAdd(map){
    super.onAdd(map);
    
    const container = this.el;
    container.className = 'atlas-control atlas-zoom';
    
    const createButton = (html, title, className) => {
      const button = document.createElement('button');
      button.className = className;
      button.innerHTML = html;
      button.title = title;
      return button;
    };
    
    const zoomInButton = createButton(
      this.opt.zoomInText, 
      this.opt.zoomInTitle, 
      'atlas-control-zoom-in'
    );
    
    const zoomOutButton = createButton(
      this.opt.zoomOutText, 
      this.opt.zoomOutTitle, 
      'atlas-control-zoom-out'
    );
    
    zoomInButton.onclick = () => map.zoomIn();
    zoomOutButton.onclick = () => map.zoomOut();
    
    container.appendChild(zoomInButton);
    container.appendChild(zoomOutButton);
    
    return this;
  }
}

class AttributionControl extends Control {
  constructor(opt={}){
    super(opt.position || 'bottom-right');
    this.opt = {
      prefix: 'Atlas.js',
      ...opt
    };
    this._attributions = new Set();
  }
  
  onAdd(map){
    super.onAdd(map);
    
    const container = this.el;
    container.className = 'atlas-control atlas-attribution';
    
    const prefix = document.createElement('span');
    prefix.className = 'atlas-attribution-prefix';
    prefix.innerHTML = this.opt.prefix;
    
    const attributions = document.createElement('span');
    attributions.className = 'atlas-attribution-text';
    
    container.appendChild(prefix);
    container.appendChild(attributions);
    
    this._update();
    
    return this;
  }
  
  addAttribution(text){
    if(!this._attributions) this._attributions = new Set();
    this._attributions.add(text);
    this._update();
    return this;
  }
  
  removeAttribution(text){
    if(this._attributions) {
      this._attributions.delete(text);
      this._update();
    }
    return this;
  }
  
  _update(){
    if(!this._map || !this._attributions) return;
    
    const text = Array.from(this._attributions).join(' | ');
    this.el.querySelector('.atlas-attribution-text').innerHTML = text ? ` | ${text}` : '';
  }
}

class ScaleControl extends Control {
  constructor(opt={}){
    super(opt.position || 'bottom-left');
    this.opt = {
      maxWidth: 100,
      metric: true,
      imperial: true,
      updateWhenIdle: false,
      ...opt
    };
  }
  
  onAdd(map){
    super.onAdd(map);
    
    const container = this.el;
    container.className = 'atlas-control atlas-scale';
    
    this._scale = document.createElement('div');
    this._scale.className = 'atlas-scale-line';
    container.appendChild(this._scale);
    
    map.on('move', () => {
      if(!this.opt.updateWhenIdle || !map._moving) {
        this._updateScale();
      }
    });
    
    this._updateScale();
    
    return this;
  }
  
  _updateScale(){
    if(!this._map) return;
    
    const map = this._map;
    const centerLatLng = map.getCenter();
    const halfWidth = map.container.clientWidth / 2;
    const leftLatLng = map._pointToLngLat(halfWidth - this.opt.maxWidth / 2, map.container.clientHeight / 2);
    const rightLatLng = map._pointToLngLat(halfWidth + this.opt.maxWidth / 2, map.container.clientHeight / 2);
    
    const metersPerPixel = distance(
      [leftLatLng[0], leftLatLng[1]], 
      [rightLatLng[0], rightLatLng[1]]
    ) / this.opt.maxWidth;
    
    const feetPerPixel = metersPerPixel * 3.28084;
    
    let scaleText = '';
    
    if(this.opt.metric) {
      let meters = metersPerPixel * this.opt.maxWidth;
      let scaleMeters = meters;
      let unit = 'm';
      
      if(meters > 1000) {
        scaleMeters = meters / 1000;
        unit = 'km';
      }
      
      scaleText += `${Math.round(scaleMeters)} ${unit}`;
    }
    
    if(this.opt.imperial) {
      let feet = feetPerPixel * this.opt.maxWidth;
      let scaleFeet = feet;
      let unit = 'ft';
      
      if(feet > 5280) {
        scaleFeet = feet / 5280;
        unit = 'mi';
      }
      
      if(scaleText) scaleText += ' / ';
      scaleText += `${Math.round(scaleFeet)} ${unit}`;
    }
    
    this._scale.textContent = scaleText;
    this._scale.style.width = this.opt.maxWidth + 'px';
  }
}

// ==========================================
// 3D Camera Control
// ==========================================
class Camera3D {
  constructor(map) {
    this.map = map;
    this.pitch = 0; // Rotation around x-axis
    this.bearing = 0; // Rotation around z-axis
    this.zoom = map.getZoom();
    this.center = map.getCenter();
  }
  
  setPitch(pitch) {
    this.pitch = clamp(pitch, 0, 60);
    this.map.emit('pitch');
    return this;
  }
  
  setBearing(bearing) {
    this.bearing = bearing % 360;
    this.map.emit('rotate');
    return this;
  }
  
  setZoom(zoom) {
    this.zoom = clamp(zoom, this.map.opt.minZoom, this.map.opt.maxZoom);
    this.map.setZoom(this.zoom);
    return this;
  }
  
  flyTo(options) {
    // Simplified 3D fly animation
    const startPitch = this.pitch;
    const startBearing = this.bearing;
    const startZoom = this.zoom;
    const startCenter = [...this.center];
    
    const endPitch = options.pitch !== undefined ? options.pitch : startPitch;
    const endBearing = options.bearing !== undefined ? options.bearing : startBearing;
    const endZoom = options.zoom !== undefined ? options.zoom : startZoom;
    const endCenter = options.center || startCenter;
    
    const duration = options.duration || 1000;
    const startTime = now();
    
    const animate = () => {
      const elapsed = now() - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      const ease = easeOutCubic(progress);
      
      this.pitch = startPitch + (endPitch - startPitch) * ease;
      this.bearing = startBearing + (endBearing - startBearing) * ease;
      this.zoom = startZoom + (endZoom - startZoom) * ease;
      this.center = [
        startCenter[0] + (endCenter[0] - startCenter[0]) * ease,
        startCenter[1] + (endCenter[1] - startCenter[1]) * ease
      ];
      
      this.map.setCenter(this.center);
      this.map.setZoom(this.zoom);
      this.map.emit('pitch');
      this.map.emit('rotate');
      
      if(progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.map.emit('moveend');
      }
    };
    
    this.map.emit('movestart');
    animate();
    
    return this;
  }
}

// ==========================================
// Map
// ==========================================
class Map extends Emitter {
  constructor(container,opt={}){
    super(); 
    this.opt={
      center:[0,0],
      zoom:1,
      minZoom:0,
      maxZoom:18,
      crs: CRS.EPSG3857,
      attributionControl: true,
      zoomControl: true,
      scaleControl: false,
      pitch: 0,
      bearing: 0,
      ...opt
    };
    
    this.container=typeof container==="string"?document.querySelector(container):container;
    this._center=[...this.opt.center]; 
    this._zoom=this.opt.zoom; 
    this._canvasContainer=document.createElement('div');
    Object.assign(this._canvasContainer.style,{
      position:'absolute',
      width:'100%',
      height:'100%'
    }); 
    this.container.appendChild(this._canvasContainer);
    this._layers=[];
    this._layerIds = new Map();
    this._controls = [];
    this._moving = false;
    
    // 3D Camera
    this.camera = new Camera3D(this);
    this.camera.pitch = this.opt.pitch;
    this.camera.bearing = this.opt.bearing;
    
    this._setupHandlers(); 
    this._setupTouch(); 
    this._initControls();
  }
  
  _setupHandlers(){ 
    let drag=false,lx=0,ly=0;
    let isMoving = false;
    
    const startMove = () => {
      if(!isMoving) {
        isMoving = true;
        this._moving = true;
        this.emit('movestart');
      }
    };
    
    const endMove = () => {
      if(isMoving) {
        isMoving = false;
        this._moving = false;
        this.emit('moveend');
      }
    };
    
    this.container.addEventListener('mousedown',e=>{
      drag=true;
      lx=e.clientX;
      ly=e.clientY;
      startMove();
    });
    
    window.addEventListener('mousemove',e=>{
      if(drag){
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        
        // Handle rotation with Shift key
        if(e.shiftKey) {
          this.camera.setBearing(this.camera.bearing - dx * 0.5);
          this.camera.setPitch(this.camera.pitch - dy * 0.5);
        } else {
          // Convert pixel movement to geographic movement
          const centerPoint = this._lngLatToPoint(...this._center);
          centerPoint.x -= dx;
          centerPoint.y -= dy;
          const newCenter = this._pointToLngLat(centerPoint.x, centerPoint.y);
          
          this._center = [newCenter[0], newCenter[1]];
          this.emit('move');
        }
        
        lx=e.clientX;
        ly=e.clientY;
      }
    });
    
    window.addEventListener('mouseup',()=>{
      if(drag) {
        drag=false;
        endMove();
      }
    });
    
    this.container.addEventListener('wheel',e=>{
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.5 : 0.5;
      this.setZoom(this._zoom + zoomDelta);
    });
    
    // Click handling
    this.container.addEventListener('click', e => {
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.emit('click', {
        latlng: this._pointToLngLat(x, y),
        containerPoint: {x, y},
        originalEvent: e
      });
    });
  }
  
  _setupTouch(){ 
    let pinch=null,pz=null;
    let initialCenter, initialZoom;
    let rotateStart = false;
    
    this.container.addEventListener('touchstart',e=>{
      if(e.touches.length==2){
        pinch=distance(
          [e.touches[0].clientX,e.touches[0].clientY],
          [e.touches[1].clientX,e.touches[1].clientY]
        );
        pz=this._zoom;
        initialCenter = [...this._center];
        initialZoom = this._zoom;
        this.emit('movestart');
      } else if(e.touches.length == 1) {
        // Check for two-finger rotation
        rotateStart = true;
      }
    });
    
    this.container.addEventListener('touchmove',e=>{
      if(e.touches.length==2&&pinch){
        let d=distance(
          [e.touches[0].clientX,e.touches[0].clientY],
          [e.touches[1].clientX,e.touches[1].clientY]
        );
        this.setZoom(pz+Math.log2(d/pinch));
      }
    });
    
    this.container.addEventListener('touchend',()=>{
      if(pinch) {
        pinch=null;
        this.emit('moveend');
      }
      rotateStart = false;
    });
  }
  
  _initControls(){
    if(this.opt.attributionControl) {
      this.attributionControl = new AttributionControl();
      this.addControl(this.attributionControl);
    }
    
    if(this.opt.zoomControl) {
      this.addControl(new ZoomControl());
    }
    
    if(this.opt.scaleControl) {
      this.addControl(new ScaleControl());
    }
  }
  
  _lngLatToPoint(lng,lat){
    const c=project(this._center[0],this._center[1],this._zoom,256,this.opt.crs),
          p=project(lng,lat,this._zoom,256,this.opt.crs);
    return {
      x:this.container.clientWidth/2+(p.x-c.x), 
      y:this.container.clientHeight/2+(p.y-c.y)
    };
  }
  
  _pointToLngLat(x,y){
    const c=project(...this._center,this._zoom,256,this.opt.crs),
          px=c.x+(x-this.container.clientWidth/2),
          py=c.y+(y-this.container.clientHeight/2);
    return unproject(px,py,this._zoom,256,this.opt.crs);
  }
  
  setCenter(c){
    this._center=[normalizeLng(c[0]),clamp(c[1],-85,85)];
    this.emit('move');
    return this;
  }
  
  setZoom(z){
    const oldZoom = this._zoom;
    this._zoom=clamp(z,this.opt.minZoom,this.opt.maxZoom);
    if(oldZoom !== this._zoom) {
      this.emit('zoom');
      this.emit('move');
    }
    return this;
  }
  
  zoomIn(){return this.setZoom(this._zoom+1);}
  zoomOut(){return this.setZoom(this._zoom-1);}
  
  setView(center, zoom){
    if(center) this.setCenter(center);
    if(zoom !== undefined) this.setZoom(zoom);
    return this;
  }
  
  getCenter(){ return [...this._center]; }
  getZoom(){ return this._zoom; }
  getBounds(){
    const container = this.container;
    const sw = this._pointToLngLat(0, container.clientHeight);
    const ne = this._pointToLngLat(container.clientWidth, 0);
    return new LatLngBounds(sw, ne);
  }
  
  // 3D Methods
  setPitch(pitch){
    this.camera.setPitch(pitch);
    return this;
  }
  
  setBearing(bearing){
    this.camera.setBearing(bearing);
    return this;
  }
  
  getPitch(){ return this.camera.pitch; }
  getBearing(){ return this.camera.bearing; }
  
  flyTo(options){
    this.camera.flyTo(options);
    return this;
  }
  
  fitBounds(bounds, opt={}){
    const padding = opt.padding || 0;
    const maxZoom = opt.maxZoom || this.opt.maxZoom;
    
    if(!bounds.isValid()) return this;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const center = bounds.getCenter();
    
    // Calculate zoom level to fit bounds
    const container = this.container;
    const boundsSize = {
      x: Math.abs(ne[0] - sw[0]),
      y: Math.abs(ne[1] - sw[1])
    };
    
    // Simplified zoom calculation
    const zoomX = Math.log2(container.clientWidth / (boundsSize.x * 256 / 360));
    const zoomY = Math.log2(container.clientHeight / (boundsSize.y * 256 / 180));
    const zoom = Math.min(zoomX, zoomY, maxZoom);
    
    return this.setView(center, zoom);
  }
  
  panTo(latlng, opt={}){
    return this.setView(latlng);
  }
  
  panBy(offset, opt={}){
    // Convert offset pixels to geographic coordinates
    const centerPoint = this._lngLatToPoint(...this._center);
    centerPoint.x += offset[0];
    centerPoint.y += offset[1];
    const newCenter = this._pointToLngLat(centerPoint.x, centerPoint.y);
    return this.setCenter(newCenter);
  }
  
  addLayer(l,id,before=null){
    if(id) this._layerIds.set(id, l);
    this._layers.push(l);
    l.onAdd(this);
    return this;
  }
  
  removeLayer(layerOrId){
    let layer;
    if(typeof layerOrId === 'string') {
      layer = this._layerIds.get(layerOrId);
      this._layerIds.delete(layerOrId);
    } else {
      layer = layerOrId;
    }
    
    if(layer) {
      layer.onRemove();
      const index = this._layers.indexOf(layer);
      if(index > -1) this._layers.splice(index, 1);
    }
    return this;
  }
  
  hasLayer(layerOrId){
    if(typeof layerOrId === 'string') {
      return this._layerIds.has(layerOrId);
    }
    return this._layers.includes(layerOrId);
  }
  
  getLayer(id){ return this._layerIds.get(id); }
  getLayers(){ return [...this._layers]; }
  
  addControl(control){
    this._controls.push(control);
    control.onAdd(this);
    
    // Position control
    const pos = control.position;
    let container;
    
    if(pos.includes('top')) {
      container = this.container.querySelector('.atlas-top') || 
                  this._createControlContainer('top');
    } else {
      container = this.container.querySelector('.atlas-bottom') || 
                  this._createControlContainer('bottom');
    }
    
    if(pos.includes('left')) {
      container.insertBefore(control.getElement(), container.firstChild);
    } else {
      container.appendChild(control.getElement());
    }
    
    return this;
  }
  
  removeControl(control){
    const index = this._controls.indexOf(control);
    if(index > -1) {
      this._controls.splice(index, 1);
      control.onRemove();
      control.getElement().remove();
    }
    return this;
  }
  
  _createControlContainer(pos){
    const container = document.createElement('div');
    container.className = `atlas-control-container atlas-${pos}`;
    Object.assign(container.style, {
      position: 'absolute',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px'
    });
    
    if(pos === 'top') {
      container.style.top = 0;
    } else {
      container.style.bottom = 0;
    }
    
    this.container.appendChild(container);
    return container;
  }
  
  destroy(){
    // Clean up all layers
    [...this._layers].forEach(layer => this.removeLayer(layer));
    
    // Clean up controls
    [...this._controls].forEach(control => this.removeControl(control));
    
    // Remove event listeners
    // (In a real implementation, you'd need to track and remove them)
    
    // Remove DOM elements
    this._canvasContainer.remove();
    
    // Clear references
    this._layers = [];
    this._layerIds.clear();
    this._controls = [];
  }
  
  // New methods in v0.4
  getContainer(){ return this.container; }
  getSize(){ return {x: this.container.clientWidth, y: this.container.clientHeight}; }
  getPixelBounds(){
    const size = this.getSize();
    return {
      min: {x: 0, y: 0},
      max: {x: size.x, y: size.y}
    };
  }
  
  containerPointToLatLng(point){
    return this._pointToLngLat(point.x, point.y);
  }
  
  latLngToContainerPoint(latlng){
    return this._lngLatToPoint(latlng[0], latlng[1]);
  }
  
  project(latlng, zoom){
    return project(latlng[0], latlng[1], zoom !== undefined ? zoom : this._zoom, 256, this.opt.crs);
  }
  
  unproject(point, zoom){
    return unproject(point.x, point.y, zoom !== undefined ? zoom : this._zoom, 256, this.opt.crs);
  }
  
  distance(latlng1, latlng2){
    return distance(
      this.project(latlng1), 
      this.project(latlng2)
    ) * CIRC / Math.pow(2, this._zoom + 8);
  }
  
  getScaleZoom(scale, fromZoom){
    const zoom = fromZoom !== undefined ? fromZoom : this._zoom;
    return zoom + Math.log(scale) / Math.LN2;
  }
  
  getZoomScale(toZoom, fromZoom){
    const zoom = fromZoom !== undefined ? fromZoom : this._zoom;
    return Math.pow(2, toZoom - zoom);
  }
}

// ==========================================
// Styles
// ==========================================
function injectStyles(){ 
  if(document.getElementById('atlas-css'))return;
  const css=`
    .atlas-marker{
      position:absolute;
      transform:translate(-50%,-100%);
      cursor: grab;
      user-select: none;
      font-size: 24px;
      z-index: 1000;
    }
    
    .atlas-popup{
      position:absolute;
      background:white;
      padding:8px;
      border-radius:4px;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      pointer-events: auto;
      min-width: 100px;
      z-index: 1100;
    }
    
    .atlas-popup-content{
      margin: 0 16px 0 0;
    }
    
    .atlas-popup-close-button{
      position: absolute;
      top: 0;
      right: 0;
      padding: 4px 4px 0 0;
      border: none;
      text-align: center;
      width: 18px;
      height: 14px;
      font: 16px/14px Tahoma, Verdana, sans-serif;
      color: #c3c3c3;
      text-decoration: none;
      font-weight: bold;
      background: transparent;
      cursor: pointer;
    }
    
    .atlas-control-container{
      z-index: 1000;
    }
    
    .atlas-control{
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.2);
      padding: 2px;
    }
    
    .atlas-control button{
      background: none;
      border: 0;
      border-bottom: 1px solid #ddd;
      width: 26px;
      height: 26px;
      line-height: 26px;
      display: block;
      text-align: center;
      text-decoration: none;
      color: black;
      cursor: pointer;
    }
    
    .atlas-control button:last-child{
      border-bottom: none;
    }
    
    .atlas-control button:hover{
      background-color: #f4f4f4;
    }
    
    .atlas-attribution{
      background: rgba(255, 255, 255, 0.7);
      padding: 0 5px;
      margin: 0;
      font-size: 11px;
    }
    
    .atlas-scale-line {
      padding: 2px 5px 1px;
      font-size: 11px;
      text-align: center;
      border: 2px solid #777;
      border-top: none;
      line-height: 1.1;
      color: #555;
      background-color: rgba(255, 255, 255, 0.8);
    }
    
    .atlas-heatmap {
      opacity: 0.8;
    }
    
    .atlas-terrain, .atlas-buildings, .atlas-webgl-vector {
      pointer-events: none;
    }
  `;
  const s=document.createElement('style');
  s.id='atlas-css';
  s.textContent=css;
  document.head.appendChild(s);
}

if(typeof document!=="undefined")injectStyles();

// ==========================================
// Export
// ==========================================
const Atlas={
  Map,
  TileLayer,
  WebGLVectorLayer,
  GeoJSONLayer,
  HeatmapLayer,
  TerrainLayer,
  BuildingLayer,
  Marker,
  Popup,
  LayerGroup,
  Control,
  ZoomControl,
  AttributionControl,
  ScaleControl,
  Camera3D,
  CRS,
  LatLngBounds,
  Vec3,
  Mat4,
  utils:{
    project,
    unproject,
    clamp,
    wrap,
    normalizeLng,
    easeOutCubic,
    distance
  }
};

if(typeof module!=="undefined")module.exports=Atlas;
else window.Atlas=Atlas;
