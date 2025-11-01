const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('the _loadTile promise should reject on failure', async ({ page }) => {
  // Load the HTML file to get the TileLayer class definition
  const html = fs.readFileSync(path.join(__dirname, '../X2.html'), 'utf-8');
  await page.setContent(html, { waitUntil: 'load' });

  // Set a short timeout for the tile loading for this test
  await page.evaluate(() => {
    window.TILE_LOAD_TIMEOUT_MS = 1000; // 1 second
  });

  const promiseRejected = await page.evaluate(async () => {
    const layer = new window.TileLayer('https://non-existent-domain.com/{z}/{x}/{y}.png');
    layer._map = { scheduleRender: () => {} }; // Mock the map object

    try {
      await layer._loadTile('0/0/0', 'https://non-existent-domain.com/0/0/0.png');
      return false; // Should not reach here
    } catch (error) {
      return true; // Promise was rejected as expected
    }
  });

  // This will be false before the fix (promise resolves) and true after (promise rejects).
  expect(promiseRejected).toBe(true);
});
