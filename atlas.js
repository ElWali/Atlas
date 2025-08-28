// === Initialize Map ===
const map = L.map('map').setView([0, 0], 2);

// === Base Layers (No Political Borders) ===

// ESRI World Imagery
const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
  {
    maxZoom: 18,
    attribution: 'Tiles © Esri &mdash; Sources: Esri, Earthstar Geographics, GIS User Community'
  }
);

// NASA (True Color, more stable endpoint via GIBS)
const nasaLayer = L.tileLayer(
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CorrectedReflectance_TrueColor/default/{time}/{tileMatrixSet}/{z}/{y}/{x}.jpg',
  {
    maxZoom: 8,
    time: '',  // today’s default image
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    attribution: 'Imagery courtesy NASA/GSFC GIBS & LP DAAC'
  }
);

// Add ESRI imagery as default
satelliteLayer.addTo(map);

// === Layers Control ===
const layersControl = L.control.layers(
  {
    'Satellite (ESRI)': satelliteLayer,
    'NASA True Color': nasaLayer
  },
  {},
  { position: 'topright' }
).addTo(map);

// === Project Attribution ===
map.attributionControl.addAttribution(
  'Atlas: A Borderless Atlas of Earth — exploring nature and shared landscapes.'
);

// === Popup Function ===
function styleAndPopup(layer, feature) {
  const name = feature.properties.NAME || feature.properties.name || 'Unnamed';
  const altNames = feature.properties.NAMEALT || feature.properties.NAME_EN || 'None';
  const type = feature.properties.FEATURECLA || feature.properties.TYPE || feature.properties.type || 'Geographic Feature';

  let popupContent = `
    <strong>Name:</strong> ${name}<br>
    <strong>Also Known As:</strong> ${altNames}<br>
    <strong>Feature Type:</strong> ${type}
  `;

  if (feature.properties.ELEV) {
    popupContent += `<br><strong>Elevation:</strong> ${feature.properties.ELEV} m`;
  }

  layer.bindPopup(popupContent);
}

// === Settlements ===
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson')
  .then(res => res.json())
  .then(data => {
    const settlementsLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 4,
        color: '#ff7800',
        weight: 1,
        fillColor: '#ff7800',
        fillOpacity: 0.8
      }),
      onEachFeature: styleAndPopup
    });
    settlementsLayer.addTo(map);
    layersControl.addOverlay(settlementsLayer, 'Settlements');
  })
  .catch(err => console.error('Failed to load settlements:', err));

// === Rivers ===
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson')
  .then(res => res.json())
  .then(data => {
    const rivers = {
      type: 'FeatureCollection',
      features: data.features.filter(f => f.properties.TYPE !== 'Lake')
    };
    const riversLayer = L.geoJSON(rivers, {
      style: { color: '#1e90ff', weight: 1.5 },
      onEachFeature: styleAndPopup
    });
    riversLayer.addTo(map);
    layersControl.addOverlay(riversLayer, 'Rivers');
  })
  .catch(err => console.error('Failed to load rivers:', err));

// === Lakes ===
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson')
  .then(res => res.json())
  .then(data => {
    const lakesLayer = L.geoJSON(data, {
      style: { color: '#4169e1', weight: 1, fillOpacity: 0.4, fillColor: '#4169e1' },
      onEachFeature: styleAndPopup
    });
    lakesLayer.addTo(map);
    layersControl.addOverlay(lakesLayer, 'Lakes');
  })
  .catch(err => console.error('Failed to load lakes:', err));

// === Peaks ===
fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_regions_elevation_points.geojson')
  .then(res => res.json())
  .then(data => {
    const peaksLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 5,
        color: '#8b4513',
        fillColor: '#8b4513',
        fillOpacity: 0.9,
        weight: 1
      }),
      onEachFeature: styleAndPopup
    });
    peaksLayer.addTo(map);
    layersControl.addOverlay(peaksLayer, 'Peaks & Mountains');
  })
  .catch(err => console.error('Failed to load peaks:', err));
