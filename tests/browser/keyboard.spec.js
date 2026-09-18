import { test, expect } from "@playwright/test";
async function ready(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  return errors;
}
test("four modes only; piano labels, pitch dots and fixed pitch colors across keys", async ({
  page,
}) => {
  const errors = await ready(page);
  await expect(page.locator("#answer-names option")).toHaveCount(4);
  await expect(page.locator("#answers")).toHaveClass("answers keyboard");
  await expect(page.locator('#answers [data-key-tone="white"]')).toHaveCount(8);
  await expect(page.locator('#answers [data-key-tone="black"]')).toHaveCount(5);
  await expect(page.locator("#answers button")).toHaveCount(8);
  await expect(page.locator(".note-color-dot")).toHaveCount(0);
  await expect(page.locator("#answers button")).toHaveText([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "1",
  ]);
  const before = await page
    .locator('[data-degree="1"]')
    .first()
    .evaluate((el) => ({
      color: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));
  await page.locator("#note-colors").selectOption("on");
  await expect(page.locator(".note-color-dot")).toHaveCount(8);
  expect(
    await page
      .locator('[data-degree="1"]')
      .first()
      .evaluate((el) => ({
        color: getComputedStyle(el).color,
        bg: getComputedStyle(el).backgroundColor,
      })),
  ).toEqual(before);
  await page.locator(".key-picker summary").click();
  await page.locator("#all-keys").click();
  for (const [key, degree] of [
    ["C", "1"],
    ["G", "4"],
    ["F", "5"],
  ]) {
    await page.locator("#key").selectOption(key);
    const c = page.locator('#answers button[data-pitch-class="0"]').first();
    await expect(c).toHaveAttribute("data-degree", degree);
    await expect(c).toHaveText(degree);
    await expect(c.locator(".note-color-dot")).toHaveCSS(
      "background-color",
      "rgb(229, 57, 53)",
    );
  }
  await page.locator("#key").selectOption("G");
  await expect(page.locator('[data-degree="7"]')).toHaveAttribute(
    "data-key-tone",
    "black",
  );
  await expect(page.locator('[data-degree="7"] .note-color-dot')).toHaveCSS(
    "background-color",
    "rgb(23, 107, 58)",
  );
  await page.locator("#answer-names").selectOption("european");
  await expect(page.locator("#answers button")).toHaveText([
    "G",
    "A",
    "H",
    "C",
    "D",
    "E",
    "F♯",
    "G",
  ]);
  await page.locator("#note-colors").selectOption("off");
  await expect(page.locator(".note-color-dot")).toHaveCount(0);
  await page.locator("#note-colors").selectOption("on");
  for (const mode of ["solfege", "gestures"]) {
    await page.locator("#answer-names").selectOption(mode);
    await expect(page.locator("#answers")).not.toHaveClass(/keyboard/);
    await expect(page.locator(".note-color-dot")).toHaveCount(0);
    await expect(page.locator(".unused-key")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test("keyboard color/presentation changes preserve wrong answers, degree identity and colored notehead", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "metoda-cyfrowa.settings",
      JSON.stringify({
        version: 1,
        key: "G",
        degrees: [4],
        answerNames: "digits",
      }),
    ),
  );
  const errors = await ready(page);
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  const wrong = page.locator('[data-degree="1"]').first();
  await wrong.click();
  await expect(wrong).toBeDisabled();
  await expect(wrong).toHaveClass("wrong");
  await expect(page.locator("[data-upper-tonic]")).toBeDisabled();
  await expect(page.locator('[data-degree="1"].wrong')).toHaveCount(2);
  await page.locator("#note-colors").selectOption("on");
  await page.locator("#answer-names").selectOption("european");
  await expect(wrong).toBeDisabled();
  await expect(wrong).toHaveCSS("opacity", "0.4");
  await page.locator("#answer-names").selectOption("digits");
  await page.locator('#answers button[data-pitch-class="0"]').click();
  await expect(page.locator("#score-caption")).toContainText("Stopień 4");
  await expect(page.locator("#absolute-name")).toHaveText("C");
  await expect(page.locator("#notation .vf-notehead")).toHaveCSS(
    "fill",
    "rgb(229, 57, 53)",
  );
  await expect(page.locator("#stat-total")).toHaveText("1");
  await expect(page.locator("#stat-average")).toHaveText("2");
  await page.locator("#stop").click();
  expect(errors).toEqual([]);
});
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [1280, 620],
]) {
  test(`keyboard touch geometry and no scroll at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = await ready(page);
    await page.evaluate(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(Error("blocked"));
    });
    await page.locator("#board-enter").click();
    await page.locator("#board-settings").click();
    await page.locator(".key-picker summary").click();
    await page.locator("#all-keys").click();
    await page.locator("#key").selectOption("G");
    for (const mode of ["digits", "european"])
      for (const colors of ["off", "on"]) {
        await page.locator("#answer-names").selectOption(mode);
        await page.locator("#note-colors").selectOption(colors);
        await page.locator("#board-settings-close").click();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight &&
              document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const boxes = await page.locator("#answers button").evaluateAll((els) =>
          els.map((el) => {
            const b = el.getBoundingClientRect();
            return { width: b.width, height: b.height, bottom: b.bottom };
          }),
        );
        for (const b of boxes) {
          expect(b.width).toBeGreaterThan(70);
          expect(b.height).toBeGreaterThan(80);
          expect(b.bottom).toBeLessThanOrEqual(height);
        }
        await expect(page.locator(".note-color-dot")).toHaveCount(
          colors === "on" ? 8 : 0,
        );
        await page.screenshot({ path: `test-results/keyboard-${width}.png` });
        await page.locator("#board-settings").click();
      }
    expect(errors).toEqual([]);
  });
}

test("tonic endpoints follow every key, including black tonics, on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ready(page);
  await page.locator(".key-picker summary").click();
  await page.locator("#all-keys").click();
  await page.locator("#note-colors").selectOption("on");
  for (const [key, midi] of Object.entries({
    C: 60,
    G: 55,
    D: 62,
    F: 53,
    B: 59,
    "F#": 54,
    Bb: 58,
    Db: 61,
  })) {
    await page.locator("#key").selectOption(key);
    const keys = await page.locator("#answers [data-midi]").evaluateAll((els) =>
      els
        .map((el) => ({
          midi: +el.dataset.midi,
          degree: el.dataset.degree,
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
        }))
        .sort((a, b) => a.midi - b.midi),
    );
    expect(keys.map((k) => k.midi)).toEqual(
      Array.from({ length: 13 }, (_, i) => midi + i),
    );
    expect(keys.filter((k) => k.degree).map((k) => k.degree)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "1",
    ]);
    for (const k of keys) {
      expect(k.left).toBeGreaterThanOrEqual(0);
      expect(k.right).toBeLessThanOrEqual(375);
    }
    const dots = await page
      .locator('[data-degree="1"] .note-color-dot')
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).backgroundColor),
      );
    expect(dots[0]).toBe(dots[1]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("both tonics answer degree one; mixed keyboard is ready before reminder audio", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "metoda-cyfrowa.settings",
      JSON.stringify({
        version: 1,
        keys: ["C", "G"],
        key: "C",
        mixKeys: true,
        degrees: [1],
      }),
    ),
  );
  await ready(page);
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => new URL(e.name).pathname === "/src/audio/engine.js").name;
    const { AudioEngine } = await import(url);
    window.keyboardAtAudio = [];
    AudioEngine.prototype.play = async function (events) {
      window.keyboardAtAudio.push({
        notes: events.at(-1).notes,
        midis: [...document.querySelectorAll('#answers [data-degree="1"]')].map(
          (el) => +el.dataset.midi,
        ),
      });
    };
    const draws = [0, 0, 0, 0.99];
    let i = 0;
    Math.random = () => draws[i++ % 4];
  });
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled();
  await page.locator(".unused-key").first().click();
  await expect(page.locator("#stat-total")).toHaveText("0");
  await expect(page.locator("#answers button.wrong")).toHaveCount(0);
  await page.locator("[data-upper-tonic]").click();
  await expect(page.locator("#stat-total")).toHaveText("1");
  await expect(page.locator('[data-degree="1"].correct')).toHaveCount(2);
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 6000 });
  await expect(page.locator("#answers")).toHaveAttribute("data-layout", "G");
  await page.locator('[data-degree="1"]').first().click();
  await expect(page.locator("#stat-total")).toHaveText("2");
  const calls = await page.evaluate(() => window.keyboardAtAudio);
  expect(calls[0].midis).toEqual([60, 72]);
  expect(calls[2].midis).toEqual([55, 67]);
  await page.locator("#stop").click();
});
