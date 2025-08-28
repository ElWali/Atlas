// === Initialize Map ===
const map = L.map('map').setView([20, 0], 2);

// === ESRI World Imagery (Single Base) ===
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
  {
    maxZoom: 18,
    attribution: 'Tiles © Esri &mdash; Sources: Esri, Earthstar Geographics, GIS User Community'
  }
).addTo(map);

// === Controls ===

// Scale bar
L.control.scale().addTo(map);

// Coordinates display
const info = L.control();
info.onAdd = function () {
  this._div = L.DomUtil.create('div', 'info');
  this.update();
  return this._div;
};
info.update = function (latlng) {
  this._div.innerHTML = latlng 
    ? `Lat: ${latlng.lat.toFixed(2)}, Lng: ${latlng.lng.toFixed(2)}`
    : 'Hover map for coordinates';
};
info.addTo(map);
map.on('mousemove', e => info.update(e.latlng));

// Geocoder search (find places by name)
L.Control.geocoder({
  defaultMarkGeocode: true
}).addTo(map);
