import { test, expect } from "@playwright/test";

async function setup(page, settings) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(
    (s) => {
      localStorage.setItem(
        "functional-ear-trainer.settings.v1",
        JSON.stringify(s),
      );
      AudioContext.prototype.createOscillator = () => {
        throw new Error("No oscillator");
      };
    },
    { degrees: [1], key: "C", reminderKind: "tonic", ...settings },
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(async () => {
    // Vite can append an HMR timestamp; instrument the exact module used by the app.
    const url = performance
      .getEntriesByType("resource")
      .find(
        (entry) => new URL(entry.name).pathname === "/src/audio/engine.js",
      ).name;
    const { AudioEngine } = await import(url);
    const play = AudioEngine.prototype.play;
    window.audioCalls = [];
    AudioEngine.prototype.play = async function (events, ...args) {
      const call = { events, start: performance.now() };
      window.audioCalls.push(call);
      try {
        return await play.call(this, events, ...args);
      } finally {
        call.end = performance.now();
      }
    };
  });
  return errors;
}
for (const every of [0, 1, 3]) {
  test(`real audio: initial cadence, tonic every ${every}, repeat, ordering and session reset`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    const errors = await setup(page, { reminderEvery: every });
    await page.locator("#start").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    expect(
      await page.evaluate(() =>
        window.audioCalls[0].events.map((e) => e.notes.length),
      ),
    ).toEqual([4, 4, 4, 4, 4, 0, 1]);
    const count = every === 3 ? 3 : 1;
    for (let i = 1; i <= count; i++) {
      await page.locator('[data-degree="2"]').click();
      await expect(page.locator('[data-degree="2"]')).toBeDisabled();
      await page.locator('[data-degree="1"]').click();
      await expect(page.locator("#repeat")).toBeEnabled({ timeout: 10000 });
      const calls = await page.evaluate(() => window.audioCalls);
      const next = calls.at(-1),
        solution = calls.at(-2);
      expect(next.start - solution.end).toBeGreaterThanOrEqual(2950);
      expect(next.events.map((e) => e.notes.length)).toEqual(
        every > 0 && i % every === 0 ? [1, 0, 1] : [1],
      );
      expect(next.events.at(-1).notes).toEqual([60]);
      if (next.events.length > 1) expect(next.events[0].notes).toEqual([48]);
      for (let j = 1; j < calls.length; j++)
        expect(calls[j].start).toBeGreaterThanOrEqual(calls[j - 1].end);
    }
    const previous = await page.evaluate(() => window.audioCalls.at(-1).events);
    await page.locator("#repeat").click();
    await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
    expect(await page.evaluate(() => window.audioCalls.at(-1).events)).toEqual(
      previous,
    );
    await expect(page.locator("#stat-total")).toHaveText(String(count));
    await page.locator("#stop").click();
    await page.locator("#start").click();
    expect(
      await page.evaluate(() =>
        window.audioCalls.at(-1).events.map((e) => e.notes.length),
      ),
    ).toEqual([4, 4, 4, 4, 4, 0, 1]);
    await page.locator("#stop").click();
    expect(errors).toEqual([]);
  });
}
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
]) {
  test(`reminder settings persist in board dialog without page scroll ${width}`, async ({
    page,
  }) => {
    const errors = await setup(page, {});
    await page.setViewportSize({ width, height });
    await page.locator("#reminder-kind").selectOption("tonic");
    await page.locator("#reminder-every").selectOption("3");
    // Init script seeds storage on reload; remove it by using a fresh page in same context.
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("functional-ear-trainer.settings.v1")),
    );
    expect(saved.reminderEvery).toBe(3);
    await page.evaluate(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error("Denied"));
    });
    await page.locator("#board-enter").click();
    await page.locator("#board-settings").click();
    await expect(page.locator("#reminder-kind")).toHaveValue("tonic");
    await expect(page.locator("#reminder-every")).toHaveValue("3");
    await page.locator("#reminder-every").selectOption("0");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.locator("#board-settings-close").click();
    await page.locator("#start").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.locator("#stop").click();
    // Reload persistence without the seed script rewriting localStorage.
    const fresh = await page.context().newPage();
    await fresh.goto("/");
    await expect(fresh.locator("#reminder-kind")).toHaveValue("tonic");
    await expect(fresh.locator("#reminder-every")).toHaveValue("0");
    await fresh.close();
    expect(errors).toEqual([]);
  });
}
