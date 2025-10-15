// Verification Snippet for Keyboard Pan Fix

function runVerification() {
  if (!window.atlasInstance) {
    console.error("Atlas instance not found. Please ensure the map is initialized.");
    return;
  }

  const atlas = window.atlasInstance;
  const keyboardHandler = atlas.getHandler('keyboardPan');

  if (!keyboardHandler) {
    console.error("KeyboardPanHandler not found.");
    return;
  }

  console.log("--- Starting Verification ---");

  // 1. Rotate the map by 90 degrees
  const rotationAngleRad = 90 * (Math.PI / 180);
  atlas.setBearing(rotationAngleRad);
  console.log(`Map rotated to: ${atlas.getBearing() * (180 / Math.PI)} degrees`);

  // Allow a moment for the render to complete
  setTimeout(() => {
    // 2. Record the map's center coordinates
    const initialCenter = atlas.getCenter();
    console.log(`Initial Center: Lat ${initialCenter.lat.toFixed(6)}, Lon ${initialCenter.lon.toFixed(6)}`);

    // 3. Programmatically trigger the keyboard pan logic for the 'Up' arrow.
    // This simulates pressing the 'ArrowUp' key.
    console.log("Simulating 'ArrowUp' key press...");
    const mockEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    keyboardHandler._onKeyDown(mockEvent);

    // Allow a moment for the pan to process and render
    setTimeout(() => {
      // 4. Record the new center coordinates
      const newCenter = atlas.getCenter();
      console.log(`New Center:     Lat ${newCenter.lat.toFixed(6)}, Lon ${newCenter.lon.toFixed(6)}`);

      // 5. Assert that the latitude has increased (a northward pan)
      const latIncreased = newCenter.lat > initialCenter.lat;
      // Check if longitude changed more than a tiny bit. With the fix, it should not.
      const lonChangedSignificantly = Math.abs(newCenter.lon - initialCenter.lon) > 1e-5;

      console.log(`Latitude increased (moved North)? ${latIncreased}`);
      console.log(`Longitude changed significantly? ${lonChangedSignificantly}`);

      if (latIncreased && !lonChangedSignificantly) {
        console.log("%c✅ VERIFICATION PASSED: Panning is geographic (North) regardless of rotation.", "color: green; font-weight: bold;");
      } else if (!latIncreased && lonChangedSignificantly) {
         console.log("%c❌ VERIFICATION FAILED (as expected before fix): Panning is screen-relative (West) instead of geographic.", "color: red; font-weight: bold;");
      } else {
         console.log("%c❌ VERIFICATION FAILED: Unexpected panning behavior.", "color: red; font-weight: bold;");
      }
      console.log("--- Verification Complete ---");

      // Reset bearing for normal use
      atlas.setBearing(0);

    }, 100);
  }, 100);
}

console.log("Verification script loaded. To run the test, open X2.html in a browser, open the developer console, paste the content of this file, and then run `runVerification()`.");