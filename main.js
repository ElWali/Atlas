import { Atlas } from './src/core/Atlas.js';
import { AtlasMarker } from './src/core/AtlasMarker.js';
import { TileLayer } from './src/layers/TileLayer.js';
import { LayerControl } from './src/controls/LayerControl.js';
import { Polygon } from './src/layers/vector/Polygon.js';
import { LAYERS, DEFAULT_CONFIG } from './src/utils/constants.js';

// expose Atlas, AtlasMarker, and AtlasPopup to window
window.Atlas = Atlas;
window.AtlasMarker = AtlasMarker;

// Auto-init if #map exists
if (document.getElementById('map')) {
  const atlas = new Atlas('map', { debug: DEFAULT_CONFIG.debug });
  const osmLayer = new TileLayer(LAYERS.OSM.tileServers[0], LAYERS.OSM);
  const esriLayer = new TileLayer(LAYERS.ESRI.tileServers[0], LAYERS.ESRI);

  const baseLayers = {
    "OpenStreetMap": osmLayer,
    "Esri Satellite": esriLayer
  };

  const polygon = new Polygon([
    [40.7128, -74.0060],
    [34.0522, -118.2437],
    [41.8781, -87.6298]
  ], { color: 'red', weight: 2 });

  const overlays = {
    "Example Polygon": polygon
  };

  atlas.setBaseLayer(osmLayer);
  atlas.addLayer(polygon);

  const layerControl = new LayerControl(baseLayers, overlays).addTo(atlas);

  polygon.bindTooltip("I am a polygon.");

  // Example: Add a marker with popup
  const marker = new AtlasMarker({ lat: 40.7128, lon: -74.0060 }, {
    title: 'New York City',
    draggable: true
  }).addTo(atlas);
  marker.bindPopup(`
    <h3>New York City</h3>
    <p>The City That Never Sleeps</p>
    <p>Population: 8.4 million</p>
  `).openPopup();
}