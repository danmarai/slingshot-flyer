import { chromium } from "playwright";

async function testGame() {
  console.log("Starting browser test...\n");

  const browser = await chromium.launch({ headless: false }); // Show the browser
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    if (
      text.includes("[launch]") ||
      text.includes("[updatePhysics]") ||
      text.includes("VICTORY") ||
      text.includes("CRITICAL")
    ) {
      console.log("CONSOLE:", text);
    }
  });

  // Go to the game
  console.log("Loading game...");
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(2000); // Wait for game to initialize

  // Get canvas element
  const canvas = await page.$("#game-canvas");
  if (!canvas) {
    console.error("Canvas not found!");
    await browser.close();
    return;
  }

  const box = await canvas.boundingBox();
  if (!box) {
    console.error("Could not get canvas bounding box!");
    await browser.close();
    return;
  }

  console.log(`Canvas size: ${box.width}x${box.height}`);

  // Test 1: Small pull (should work)
  console.log("\n--- TEST 1: Small pull (10% power) ---");
  await testLaunch(page, box, 0.1);
  await page.waitForTimeout(3000);
  await checkGameState(page);
  await clickContinue(page);
  await page.waitForTimeout(1000);

  // Test 2: Medium pull (should work)
  console.log("\n--- TEST 2: Medium pull (50% power) ---");
  await testLaunch(page, box, 0.5);
  await page.waitForTimeout(3000);
  await checkGameState(page);
  await clickContinue(page);
  await page.waitForTimeout(1000);

  // Test 3: Large pull (this is where the bug might be)
  console.log("\n--- TEST 3: Large pull (100% power) ---");
  await testLaunch(page, box, 1.0);
  await page.waitForTimeout(3000);
  await checkGameState(page);

  console.log("\n--- Console logs with [launch] or [updatePhysics]: ---");
  consoleLogs
    .filter(
      (l) =>
        l.includes("[launch]") ||
        l.includes("[updatePhysics]") ||
        l.includes("VICTORY"),
    )
    .forEach((l) => console.log(l));

  console.log("\nTest complete. Browser will close in 5 seconds...");
  await page.waitForTimeout(5000);
  await browser.close();
}

async function testLaunch(page: any, box: any, power: number) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Start position (center of screen)
  const startX = centerX;
  const startY = centerY - 100;

  // End position (drag down for power)
  const dragDistance = 200 * power; // Max 200 pixels down
  const endX = startX - 50; // Slight left for angle
  const endY = startY + dragDistance;

  console.log(
    `Dragging from (${startX.toFixed(0)}, ${startY.toFixed(0)}) to (${endX.toFixed(0)}, ${endY.toFixed(0)})`,
  );

  // Perform the drag
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(100);

  // Drag slowly
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const x = startX + (endX - startX) * (i / steps);
    const y = startY + (endY - startY) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }

  await page.waitForTimeout(200);

  // Check power display before release
  const instructions = await page
    .$eval("#launch-instructions p", (el: Element) => el.textContent)
    .catch(() => "N/A");
  console.log(`Power display: ${instructions}`);

  // Release!
  console.log("Releasing mouse...");
  await page.mouse.up();
}

async function checkGameState(page: any) {
  try {
    // Check if victory overlay is visible
    const crashOverlay = await page.$("#crash-overlay");
    const isVisible = crashOverlay ? await crashOverlay.isVisible() : false;

    if (isVisible) {
      const distanceText = await page
        .$eval("#crash-distance", (el: Element) => el.textContent)
        .catch(() => "N/A");
      const coinsText = await page
        .$eval("#crash-coins", (el: Element) => el.textContent)
        .catch(() => "N/A");
      const titleText = await page
        .$eval(".crash-content h2", (el: Element) => el.textContent)
        .catch(() => "N/A");

      console.log(`Result: ${titleText}`);
      console.log(`Distance: ${distanceText}`);
      console.log(`Coins: ${coinsText}`);

      // Check for bug
      const distance = parseFloat(distanceText || "0");
      const coins = parseFloat(coinsText || "0");
      if (distance > 6000 || coins > 100000) {
        console.log("!!! BUG DETECTED: Unreasonably high distance or coins!");
      }
    } else {
      // Check HUD
      const hudDistance = await page
        .$eval("#distance-display", (el: Element) => el.textContent)
        .catch(() => "N/A");
      console.log(`HUD Distance: ${hudDistance}`);
    }
  } catch (e) {
    console.log("Error checking game state:", e);
  }
}

async function clickContinue(page: any) {
  try {
    const continueBtn = await page.$("#continue-btn");
    if (continueBtn && (await continueBtn.isVisible())) {
      await continueBtn.click();
      console.log("Clicked Continue");
    }
  } catch (e) {
    // Ignore
  }
}

testGame().catch(console.error);
