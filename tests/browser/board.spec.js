import { test, expect } from "@playwright/test";

async function ready(page, fullscreen = "blocked") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(
    ({ fullscreen }) => {
      localStorage.setItem(
        "functional-ear-trainer.settings.v1",
        JSON.stringify({ degrees: [5], key: "C" }),
      );
      if (fullscreen === "blocked")
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new Error("Denied"));
      if (fullscreen === "missing")
        Element.prototype.requestFullscreen = undefined;
    },
    { fullscreen },
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  return errors;
}
async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const boxes = await page
    .locator("#answers button, #notation, .transport, #board-toolbar")
    .evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      }),
    );
  const viewport = page.viewportSize();
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (const box of boxes.slice(-7)) {
    expect(box.height).toBeGreaterThan(0);
  }
}
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [900, 720],
]) {
  test(`board fits ${width}x${height}: modes, settings, answers and fallback`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width, height });
    const errors = await ready(page);
    await page.locator("#board-enter").click();
    await expect(page.locator("html")).toHaveClass("board-mode");
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    for (const [mode, labels] of Object.entries({
      digits: ["1", "2", "3", "4", "5", "6", "7"],
      solfege: ["do", "re", "mi", "fa", "sol", "la", "si"],
      european: ["C", "D", "E", "F", "G", "A", "H"],
      gestures: null,
    })) {
      await page.locator("#board-settings").click();
      await expect(page.locator("#board-settings-dialog")).toBeVisible();
      await page.locator("#answer-names").selectOption(mode);
      await page.locator(".key-picker summary").click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await page.locator("#board-settings-close").click();
      await expect(page.locator("#board-settings-dialog")).not.toBeVisible();
      if (labels)
        await expect(page.locator("#answers button")).toHaveText(labels);
      else {
        await expect(page.locator("#answers img")).toHaveCount(7);
        await expect
          .poll(() =>
            page
              .locator("#answers img")
              .evaluateAll((imgs) =>
                imgs.every((i) => i.complete && i.naturalWidth > 0),
              ),
          )
          .toBe(true);
        for (const img of await page.locator("#answers img").all())
          await expect(img).toHaveCSS("object-fit", "contain");
      }
      await fits(page);
    }
    const rows = await page
      .locator("#answers button")
      .evaluateAll((btns) =>
        btns.map((b) => Math.round(b.getBoundingClientRect().y)),
      );
    expect(new Set(rows).size).toBe(width > 1100 ? 1 : 2);
    if (width <= 1100)
      expect(rows.filter((y) => y === rows[0])).toHaveLength(4);
    for (const button of await page.locator("#answers button").all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThan(140);
      expect(box.height).toBeGreaterThan(90);
    }
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    await fits(page);
    await page.locator('[data-degree="2"]').click();
    await expect(page.locator('[data-degree="2"]')).toBeDisabled();
    await expect(page.locator('[data-degree="2"]')).toHaveCSS(
      "filter",
      "grayscale(1)",
    );
    await page.locator("#board-settings").click();
    await expect(page.locator("#key")).toBeDisabled();
    await page.keyboard.press("5");
    await expect(page.locator("#stat-total")).toHaveText("0");
    await page.keyboard.press("Escape");
    await expect(page.locator("#board-settings-dialog")).not.toBeVisible();
    await expect(page.locator("html")).toHaveClass("board-mode");
    await page.screenshot({ path: `test-results/board-${width}.png` });
    await page.locator('[data-degree="5"]').click();
    await expect(page.locator('[data-degree="5"]')).toHaveClass(
      "gesture correct",
    );
    await expect(page.locator("#notation .vf-stavenote")).toHaveCount(1);
    await expect(page.locator("#stat-total")).toHaveText("1");
    await fits(page);
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 12000 });
    await expect(page.locator('[data-degree="2"]')).toBeEnabled();
    await page.locator("#stop").click();
    await page.locator("#board-exit").click();
    await expect(page.locator("html")).not.toHaveClass("board-mode");
    await expect(page.locator(".workspace > .settings")).toBeVisible();
    await expect(page.locator("#answer-names")).toHaveValue("gestures");
    expect(errors).toEqual([]);
  });
}
test("native fullscreen entry, exit and fullscreenchange restore the normal view", async ({
  page,
}) => {
  const errors = await ready(page, "native");
  await page.locator("#board-enter").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.fullscreenElement === document.documentElement,
      ),
    )
    .toBe(true);
  await page.locator("#board-settings").click();
  await expect(page.locator("#board-settings-dialog")).toBeVisible();
  await page.evaluate(() => document.exitFullscreen()); // Browser-level exit, as with Esc.
  await expect(page.locator("html")).not.toHaveClass("board-mode");
  await expect(page.locator("#board-settings-dialog")).not.toBeVisible();
  await page.locator("#board-enter").click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page.locator("#board-exit").click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  await expect(page.locator("html")).not.toHaveClass("board-mode");
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass("board-mode");
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(errors).toEqual([]);
});
test("missing fullscreen API still allows board layout, settings and exit", async ({
  page,
}) => {
  const errors = await ready(page, "missing");
  await page.locator("#board-enter").click();
  await expect(page.locator("html")).toHaveClass("board-mode");
  await page.locator("#board-settings").click();
  await page.locator("#board-settings-close").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveClass("board-mode");
  expect(errors).toEqual([]);
});

test.describe("touch settings and dynamic viewport", () => {
  test.use({ hasTouch: true });
  test("touch controls retain changes and resizing keeps the full exercise visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const errors = await ready(page);
    await page.locator("#board-enter").tap();
    await page.locator("#board-settings").tap();
    await page.getByLabel("Ćwicz stopień 2", { exact: true }).check();
    await page.locator(".key-picker summary").tap();
    await page.getByLabel("Tonacja G-dur", { exact: true }).check();
    await page.locator("#key").selectOption("G");
    await page.locator("#mix-keys").check();
    await page.locator("#answer-names").selectOption("gestures");
    await page.locator("#volume").fill("30");
    await expect(page.locator("#volume-value")).toHaveText("30%");
    await page.screenshot({ path: "test-results/board-settings.png" });
    await page.locator("#board-settings-close").tap();
    for (const viewport of [
      { width: 1280, height: 620 },
      { width: 900, height: 720 },
      { width: 720, height: 1280 },
    ]) {
      await page.setViewportSize(viewport);
      await fits(page);
    }
    await page.locator("#board-settings").tap();
    await expect(
      page.getByLabel("Ćwicz stopień 2", { exact: true }),
    ).toBeChecked();
    await expect(page.locator("#mix-keys")).toBeChecked();
    await expect(page.locator("#key")).toHaveValue("G");
    await expect(page.locator("#volume")).toHaveValue("30");
    await page.locator("#board-settings-close").tap();
    await page.locator("#board-exit").tap();
    await expect(
      page.locator(".workspace > .settings #answer-names"),
    ).toHaveValue("gestures");
    expect(errors).toEqual([]);
  });
});
