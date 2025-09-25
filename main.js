import { Atlas } from './src/core/Atlas.js';
import { AtlasMarker } from './src/core/AtlasMarker.js';
import { TileLayer } from './src/layers/TileLayer.js';
import { LAYERS, DEFAULT_CONFIG } from './src/utils/constants.js';

// expose Atlas, AtlasMarker, and AtlasPopup to window
window.Atlas = Atlas;
window.AtlasMarker = AtlasMarker;

// Auto-init if #map exists
if (document.getElementById('map')) {
  const atlas = new Atlas('map', { debug: DEFAULT_CONFIG.debug });
  const layerConfig = LAYERS.OSM;
  const urlTemplate = layerConfig.tileServers[0];
  const osmLayer = new TileLayer(urlTemplate, layerConfig);
  atlas.setBaseLayer(osmLayer);
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