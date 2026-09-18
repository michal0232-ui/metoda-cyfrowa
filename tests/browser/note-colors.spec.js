import { test, expect } from "@playwright/test";

async function ready(page, settings) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  if (settings)
    await page.addInitScript(
      (s) =>
        localStorage.setItem(
          "functional-ear-trainer.settings.v1",
          JSON.stringify(s),
        ),
      settings,
    );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  return errors;
}
async function bands(page) {
  return page
    .locator(".note-color-band")
    .evaluateAll((els) => els.map((el) => el.style.backgroundColor));
}
const cColors = [
  "rgb(229, 57, 53)",
  "rgb(245, 130, 32)",
  "rgb(249, 214, 53)",
  "rgb(54, 166, 87)",
  "rgb(36, 116, 210)",
  "rgb(128, 70, 181)",
  "rgb(239, 135, 181)",
];
test("colors default off, remain independent in every mode, transpose and survive reload", async ({
  page,
}) => {
  const errors = await ready(page);
  await expect(page.locator("#note-colors")).toHaveValue("off");
  for (const mode of ["digits", "solfege", "european", "gestures"]) {
    await page.locator("#answer-names").selectOption(mode);
    await expect(page.locator(".note-color-band")).toHaveCount(0);
    const height = await page
      .locator("#answers")
      .evaluate((el) => el.offsetHeight);
    await page.locator("#note-colors").selectOption("on");
    expect(await bands(page)).toEqual(mode === "european" ? cColors : []);
    if (mode === "gestures")
      await expect(page.locator("#answers img")).toHaveCount(7);
    await page.locator("#note-colors").selectOption("off");
    await expect(page.locator(".note-color-band")).toHaveCount(0);
    expect(
      await page.locator("#answers").evaluate((el) => el.offsetHeight),
    ).toBe(height);
  }
  await page.locator("#note-colors").selectOption("on");
  await page.locator(".key-picker summary").click();
  await page.getByLabel("Tonacja G-dur", { exact: true }).check();
  await page.locator("#key").selectOption("G");
  await expect(page.locator(".note-color-band")).toHaveCount(0);
  await page.locator("#answer-names").selectOption("european");
  expect(await bands(page)).toEqual([
    cColors[4],
    cColors[5],
    cColors[6],
    cColors[0],
    cColors[1],
    cColors[2],
    "rgb(23, 107, 58)",
  ]);
  await page.reload();
  await expect(page.locator("#note-colors")).toHaveValue("on");
  await expect(page.locator("#answer-names")).toHaveValue("european");
  await expect(page.locator(".note-color-band")).toHaveCount(7);
  expect((await bands(page))[0]).toBe(cColors[4]);
  expect(errors).toEqual([]);
});

for (const noteColors of [false, true]) {
  test(`3–2–1 visual playback, three-second hold and cancellation; colors=${noteColors}`, async ({
    page,
  }) => {
    const errors = await ready(page, { degrees: [3], key: "C", noteColors });
    await page.evaluate(() => {
      window.visualHistory = [];
      window.exposure = {};
      new MutationObserver(() => {
        const active = document.querySelector(".resolution-note.playing");
        if (active) {
          const midi = Number(active.dataset.midi);
          if (window.visualHistory.at(-1) !== midi)
            window.visualHistory.push(midi);
        }
        const status = document.querySelector("#status").textContent;
        if (status === "Za chwilę kolejne zadanie…" && !window.exposure.end)
          window.exposure.end = performance.now();
        if (
          window.exposure.end &&
          status === "Posłuchaj kadencji i pojedynczego dźwięku…" &&
          !window.exposure.next
        )
          window.exposure.next = performance.now();
      }).observe(document.querySelector(".trainer"), {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    });
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    await page.locator('[data-degree="2"]').click();
    await expect(page.locator("#resolution")).not.toBeVisible();
    await page.locator('[data-degree="3"]').click();
    await expect(page.locator(".resolution-sequence")).toHaveCount(1);
    await expect(page.locator(".resolution-note")).toHaveText(["3", "2", "1"]);
    const backgrounds = await page
      .locator(".resolution-note")
      .evaluateAll((els) => els.map((e) => e.style.backgroundColor));
    expect(backgrounds).toEqual(["", "", ""]);
    await expect(page.locator("#notation .vf-notehead")).toHaveCSS(
      "fill",
      noteColors ? cColors[2] : "rgb(0, 0, 0)",
    );
    if (noteColors) {
      await expect(page.locator("#absolute-name")).toHaveText("E");
      await expect(page.locator("#absolute-swatch")).toHaveCSS(
        "background-color",
        cColors[2],
      );
    } else await expect(page.locator("#absolute-answer")).toBeHidden();
    await expect(page.locator("#status")).toHaveText(
      "Za chwilę kolejne zadanie…",
      { timeout: 6000 },
    );
    await expect(page.locator(".resolution-note.playing")).toHaveCount(0);
    expect(await page.evaluate(() => window.visualHistory)).toEqual([
      64, 62, 60,
    ]);
    await expect(page.locator("#resolution")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.exposure.next)), {
        timeout: 5000,
      })
      .toBe(true);
    const exposure = await page.evaluate(
      () => window.exposure.next - window.exposure.end,
    );
    expect(exposure).toBeGreaterThanOrEqual(2950);
    expect(exposure).toBeLessThan(3600);
    await expect(page.locator("#resolution")).not.toBeVisible();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    await page.locator('[data-degree="3"]').click();
    await expect(page.locator(".resolution-note.playing")).toHaveCount(1);
    await page.locator("#stop").click();
    await expect(page.locator(".resolution-note")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
for (const [degree, phrases, midis] of [
  [5, ["51", "51"], [67, 60, 67, 72]],
  [6, ["651", "671"], [69, 67, 60, 69, 71, 72]],
  [7, ["71", "71"], [71, 72, 59, 60]],
]) {
  test(`degree ${degree}: separate original phrases and pitch colors`, async ({
    page,
  }) => {
    const errors = await ready(page, {
      degrees: [degree],
      noteColors: true,
      key: "C",
    });
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    await page.locator(`[data-degree="${degree}"]`).click();
    await expect(page.locator(".resolution-sequence")).toHaveText(phrases);
    expect(
      await page
        .locator(".resolution-note")
        .evaluateAll((els) => els.map((e) => Number(e.dataset.midi))),
    ).toEqual(midis);
    if (degree === 7) {
      const colors = await page
        .locator(".resolution-note")
        .evaluateAll((els) => els.map((e) => e.style.backgroundColor));
      expect(colors).toEqual(["", "", "", ""]);
    }
    await page.locator("#note-colors").selectOption("off");
    await expect(page.locator(".resolution-sequence")).toHaveText(phrases);
    expect(
      await page
        .locator(".resolution-note")
        .evaluateAll((els) => els.every((e) => !e.style.backgroundColor)),
    ).toBe(true);
    await page.locator("#stop").click();
    expect(errors).toEqual([]);
  });
}
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
]) {
  test(`board colors and neutral solution never scroll or move answers at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error("Denied"));
    });
    const errors = await ready(page, {
      degrees: [6],
      key: "C",
      answerNames: "gestures",
    });
    await page.locator("#board-enter").click();
    async function fits() {
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
        .locator("#answers button, #notation, #resolution")
        .evaluateAll((els) =>
          els.map((e) => {
            const b = e.getBoundingClientRect();
            return {
              top: b.top,
              bottom: b.bottom,
              left: b.left,
              right: b.right,
            };
          }),
        );
      for (const box of boxes) {
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(height);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
      }
    }
    await fits();
    await page.locator("#board-settings").click();
    for (const mode of ["digits", "solfege", "european", "gestures"]) {
      await page.locator("#answer-names").selectOption(mode);
      for (const state of ["on", "off"]) {
        await page.locator("#note-colors").selectOption(state);
        await expect(page.locator(".note-color-band")).toHaveCount(
          state === "on" && mode === "european" ? 7 : 0,
        );
      }
    }
    await page.locator("#board-settings-close").click();
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    const before = await page.locator("#answers").boundingBox();
    await page.locator('[data-degree="6"]').click();
    await expect(page.locator(".resolution-sequence")).toHaveText([
      "651",
      "671",
    ]);
    await fits();
    expect(await page.locator("#answers").boundingBox()).toEqual(before);
    await page.locator("#board-settings").click();
    await page.locator("#note-colors").selectOption("on");
    await page.locator("#board-settings-close").click();
    await fits();
    expect(await page.locator("#answers").boundingBox()).toEqual(before);
    await expect(page.locator("#absolute-name")).toHaveText("A");
    await expect(page.locator("#absolute-swatch")).toHaveCSS(
      "background-color",
      cColors[5],
    );
    expect(
      await page
        .locator(".resolution-note")
        .evaluateAll((els) => els.every((el) => !el.style.backgroundColor)),
    ).toBe(true);
    await page.screenshot({ path: `test-results/colors-board-${width}.png` });
    await page.locator("#stop").click();
    expect(errors).toEqual([]);
  });
}

for (const [key, degree, name, color] of [
  ["C", 1, "C", cColors[0]],
  ["G", 1, "G", cColors[4]],
  ["F", 5, "C", cColors[0]],
]) {
  test(`relative answers stay neutral; ${key} degree ${degree} reveals ${name}`, async ({
    page,
  }) => {
    const errors = await ready(page, {
      key,
      degrees: [degree],
      noteColors: true,
    });
    for (const mode of ["digits", "solfege", "gestures"]) {
      await page.locator("#answer-names").selectOption(mode);
      await expect(
        page.locator(".note-color-band, .has-note-color"),
      ).toHaveCount(0);
      expect(
        await page
          .locator("#answers button")
          .evaluateAll(
            (els) =>
              new Set(els.map((el) => getComputedStyle(el).backgroundColor))
                .size,
          ),
      ).toBe(1);
    }
    const staveBefore = await page.locator("#notation .vf-stave").innerHTML();
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    await page.locator(`[data-degree="${degree}"]`).click();
    await expect(page.locator("#absolute-name")).toHaveText(name);
    await expect(page.locator("#absolute-swatch")).toHaveCSS(
      "background-color",
      color,
    );
    await expect(page.locator("#notation .vf-notehead")).toHaveCSS(
      "fill",
      color,
    );
    // The complete stave, clef and signature remain unchanged apart from generated IDs.
    const normalize = (html) => html.replace(/id="[^"]*"/g, "");
    expect(
      normalize(await page.locator("#notation .vf-stave").innerHTML()),
    ).toBe(normalize(staveBefore));
    await page.locator("#note-colors").selectOption("off");
    await expect(page.locator("#absolute-answer")).toBeHidden();
    await expect(page.locator("#notation .vf-notehead")).toHaveCSS(
      "fill",
      "rgb(0, 0, 0)",
    );
    await page.locator("#stop").click();
    expect(errors).toEqual([]);
  });
}
