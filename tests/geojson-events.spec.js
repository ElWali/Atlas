// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('GeoJSONLayer Event Handling', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    const html = fs.readFileSync(path.join(__dirname, '../X2.html'), 'utf-8');
    await page.setContent(html, { waitUntil: 'load' });

    // Manually initialize the map, centered on our test feature
    await page.evaluate(() => {
      if (window.atlasInstance) {
        window.atlasInstance.destroy();
      }
      window.atlasInstance = new window.Atlas('map', {
        defaultCenter: { lon: -74.005, lat: 40.715 },
        defaultZoom: 15
      });
      window.atlasInstance.setBaseLayer(new window.TileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ));
    });
    await page.waitForFunction(() => window.atlasInstance && window.atlasInstance.getBaseLayer());
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('mouseout event should fire correctly', async () => {
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71], [-74.00, 40.71], [-74.00, 40.72],
            [-74.01, 40.72], [-74.01, 40.71]
          ]
        ]
      }
    };

    // Add layer and event counters
    await page.evaluate((geojson) => {
      const layer = new window.GeoJSONLayer(geojson, { interactive: true });
      window.atlasInstance.addLayer(layer);
      window.eventCounters = { mouseover: 0, mouseout: 0 };
      layer.on('mouseover', () => window.eventCounters.mouseover++);
      layer.on('mouseout', () => window.eventCounters.mouseout++);
    }, geojson);

    const centerPoint = await page.evaluate(() => window.atlasInstance.latLngToContainerPoint({ lat: 40.715, lon: -74.005 }));

    // 1. Move inside the feature
    await page.mouse.move(centerPoint.x, centerPoint.y);
    await page.waitForTimeout(100);
    let counters = await page.evaluate(() => window.eventCounters);
    expect(counters.mouseover, 'mouseover should fire once when entering feature').toBe(1);
    expect(counters.mouseout, 'mouseout should not fire when entering feature').toBe(0);

    // 2. Move within the feature
    await page.mouse.move(centerPoint.x + 1, centerPoint.y + 1);
    await page.waitForTimeout(100);
    counters = await page.evaluate(() => window.eventCounters);
    expect(counters.mouseover, 'mouseover should not fire again within feature').toBe(1);
    expect(counters.mouseout, 'mouseout should not fire within feature').toBe(0);

    // 3. Move outside the feature
    await page.mouse.move(1, 1); // Move to a corner, far from the feature
    await page.waitForTimeout(100);
    counters = await page.evaluate(() => window.eventCounters);
    expect(counters.mouseout, 'mouseout should fire once when leaving feature').toBe(1);

    // 4. Move around outside the feature
    await page.mouse.move(2, 2);
    await page.waitForTimeout(100);
    counters = await page.evaluate(() => window.eventCounters);
    expect(counters.mouseout, 'mouseout should not fire again outside feature').toBe(1);
  });
});