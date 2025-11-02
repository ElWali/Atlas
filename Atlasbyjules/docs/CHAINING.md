# Method Chaining Guide

Atlas.js supports fluent method chaining for improved developer experience.

## Examples

### Building Complex Maps

```javascript
const map = new Atlas('map')
  .addLayer(new TileLayer(...))
  .addControl(new ZoomControl())
  .addControl(new FullscreenControl())
  .enableHandler('scrollZoom')
  .enablePerformanceMonitoring()
  .flyTo({ center: { lat: 0, lon: 0 }, zoom: 10 });
```

### Working with Overlays

```javascript
const marker = new AtlasMarker({ lat: 0, lon: 0 })
  .bindPopup('Hello World')
  .addTo(map)
  .openPopup();

// Move marker and close popup
marker.setLatLng({ lat: 10, lon: 10 })
  .closePopup();
```

### Configuring GeoJSON

```javascript
const layer = new GeoJSONLayer(data, { interactive: true })
  .addTo(map)
  .on('click', (e) => console.log(e.feature));

// Update data
layer.setData(newData)
  .addTo(map);
```

### Event Handling

```javascript
map
  .on('zoom', (e) => console.log('Zoomed to', e.target.getZoom()))
  .on('moveend', (e) => console.log('Move ended'))
  .enableHandler('touchZoomRotate')
  .enablePerformanceMonitoring();
```

## Chainable Methods by Class

### Atlas (Map)

- `setZoom(z)`
- `setBearing(rad)`
- `flyTo(options)`
- `resize()`
- `setBaseLayer(layer)`
- `addLayer(layer)`
- `removeLayer(layer)`
- `addControl(control)`
- `removeControl(control)`
- `addOverlay(overlay)`
- `removeOverlay(overlay)`
- `addHandler(name, Class)`
- `removeHandler(name)`
- `enableHandler(name)`
- `disableHandler(name)`
- `on(type, fn)`
- `off(type, fn)`
- `enablePerformanceMonitoring()`

### Layer (Base Class)

- `addTo(map)`
- `remove()`
- `setData(data)` - for applicable layers
- `on(type, fn)`
- `off(type, fn)`

### Control (Base Class)

- `addTo(map)`
- `remove()`
- `on(type, fn)`
- `off(type, fn)`

### Overlay & AtlasMarker

- `addTo(map)`
- `remove()`
- `setLatLng(latlng)` - for markers
- `bindPopup(content)`
- `unbindPopup()`
- `togglePopup()`
- `openPopup()`
- `closePopup()`
- `on(type, fn)`
- `off(type, fn)`

### AtlasPopup

- `openOn(anchor)`
- `close()`
- `setContent(html)`

### Handler (Base Class)

- `enable()`
- `disable()`
- `toggle()`

## Tips

1.  **Order Matters**: Chain in logical order

    ```javascript
    // Good: Add layer, then add controls
    map.addLayer(layer)
      .addControl(zoomControl)
      .flyTo(location);

    // Not as good: Adds controls before layer
    map.addControl(zoomControl)
      .addLayer(layer);
    ```

2.  **Break for Readability**: Long chains can be split

    ```javascript
    map
      .addLayer(layer)
      .addControl(zoomControl)
      .addControl(fullscreenControl)
      .flyTo(location);
    ```

3.  **Reuse Results**: Save intermediate results when needed

    ```javascript
    const marker = new AtlasMarker({ lat: 0, lon: 0 })
      .bindPopup('Test')
      .addTo(map);

    // Later...
    marker.setLatLng({ lat: 10, lon: 10 });
    ```
