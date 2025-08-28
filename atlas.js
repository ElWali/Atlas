// === Initialize Map ===
const map = L.map('map').setView([20, 0], 2);

// === ESRI World Imagery (Single Base Layer) ===
const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
  {
    maxZoom: 18,
    attribution: 'Tiles © Esri &mdash; Sources: Esri, Earthstar Geographics, GIS User Community'
  }
).addTo(map);

// === Popup/Highlight Function ===
function styleAndPopup(layer, feature) {
  const name = feature.properties.NAME || feature.properties.name || 'Unnamed';
  const altNames = feature.properties.NAMEALT || feature.properties.NAME_EN || 'None';
  const type = feature.properties.FEATURECLA || feature.properties.TYPE || 'Geographic Feature';
  let popupContent = `<strong>${name}</strong><br><em>${type}</em>`;
  if (feature.properties.ELEV) popupContent += `<br>Elevation: ${feature.properties.ELEV} m`;
  layer.bindPopup(popupContent);

  layer.on('mouseover', () => {
    layer.setStyle({ weight: 3, color: 'yellow' });
  });
  layer.on('mouseout', () => {
    riversLayer.resetStyle(layer);
    lakesLayer.resetStyle(layer);
  });
}

// === Overlay Layers ===
let settlementsLayer, riversLayer, lakesLayer, peaksLayer;

// Settlements
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson')
  .then(res => res.json())
  .then(data => {
    settlementsLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 4, color: '#e6550d', fillColor: '#ff7f0e', fillOpacity: 0.8
      }),
      onEachFeature: styleAndPopup
    });
    layersControl.addOverlay(settlementsLayer, 'Settlements');
  });

// Rivers
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson')
  .then(res => res.json())
  .then(data => {
    const riversOnly = { type: 'FeatureCollection', features: data.features.filter(f => f.properties.TYPE !== 'Lake') };
    riversLayer = L.geoJSON(riversOnly, {
      style: { color: '#1f78b4', weight: 1.5 },
      onEachFeature: styleAndPopup
    });
    layersControl.addOverlay(riversLayer, 'Rivers');
  });

// Lakes
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson')
  .then(res => res.json())
  .then(data => {
    lakesLayer = L.geoJSON(data, {
      style: { color: '#3182bd', weight: 1, fillOpacity: 0.4, fillColor: '#3182bd' },
      onEachFeature: styleAndPopup
    });
    layersControl.addOverlay(lakesLayer, 'Lakes');
  });

// Peaks
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_regions_elevation_points.geojson')
  .then(res => res.json())
  .then(data => {
    peaksLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 5, color: '#8b4513', fillColor: '#a0522d', fillOpacity: 0.9
      }),
      onEachFeature: styleAndPopup
    });
    layersControl.addOverlay(peaksLayer, 'Peaks & Mountains');
  });

// === Controls ===
// Overlay toggle
const layersControl = L.control.layers({}, {}, { position: 'topright' }).addTo(map);

// Scale
L.control.scale().addTo(map);

// Coordinates on move
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

// Legend
const legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML =
    `<h4>Legend</h4>
    <div><span style="background:#ff7f0e"></span> Settlements</div>
    <div><span style="background:#1f78b4"></span> Rivers</div>
    <div><span style="background:#3182bd"></span> Lakes</div>
    <div><span style="background:#a0522d"></span> Peaks</div>`;
  return div;
};
legend.addTo(map);

// Geocoder search
L.Control.geocoder({
  defaultMarkGeocode: true
}).addTo(map);
