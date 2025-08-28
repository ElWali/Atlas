// === Initialize Map ===
const map = L.map('map', { 
  zoomControl: true,
  zoomSnap: 0.5,
  zoomDelta: 0.5
}).setView([20, 0], 2);

// === ESRI Satellite Base Layer ===
const esriLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: 'Tiles © Esri &mdash; Earthstar Geographics' }
).addTo(map);

// === Overlays (default off) ===
const biomesLayer = L.tileLayer.wms(
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wmts.cgi?",
  { 
    layers: "MODIS_Terra_Land_Surface_Classification_Daily", 
    format: "image/png", 
    transparent: true, 
    opacity: 0.3,
    attribution: "NASA EOSDIS"
  }
);

const oceanCurrents = L.tileLayer.wms(
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wmts.cgi?",
  { 
    layers: "OSCAR_Sea_Surface_Currents", 
    format: "image/png", 
    transparent: true, 
    opacity: 0.5,
    attribution: "NASA EOSDIS"
  }
);

const starsLayer = L.tileLayer(
  "https://tiles.stamen.com/toner-background/{z}/{x}/{y}.png",
  { 
    opacity: 0.6, 
    attribution: "Stars data © Stellarium/NASA" 
  }
);

// === Layer Toggle Panel ===
const overlaysControl = L.control({ position: 'topright' });
overlaysControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar');
  div.style.background = 'white';
  div.style.padding = '8px';
  div.style.borderRadius = '6px';
  div.style.fontSize = '14px';
  div.innerHTML = `
    <strong>🌍 Layers</strong><br>
    <label><input type="checkbox" id="biomes-toggle"/> Biomes</label><br>
    <label><input type="checkbox" id="currents-toggle"/> Ocean Currents</label><br>
    <label><input type="checkbox" id="stars-toggle"/> Constellations</label>
  `;
  return div;
};
overlaysControl.addTo(map);

function bindToggles() {
  document.getElementById("biomes-toggle").addEventListener("change", e =>
    e.target.checked ? map.addLayer(biomesLayer) : map.removeLayer(biomesLayer)
  );
  document.getElementById("currents-toggle").addEventListener("change", e =>
    e.target.checked ? map.addLayer(oceanCurrents) : map.removeLayer(oceanCurrents)
  );
  document.getElementById("stars-toggle").addEventListener("change", e =>
    e.target.checked ? map.addLayer(starsLayer) : map.removeLayer(starsLayer)
  );
}
setTimeout(bindToggles, 500);

// === Scale Bar ===
L.control.scale().addTo(map);

// === Coordinates Display ===
const info = L.control({ position: "bottomright" });
info.onAdd = function () { 
  this._div = L.DomUtil.create('div', 'info'); 
  this.update(); 
  return this._div; 
};
info.update = function (latlng) { 
  this._div.innerHTML = latlng ? 
    `Lat: ${latlng.lat.toFixed(2)}, Lng: ${latlng.lng.toFixed(2)}` : 
    'Move finger: coords'; 
};
info.addTo(map);
map.on('mousemove', e => info.update(e.latlng));
map.on('mouseout', () => info.update(null));

// === Search (Geocoder) ===
let searchMarker = null;
L.Control.geocoder({ 
  defaultMarkGeocode: false, 
  position: 'topleft' 
})
.on('markgeocode', e => {
  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.marker(e.geocode.center)
    .addTo(map)
    .bindPopup(`<strong>${e.geocode.name}</strong>`)
    .openPopup();
  if (e.geocode.bbox) {
    map.flyToBounds(e.geocode.bbox, { duration: 2 });
  } else {
    map.flyTo(e.geocode.center, 10, { duration: 2 });
  }
}).addTo(map);

// === Fullscreen, MiniMap, Day/Night Terminator ===
map.addControl(new L.Control.Fullscreen({ position: 'topright' }));
new L.Control.MiniMap(esriLayer, { 
  toggleDisplay: true, 
  position: 'bottomright' 
}).addTo(map);

let terminator = L.terminator();
terminator.addTo(map);
setInterval(() => terminator.setTime(new Date()), 30000);

// === Measure Tool ===
L.control.measure({
  position: 'topleft',
  primaryLengthUnit: 'kilometers',
  secondaryLengthUnit: 'miles',
  primaryAreaUnit: 'sqmeters'
}).addTo(map);

// === Locate Me Button ===
let userMarker = null;
const locateControl = L.control({ position: 'topleft' });
locateControl.onAdd = function () {
  const btn = L.DomUtil.create('button', 'leaflet-bar');
  btn.innerHTML = '📍'; 
  btn.title = "Go to my location";
  btn.style.fontSize = '22px'; 
  btn.style.width = '44px'; 
  btn.style.height = '44px';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  L.DomEvent.on(btn, 'click', () => {
    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });
  });
  return btn;
};
locateControl.addTo(map);

map.on('locationfound', e => {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker(e.latlng)
    .addTo(map)
    .bindPopup("📍 You are here")
    .openPopup();
});

map.on('locationerror', () => {
  alert("Unable to retrieve your location");
});

// === Compass + Orientation ===
let compassEnabled = false;
let currentRotation = 0;
let compassArrow;

function setMapRotation(angle) {
  currentRotation = angle;
  document.getElementById("map").style.transform = `rotate(${angle}deg)`;
  if (compassArrow) {
    compassArrow.style.transform = `rotate(${-angle}deg)`;
  }
}

const compassControl = L.control({ position: 'topleft' });
compassControl.onAdd = function () {
  const btn = L.DomUtil.create('button', 'leaflet-bar');
  btn.innerHTML = '🧭'; 
  btn.title = "Toggle compass"; 
  btn.style.fontSize = '22px'; 
  btn.style.width = '44px'; 
  btn.style.height = '44px';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  L.DomEvent.on(btn, 'click', () => {
    compassEnabled = !compassEnabled; 
    if (!compassEnabled) setMapRotation(0);
  });
  return btn;
};
compassControl.addTo(map);

const compassOverlay = L.control({ position: 'topright' });
compassOverlay.onAdd = function() {
  const div = L.DomUtil.create('div'); 
  div.style.width = "50px";
  div.style.height = "50px";
  div.style.border = "2px solid black";
  div.style.borderRadius = "50%";
  div.style.background = "rgba(255,255,255,0.7)";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  
  compassArrow = L.DomUtil.create('div', '', div);
  compassArrow.innerHTML = "N";
  compassArrow.style.fontSize = "18px";
  compassArrow.style.fontWeight = "bold";
  compassArrow.style.color = "red";
  
  return div;
};
compassOverlay.addTo(map);

// Handle device orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  window.addEventListener("deviceorientation", handleOrientation, true);
}

function handleOrientation(event) {
  if (!compassEnabled) return;
  
  let heading;
  if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading;
  } else if (event.alpha !== null) {
    heading = 360 - event.alpha;
  }
  
  if (typeof heading === "number") {
    setMapRotation(heading);
  }
}

// === Pinch-Rotate via Hammer.js ===
const hammer = new Hammer.Manager(document.getElementById("map"));
hammer.add(new Hammer.Rotate());
hammer.on("rotatemove", function(ev) {
  if (!compassEnabled) {
    setMapRotation(currentRotation + ev.rotation);
  }
});
hammer.on("rotateend", function(ev) {
  if (!compassEnabled) {
    setMapRotation(currentRotation + ev.rotation);
  }
});
