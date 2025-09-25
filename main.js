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

  const marker2 = new AtlasMarker({ lat: 34.0522, lon: -118.2437 }, {
    title: 'Los Angeles',
    draggable: true,
    color: '#00a86b'
  }).addTo(atlas);
  marker2.bindPopup(`
    <h3>Los Angeles</h3>
    <p>The City of Angels</p>
    <p>Population: 3.9 million</p>
  `);

  const marker3 = new AtlasMarker({ lat: 41.8781, lon: -87.6298 }, {
    title: 'Chicago',
    draggable: true,
    icon: 'https://cdn-icons-png.flaticon.com/512/25/25231.png',
    iconSize: [32, 32]
  }).addTo(atlas);
  marker3.bindPopup(`
    <h3>Chicago</h3>
    <p>The Windy City</p>
    <p>Population: 2.7 million</p>
  `);
}