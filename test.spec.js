const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('the _loadTile promise should resolve on success', async ({ page }) => {
  // Load the HTML file to get the TileLayer class definition
  const html = fs.readFileSync(path.join(__dirname, 'X2.html'), 'utf-8');
  await page.setContent(html, { waitUntil: 'load' });

  const promiseResolved = await page.evaluate(async () => {
    // We don't need a full map instance. We can just instantiate a TileLayer.
    const layer = new window.TileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png');

    // Mock the _map object so scheduleRender doesn't fail
    layer._map = { scheduleRender: () => {} };

    // Call the problematic function. Use a real, accessible tile URL.
    const tilePromise = layer._loadTile('0/0/0', 'https://a.tile.openstreetmap.org/0/0/0.png');

    // Race the tile promise against a timeout promise.
    // If tilePromise resolves, this will resolve to 'tile'.
    // If the timeout wins, this will resolve to 'timeout'.
    const winner = await Promise.race([
      tilePromise.then(() => 'tile'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 5000))
    ]);

    return winner === 'tile';
  });

  // This will be false before the fix (timeout wins) and true after (tile wins).
  expect(promiseResolved).toBe(true);
});