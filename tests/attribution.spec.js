const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('OpenStreetMap attribution link should be correct on initial load', async ({ page }) => {
  // Mock geolocation to force the success path in the application
  await page.context().setGeolocation({ latitude: 52.52, longitude: 13.40 });

  // Load the HTML file
  const html = fs.readFileSync(path.join(__dirname, '../X2.html'), 'utf-8');
  await page.setContent(html, { waitUntil: 'load' });

  // Wait for the map and attribution to be initialized
  await page.waitForSelector('#attribution a', { timeout: 30000 });

  // Get the href attribute of the OpenStreetMap link
  const attributionLink = await page.$eval('#attribution a', el => el.getAttribute('href'));

  // Assert that the link is correct
  expect(attributionLink).toBe('https://www.openstreetmap.org/copyright');
});
