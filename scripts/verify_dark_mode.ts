import { chromium } from "playwright";

async function verifyDarkMode() {
  console.log("🌙 Testing Dark Mode Toggle on Desktop and Mobile...");
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "Desktop", width: 1440, height: 900, isMobile: false },
    { name: "Mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting on ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();

    // 1. Visit landing page
    await page.goto("http://localhost:3000/");
    await page.waitForTimeout(1000);

    // 2. Find toggle button
    const toggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (!(await toggle.isVisible())) {
      throw new Error(`Dark mode toggle not visible on ${vp.name}!`);
    }
    console.log(`✓ Dark mode toggle button is visible on ${vp.name}`);

    // Check initial class
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    console.log(`  Initial dark state: ${initialIsDark}`);

    // 3. Click to toggle
    await toggle.click();
    await page.waitForTimeout(500);

    const toggledIsDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (toggledIsDark === initialIsDark) {
      throw new Error(`Clicking dark mode toggle did NOT toggle 'dark' class on <html> on ${vp.name}!`);
    }
    console.log(`✓ Clicked toggle: dark state changed from ${initialIsDark} -> ${toggledIsDark}`);

    // Check localStorage
    const savedTheme = await page.evaluate(() => localStorage.getItem("wardpulse_theme"));
    console.log(`✓ LocalStorage theme saved: '${savedTheme}'`);
    if (savedTheme !== (toggledIsDark ? "dark" : "light")) {
      throw new Error(`LocalStorage theme mismatch: expected ${toggledIsDark ? "dark" : "light"}, got ${savedTheme}`);
    }

    // 4. Reload page and verify persistence
    await page.reload();
    await page.waitForTimeout(1000);
    const reloadedIsDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (reloadedIsDark !== toggledIsDark) {
      throw new Error(`Theme did not persist after reload on ${vp.name}! Expected ${toggledIsDark}, got ${reloadedIsDark}`);
    }
    console.log(`✓ Theme persisted after page reload: ${reloadedIsDark}`);

    // 5. Click again to switch back
    await page.locator('[data-testid="dark-mode-toggle"]').click();
    await page.waitForTimeout(500);
    const revertedIsDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (revertedIsDark === toggledIsDark) {
      throw new Error(`Clicking again did not toggle back on ${vp.name}!`);
    }
    console.log(`✓ Clicked again: successfully reverted to ${revertedIsDark}`);

    await context.close();
  }

  await browser.close();
  console.log("\n🎉 ALL DARK MODE VERIFICATION CHECKS PASSED PERFECTLY!");
}

verifyDarkMode().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});

