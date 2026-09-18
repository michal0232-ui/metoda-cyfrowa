import { test, expect } from "@playwright/test";

async function ready(page, degrees = [4], key = "C") {
  await page.addInitScript(
    ({ degrees, key }) => {
      localStorage.setItem(
        "functional-ear-trainer.settings.v1",
        JSON.stringify({ key, degrees, volume: 0.5 }),
      );
    },
    { degrees, key },
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
}
test("wrong answers never reveal a note; correct answer resolves and advances automatically", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await ready(page);
  await page.locator("#start").click();
  await expect(page.locator('#answers button[data-degree="2"]')).toBeEnabled({
    timeout: 8000,
  });
  const blank = await page.locator("#notation").innerHTML();
  await page.locator('#answers button[data-degree="2"]').click();
  await expect(page.locator('#answers button[data-degree="2"]')).toBeDisabled();
  expect(await page.locator("#notation").innerHTML()).toBe(blank);
  await expect(page.locator("#stat-total")).toHaveText("0");
  await page.keyboard.press("6");
  await expect(page.locator('#answers button[data-degree="6"]')).toBeDisabled();
  expect(await page.locator("#notation").innerHTML()).toBe(blank);
  await page.locator("#repeat").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await expect(page.locator('#answers button[data-degree="2"]')).toBeDisabled();
  await page.keyboard.press("4");
  await expect(page.locator('#answers button[data-degree="4"]')).toHaveClass(
    "correct",
  );
  await expect(page.locator("#notation")).toHaveAttribute(
    "aria-label",
    "Zagrany dźwięk: F4",
  );
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(1);
  await expect(page.locator("#history tr")).toHaveCount(1);
  await expect(page.locator("#history tr")).toHaveText("1C-dur432 → 6");
  await expect(page.locator("#stat-average")).toHaveText("3");
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 10000 });
  await expect(page.locator("#answers button.wrong")).toHaveCount(0);
  await expect(page.locator("#answers button.correct")).toHaveCount(0);
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await page.locator("#stop").click();
  expect(errors).toEqual([]);
});
test("stop cancels playback and last selected degree cannot be removed", async ({
  page,
}) => {
  await ready(page, [7]);
  await page.getByLabel("Ćwicz stopień 7", { exact: true }).click();
  await expect(
    page.getByLabel("Ćwicz stopień 7", { exact: true }),
  ).toBeChecked();
  await page.locator("#start").click();
  await expect(page.locator("#key")).toBeDisabled();
  await page.locator("#stop").click();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#key")).toBeEnabled();
  await expect(page.locator("#stat-total")).toHaveText("0");
  // A second start must not race with the first task's cancelled continuation.
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await page.keyboard.press("7");
  await expect(page.locator("#stat-first")).toHaveText("100%");
  await page.locator("#stop").click();
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#stat-total")).toHaveText("1");
});
test("all key signatures render; enharmonic note spelling is preserved", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, [7]);
  await page.locator(".key-picker summary").click();
  await page.locator("#all-keys").click();
  for (const key of [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "F",
    "Bb",
    "Eb",
    "Ab",
    "Db",
    "Gb",
  ]) {
    await page.locator("#key").selectOption(key);
    await expect(page.locator("#notation svg")).toHaveCount(1);
    await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  }
  await page.locator("#key").selectOption("F#");
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await page.keyboard.press("7");
  await expect(page.locator("#notation")).toHaveAttribute(
    "aria-label",
    "Zagrany dźwięk: Eis4",
  );
  await page.locator("#stop").click();
  expect(errors).toEqual([]);
});
test("touch layout fits a narrow screen and settings survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator(".key-picker summary").click();
  await page.getByLabel("Tonacja B-dur", { exact: true }).check();
  await page.locator("#key").selectOption("Bb");
  await page.getByLabel("Ćwicz stopień 3", { exact: true }).uncheck();
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#key")).toHaveValue("Bb");
  await expect(
    page.getByLabel("Ćwicz stopień 3", { exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const button of await page.locator("#answers button").all()) {
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("desktop visual check", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await ready(page, [1, 2, 3, 4, 5, 6, 7]);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
