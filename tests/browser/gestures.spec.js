import { test, expect } from "@playwright/test";

test("gestures load, all presentations switch, European keys and persistence work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  const modes = page.locator("#answer-names");
  const buttons = page.locator("#answers button");
  await expect(modes.locator("option")).toHaveCount(4);
  await modes.selectOption("gestures");
  const names = ["do", "re", "mi", "fa", "sol", "la", "si"];
  for (let i = 0; i < names.length; i++) {
    const img = buttons.nth(i).locator("img");
    await expect(img).toHaveAttribute(
      "src",
      new RegExp(`/assets/gestures/${names[i]}.png$`),
    );
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    await expect(img).toHaveCSS("object-fit", "contain");
    await expect(buttons.nth(i)).toHaveAttribute(
      "aria-label",
      `Stopień ${i + 1} — ${names[i]}`,
    );
  }
  await modes.selectOption("digits");
  await expect(buttons).toHaveText(["1", "2", "3", "4", "5", "6", "7"]);
  await expect(buttons.locator("img")).toHaveCount(0);
  await modes.selectOption("solfege");
  await expect(buttons).toHaveText(names);
  await modes.selectOption("european");
  await page.locator(".key-picker summary").click();
  await page.locator("#all-keys").click();
  for (const [key, labels] of Object.entries({
    C: ["C", "D", "E", "F", "G", "A", "H"],
    G: ["G", "A", "H", "C", "D", "E", "F♯"],
    F: ["F", "G", "A", "B", "C", "D", "E"],
  })) {
    await page.locator("#key").selectOption(key);
    await expect(buttons).toHaveText(labels);
  }
  await modes.selectOption("gestures");
  await page.reload();
  await expect(modes).toHaveValue("gestures");
  await expect(buttons.locator("img")).toHaveCount(7);
  for (const width of [1440, 820, 375]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const sizes = await buttons.evaluateAll((elements) =>
      elements.map((el) => ({
        width: el.offsetWidth,
        height: el.offsetHeight,
        imageWidth: el.firstChild.offsetWidth,
        imageHeight: el.firstChild.offsetHeight,
      })),
    );
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(90);
      expect(size.height).toBeGreaterThanOrEqual(110);
      expect(size.imageWidth).toBe(sizes[0].imageWidth);
      expect(size.imageHeight).toBe(sizes[0].imageHeight);
    }
    await page.screenshot({
      path: `test-results/gestures-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("wrong gestures stay grey and blocked; sol answers degree 5 and advances", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "functional-ear-trainer.settings.v1",
      JSON.stringify({ degrees: [5], key: "C", answerNames: "gestures" }),
    ),
  );
  await page.goto("/");
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  const wrong = page.locator('#answers button[data-degree="2"]');
  const correct = page.locator('#answers button[data-degree="5"]');
  const original = await wrong.locator("img").getAttribute("src");
  await wrong.click();
  await expect(wrong).toBeDisabled();
  await expect(wrong).toHaveCSS("filter", "grayscale(1)");
  await expect(wrong).toHaveCSS("opacity", "0.4");
  await expect(wrong.locator("img")).toHaveAttribute("src", original);
  await expect(correct).toBeEnabled();
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/gestures-wrong.png",
    fullPage: true,
  });
  await page.locator("#answer-names").selectOption("digits");
  await page.locator("#answer-names").selectOption("gestures");
  await expect(wrong).toBeDisabled();
  await correct.click();
  await expect(correct).toHaveClass("gesture correct");
  await expect(page.locator("#answers button:enabled")).toHaveCount(0);
  await expect(page.locator("#notation")).toHaveAttribute(
    "aria-label",
    "Zagrany dźwięk: G4",
  );
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(1);
  await expect(page.locator("#score-caption")).toContainText("5–1  /  5–1");
  await expect(page.locator("#step-resolve")).toHaveClass("active");
  await expect(page.locator("#history tr")).toHaveText("1C-dur522");
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 12000 });
  await expect(wrong).toBeEnabled();
  await expect(page.locator("#answers button.wrong")).toHaveCount(0);
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await page.locator("#stop").click();
  expect(errors).toEqual([]);
});
