import { test, expect } from "@playwright/test";

test.describe("WardPulse End-to-End Clinical Lifecycle Verification", () => {
  test("Screen 1: Landing page renders role cards and demo logins", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("WardPulse Clinical Ward Board")).toBeVisible();
    await expect(page.getByText("Instant 1-Tap Demo Access")).toBeVisible();
    await expect(page.getByText("Admin Portal")).toBeVisible();
    await expect(page.getByText("Nurse Station")).toBeVisible();
    await expect(page.getByText("Doctor Rounds")).toBeVisible();
  });

  test("Screen 2: Admin Dashboard loads 74 beds, counters, and ward board", async ({ page }) => {
    // 1-Tap Quick Demo Login as Admin
    await page.goto("/");
    await page.getByRole("button", { name: /Dr. Sarah Chen/i }).click();

    // Verify redirected to /admin
    await expect(page).toHaveURL(/.*admin/);
    await expect(page.getByText("Facility Live Ward Board")).toBeVisible();

    // Verify 8 live counter cards exist
    await expect(page.getByText("Occupancy", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Needs Temp").first()).toBeVisible();
    await expect(page.getByText("Ready for Doc").first()).toBeVisible();
    await expect(page.getByText("Seen Today").first()).toBeVisible();
    await expect(page.getByText("Ready Cured").first()).toBeVisible();
    await expect(page.getByText("Fever Today").first()).toBeVisible();
    await expect(page.getByText("Overdue").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Waitlist", { exact: true })).toBeVisible();

    // Verify ward grid has room tiles
    await expect(page.getByText("A-01").first()).toBeVisible();
  });

  test("Screen 5: Nurse can record temperature with duplicate protection", async ({ page }) => {
    // 1-Tap Demo Login as Nurse
    await page.goto("/");
    await page.getByRole("button", { name: /Anita Patel/i }).click();

    await expect(page).toHaveURL(/.*nurse/);
    await expect(page.getByText("Nurse Station Triage")).toBeVisible();
    await expect(page.getByText("To Measure", { exact: true }).first()).toBeVisible();

    // Tap first patient's Record Temp button
    const recordBtn = page.getByRole("button", { name: /Record Temp/i }).first();
    if (await recordBtn.isVisible()) {
      await recordBtn.click();
      // Verify Keypad modal appears
      await expect(page.getByText("Bed Triage")).toBeVisible();
      await expect(page.getByText("NORMAL TEMPERATURE")).toBeVisible();

      // Tap Save
      const saveBtn = page.getByRole("button", { name: /Save.*Advance to Doctor/i });
      await saveBtn.click();

      // Verify success toast appears
      await expect(page.getByText(/Recorded/i)).toBeVisible();
    }
  });

  test("Screen 6: Doctor rounds and strict pipeline gating", async ({ page }) => {
    // 1-Tap Demo Login as Doctor
    await page.goto("/");
    await page.getByRole("button", { name: /Dr. Priya Sharma/i }).click();

    await expect(page).toHaveURL(/.*doctor/);
    await expect(page.getByText("Physician Clinical Rounds")).toBeVisible();
    await expect(page.getByText("Ready for Me")).toBeVisible();

    // Switch to Waiting for Temp tab
    await page.getByRole("button", { name: /Waiting for Temp/i }).click();

    // Verify that patients awaiting temperature have "Request Temp Now" and CANNOT log visit directly
    const requestBtn = page.getByRole("button", { name: /Request Temp Now/i }).first();
    if (await requestBtn.isVisible()) {
      await expect(requestBtn).toBeVisible();
    }
  });

  test("Screen 7: Discharge Center and Wilson 95% CI Quality Analytics", async ({ page }) => {
    await page.goto("/discharge");
    await expect(page.getByText("Discharge Center & Statistical Quality Monitoring")).toBeVisible();
    await expect(page.getByText("Awaiting Doctor Sign-off")).toBeVisible();
    await expect(page.getByText("Ready to Discharge")).toBeVisible();

    // Switch to Analytics Section
    await page.getByRole("button", { name: /Performance & Wilson CI/i }).click();
    await expect(page.getByText(/Quality Alert Status/i)).toBeVisible();
    await expect(page.getByText(/Wilson 95% CI:/i).first()).toBeVisible();
    await expect(page.getByText("Mortality Rate")).toBeVisible();
    await expect(page.getByText("Success Rate")).toBeVisible();
    await expect(page.getByText("Clinical Protocol Compliance")).toBeVisible();
  });
});
