import { Handler } from './Handler.js';
import { SNAP_DURATION, DEG2RAD, LAYERS } from '../utils/constants.js';
import { GISUtils } from '../utils/gis.js';
import { TileLayer } from '../layers/TileLayer.js';

// Keyboard pan and shortcuts
export class KeyboardPanHandler extends Handler {
  constructor(map) { super(map); }
  _addEvents() {
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return;
    this._addDomListener(window, 'keydown', this._onKeyDown = this._onKeyDown.bind(this), { passive: true });
  }
  _removeEvents() { this._removeAllDomListeners(); }
  _onKeyDown(e) {
    let dx = 0, dy = 0;
    const step = 1;
    if (e.key === "ArrowUp") dy = step;
    else if (e.key === "ArrowDown") dy = -step;
    else if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key.toLowerCase() === "n") { const w = this._map.canvas.width / this._map.dpr, h = this._map.canvas.height / this._map.dpr; this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION); return; }
    else if (e.key === "r") { this._map.setBearing(this._map.getBearing() + DEG2RAD * 15); return; }
    else if (e.key === "l") { this._map.setBearing(this._map.getBearing() - DEG2RAD * 15); return; }
    else if (e.key === "s") {
      const current = this._map.getBaseLayer();
      let nextLayerKey;
      if (!current || current.urlTemplate.includes('openstreetmap')) nextLayerKey = 'ESRI';
      else if (current.urlTemplate.includes('World_Imagery')) nextLayerKey = 'ESRI_TOPO';
      else nextLayerKey = 'OSM';
      const layerConfig = LAYERS[nextLayerKey];
      if (layerConfig) {
        const finalUrl = layerConfig.tileServers[0];
        const newLayer = new TileLayer(finalUrl, {
          minZoom: layerConfig.minZoom,
          maxZoom: layerConfig.maxZoom,
          attribution: layerConfig.attribution,
          background: layerConfig.background,
          supportsRetina: layerConfig.supportsRetina,
          maxCacheSize: layerConfig.maxCacheSize
        });
        this._map.setBaseLayer(newLayer);
      }
      return;
    } else if (e.key === "+" || e.key === "=") { this._map.stopAnimations(); this._map.setZoom(this._map.getZoom() + 1); return; }
    else if (e.key === "-") { this._map.stopAnimations(); this._map.setZoom(this._map.getZoom() - 1); return; }
    if (dx !== 0 || dy !== 0) { this._map.stopAnimations(); this._map.center = { lat: GISUtils.clampLatitude(this._map.getCenter().lat + dy), lon: GISUtils.wrapLongitude(this._map.getCenter().lon + dx) }; this._map.render(); }
  }
}