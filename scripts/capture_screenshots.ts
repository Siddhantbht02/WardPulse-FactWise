import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = "C:\\Users\\Siddh\\.gemini\\antigravity\\brain\\fee90af9-d49e-49c1-b842-13a8801d8e07\\screenshots";

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  for (const vp of viewports) {
    console.log(`📸 Capturing ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();

    // 1. Screen 1: Login / Role Select
    await page.goto("http://localhost:3000/");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen1_login_${vp.name}.png`), fullPage: false });

    // Login as Admin
    await page.getByRole("button", { name: /Dr. Sarah Chen/i }).first().click();
    await page.waitForTimeout(2000);

    // 2. Screen 2: Admin Dashboard & 74-Room Ward Board
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen2_admin_dashboard_${vp.name}.png`), fullPage: false });

    // 3. Screen 3: Patient List & Registry
    await page.goto("http://localhost:3000/patients");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen3_patient_list_${vp.name}.png`), fullPage: false });

    // 4. Screen 4: Patient Details
    await page.goto("http://localhost:3000/patients/pat-1");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen4_patient_details_${vp.name}.png`), fullPage: false });

    // 5. Screen 5: Nurse Dashboard
    await page.goto("http://localhost:3000/nurse");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen5_nurse_dashboard_${vp.name}.png`), fullPage: false });

    // Open temperature entry keypad modal on Nurse screen
    const recordBtn = page.getByRole("button", { name: /Record Temp/i }).first();
    if (await recordBtn.isVisible()) {
      await recordBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `screen5_nurse_keypad_${vp.name}.png`), fullPage: false });
    }

    // 6. Screen 6: Doctor Dashboard
    await page.goto("http://localhost:3000/doctor");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen6_doctor_dashboard_${vp.name}.png`), fullPage: false });

    // 7. Screen 7: Discharge Center & Wilson CI Quality Analytics
    await page.goto("http://localhost:3000/discharge");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen7_discharge_processing_${vp.name}.png`), fullPage: false });

    // Switch to Analytics view
    await page.getByRole("button", { name: /Performance & Wilson CI/i }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `screen7_wilson_ci_analytics_${vp.name}.png`), fullPage: false });

    await context.close();
  }

  await browser.close();
  console.log("✅ All screenshots captured and saved to artifact directory!");
}

main().catch(console.error);
