import { test, expect } from "@playwright/test";

async function setup(
  page,
  degree,
  mode = "digits",
  colors = true,
  real = false,
) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(
    (s) => localStorage.setItem("metoda-cyfrowa.settings", JSON.stringify(s)),
    {
      version: 1,
      key: "G",
      degrees: [degree],
      answerNames: mode,
      noteColors: colors,
      reminderEvery: 1,
    },
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(
    async ({ real }) => {
      const module = async (path) =>
        import(
          performance
            .getEntriesByType("resource")
            .find((e) => new URL(e.name).pathname === path).name
        );
      const { AudioEngine } = await module("/src/audio/engine.js");
      const { majorDegrees } = await module("/src/exercises/major-degrees.js");
      const { TonalitySession } = await module(
        "/src/exercises/tonality-session.js",
      );
      const play = AudioEngine.prototype.play,
        generate = majorDegrees.resolutionEvents,
        create = majorDegrees.createQuestion,
        complete = TonalitySession.prototype.complete;
      window.hintAudit = {
        calls: [],
        generated: [],
        draws: 0,
        completions: 0,
        active: 0,
        max: 0,
      };
      majorDegrees.createQuestion = (...args) => {
        window.hintAudit.draws++;
        return create(...args);
      };
      majorDegrees.resolutionEvents = (...args) => {
        const events = generate(...args);
        window.hintAudit.generated.push(events);
        return events;
      };
      TonalitySession.prototype.complete = function (...args) {
        window.hintAudit.completions++;
        return complete.apply(this, args);
      };
      AudioEngine.prototype.play = async function (events, signal, callback) {
        const audit = window.hintAudit;
        audit.calls.push({ events, visual: !!callback });
        audit.max = Math.max(audit.max, ++audit.active);
        try {
          if (real) return await play.call(this, events, signal, callback);
          await new Promise((resolve) => setTimeout(resolve, 200));
        } finally {
          audit.active--;
        }
      };
    },
    { real },
  );
  return errors;
}
async function hidden(page) {
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await expect(page.locator("#absolute-answer")).toBeHidden();
  await expect(page.locator(".resolution-note")).toHaveCount(0);
  await expect(page.locator("#answers .correct")).toHaveCount(0);
  await expect(page.locator("#stat-total")).toHaveText("0");
  await expect(page.locator("#history tr")).toHaveCount(0);
  await expect(page.locator("#score-caption")).toHaveText(
    "Nuta pojawi się po poprawnej odpowiedzi.",
  );
}
for (const degree of [1, 2, 3, 4, 5, 6, 7]) {
  test(`audio hint uses production solution for hidden degree ${degree} without changing question`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    const errors = await setup(page, degree, "digits", true, degree === 7);
    const hint = page.locator("#resolution-hint");
    await expect(hint).toBeDisabled();
    await page.locator("#start").click();
    await expect(hint).toBeDisabled();
    await expect(hint).toBeEnabled({ timeout: 8000 });
    const wrong = degree === 2 ? 3 : 2;
    await page.locator(`[data-degree="${wrong}"]`).click();
    const before = await page.locator("#answers").innerHTML();
    for (let n = 0; n < 2; n++) {
      await hint.click();
      await expect(hint).toBeDisabled();
      await expect(page.locator("#repeat")).toBeDisabled();
      await hidden(page);
      // Even synthetic clicks / keyboard input cannot start parallel audio or answer.
      await hint.dispatchEvent("click");
      await page.locator("#repeat").dispatchEvent("click");
      await page.keyboard.press(String(degree));
      await expect(hint).toBeEnabled({ timeout: 10000 });
      await hidden(page);
      expect(await page.locator("#answers").innerHTML()).toBe(before);
    }
    const audit = await page.evaluate(() => window.hintAudit);
    expect(audit.draws).toBe(1);
    expect(audit.completions).toBe(0);
    expect(audit.max).toBe(1);
    expect(audit.calls).toHaveLength(3);
    expect(audit.generated).toHaveLength(2);
    expect(audit.calls[1]).toEqual({
      events: audit.generated[0],
      visual: false,
    });
    expect(audit.calls[2]).toEqual({
      events: audit.generated[1],
      visual: false,
    });
    await page.locator(`[data-degree="${degree}"]`).first().click();
    await expect(page.locator("#stat-total")).toHaveText("1");
    await expect(page.locator("#stat-average")).toHaveText("2");
    await expect(page.locator("#notation .vf-stavenote")).toHaveCount(1);
    const solved = await page.evaluate(() => window.hintAudit);
    expect(solved.completions).toBe(1);
    expect(solved.calls[3]).toEqual({
      events: audit.generated[0],
      visual: true,
    });
    await page.locator("#stop").click();
    expect(errors).toEqual([]);
  });
}
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [1280, 620],
]) {
  test(`hint fits board and reveals nothing in all modes/colors at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = await setup(page, 4);
    await page.evaluate(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(Error("unavailable"));
    });
    await page.locator("#board-enter").click();
    await page.locator("#start").click();
    await expect(page.locator("#resolution-hint")).toBeEnabled();
    for (const mode of ["digits", "european", "solfege", "gestures"])
      for (const colors of ["off", "on"]) {
        await page.locator("#board-settings").click();
        await page.locator("#answer-names").selectOption(mode);
        await page.locator("#note-colors").selectOption(colors);
        await page.locator("#board-settings-close").click();
        const before = await page.locator("#answers").innerHTML();
        await page.locator("#resolution-hint").click();
        await hidden(page);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight &&
              document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const box = await page.locator("#resolution-hint").boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
        await expect(page.locator("#resolution-hint")).toBeEnabled();
        expect(await page.locator("#answers").innerHTML()).toBe(before);
      }
    await page.locator("#resolution-hint").click();
    await page.locator("#stop").click();
    await page.waitForTimeout(300);
    await expect(page.locator("#resolution-hint")).toBeDisabled();
    await expect(page.locator("#start")).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
