// Constants & helpers
export const EARTH_RADIUS = 6378137;
export const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;
export const MAX_LATITUDE = 85.05112878;
export const MIN_LATITUDE = -85.05112878;
export const TILE_SIZE = 256;
export const TILE_TTL = 86400000;
export const TILE_LOAD_TIMEOUT_MS = 8000;
export const INERTIA_DECEL = 0.0025;
export const INERTIA_STOP_SPEED = 0.02;
export const VELOCITY_WINDOW_MS = 120;
export const DOUBLE_TAP_MAX_DELAY = 300;
export const DOUBLE_TAP_MAX_MOVE = 16;
export const TWO_FINGER_TAP_MAX_DELAY = 250;
export const TWO_FINGER_TAP_MOVE_THRESH = 5;
export const ROTATE_MOVE_THRESH_RAD = 0.05;
export const WHEEL_ZOOM_STEP = 0.25;
export const WHEEL_ZOOM_DURATION = 220;
export const TAP_ZOOM_DURATION = 280;
export const SNAP_DURATION = 300;
export const FLYTO_DURATION = 800;
export const LAYERS = {
  OSM: {
    name: "OpenStreetMap",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    background: "#e6e6e6", supportsRetina: true, maxCacheSize: 800
  },
  ESRI: {
    name: "Esri Satellite",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: 'Tiles © <a href="https://services.arcgisonline.com">Esri</a>',
    background: "#000", supportsRetina: false, maxCacheSize: 600
  },
  ESRI_TOPO: {
    name: "Esri Topographic",
    minZoom: 0, maxZoom: 19,
    tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
    attribution: 'Tiles © <a href="https://services.arcgisonline.com">Esri</a>',
    background: "#f5f5f0", supportsRetina: false, maxCacheSize: 600
  }
};
export const DEFAULT_CONFIG = {
  defaultLayer: "OSM",
  defaultCenter: { lon: 0, lat: 0 },
  defaultZoom: 3,
  debug: new URLSearchParams(window.location.search).has('debug')
};
export const EASING = {
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  linear: t => t
};
export const RAD2DEG = 180 / Math.PI;
export const DEG2RAD = Math.PI / 180;
export function normalizeAngle(rad) { return Math.atan2(Math.sin(rad), Math.cos(rad)); }
export function shortestAngleDiff(from, to) { return normalizeAngle(to - from); }
export function wrapDeltaLon(delta) { delta = ((delta + 180) % 360 + 360) % 360 - 180; return delta; }
export function rot(x, y, ang) { const c = Math.cos(ang), s = Math.sin(ang); return { x: x * c - y * s, y: x * s + y * c }; }