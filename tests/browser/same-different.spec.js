import { test, expect } from "@playwright/test";
async function ready(page, kind, real = false) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(
    async ({ kind, real }) => {
      const module = async (path) =>
        import(
          performance
            .getEntriesByType("resource")
            .find((e) => new URL(e.name).pathname === path).name
        );
      const { AudioEngine } = await module("/src/audio/engine.js");
      const play = AudioEngine.prototype.play;
      const schedule = window.AudioBufferSourceNode.prototype.start;
      const stop = window.AudioBufferSourceNode.prototype.stop;
      window.pairAudit = { calls: [], active: 0, max: 0, starts: [], ends: [] };
      AudioBufferSourceNode.prototype.start = function (time, ...args) {
        window.pairAudit.starts.push(time);
        return schedule.call(this, time, ...args);
      };
      AudioBufferSourceNode.prototype.stop = function (time, ...args) {
        window.pairAudit.ends.push(time);
        return stop.call(this, time, ...args);
      };
      AudioEngine.prototype.play = async function (events, signal, onEvent) {
        const audit = window.pairAudit;
        audit.calls.push(events);
        audit.max = Math.max(audit.max, ++audit.active);
        try {
          if (real) return await play.call(this, events, signal, onEvent);
          await new Promise((resolve) => setTimeout(resolve, 200));
        } finally {
          audit.active--;
        }
      };
      const values = [0, kind === "same" ? 0.1 : 0.9, 0.99];
      let i = 0;
      Math.random = () => values[i++ % values.length];
    },
    { kind, real },
  );
  await page.locator("#exercise-select").selectOption("same-different");
  return errors;
}
async function noPitchInformation(page) {
  await expect(page.locator(".workspace")).toBeHidden();
  await expect(page.locator("#notation")).toBeHidden();
  await expect(page.locator("#answers")).toBeHidden();
  await expect(
    page.locator(
      "#same-different svg, #same-different img, #same-different [data-midi], #same-different .note-color-dot",
    ),
  ).toHaveCount(0);
  await expect(page.locator("#board-settings")).toBeHidden();
  await expect(page.locator("#same-different")).not.toContainText(
    /MIDI|C4|D4|Tonacja|Kadencja/,
  );
}
for (const kind of ["same", "different"])
  test(`pair ${kind}: real piano, exact silence, independent replays, retry and separate statistics`, async ({
    page,
  }) => {
    test.setTimeout(40000);
    const errors = await ready(page, kind, true);
    await noPitchInformation(page);
    await page.locator("#pair-start").click();
    await expect(page.locator("#pair-one")).toBeDisabled();
    await expect(page.locator('[data-pair-answer="same"]')).toBeDisabled();
    await expect(page.locator("#pair-one")).toBeEnabled({ timeout: 6000 });
    const initial = await page.evaluate(() => window.pairAudit);
    const notes = initial.calls[0].map((e) => e.notes[0]);
    expect(notes[0] === notes[1]).toBe(kind === "same");
    expect(initial.starts[1] - initial.ends[0]).toBeCloseTo(1, 10);
    const wrong = kind === "same" ? "different" : "same";
    await page.locator(`[data-pair-answer="${wrong}"]`).click();
    await expect(page.locator(`[data-pair-answer="${wrong}"]`)).toHaveClass(
      "wrong",
    );
    await expect(page.locator("#pair-total")).toHaveText("0");
    await expect(page.locator(`[data-pair-answer="${kind}"]`)).not.toHaveClass(
      "correct",
    );
    for (const index of [0, 1, 0, 1]) {
      const button = page.locator(index === 0 ? "#pair-one" : "#pair-two");
      await button.click();
      await expect(page.locator("#pair-one")).toBeDisabled();
      await page.locator("#pair-two").dispatchEvent("click");
      await page.locator(`[data-pair-answer="${kind}"]`).dispatchEvent("click");
      await expect(page.locator("#pair-one")).toBeEnabled();
      expect(
        (await page.evaluate(() => window.pairAudit.calls.at(-1)))[0].notes,
      ).toEqual([notes[index]]);
      await expect(page.locator("#pair-total")).toHaveText("0");
      await noPitchInformation(page);
    }
    expect(await page.evaluate(() => window.pairAudit.max)).toBe(1);
    expect(await page.evaluate(() => window.pairAudit.calls.length)).toBe(5);
    await page.locator(`[data-pair-answer="${kind}"]`).click();
    await expect(page.locator(`[data-pair-answer="${kind}"]`)).toHaveClass(
      "correct",
    );
    await expect(page.locator("#pair-total")).toHaveText("1");
    await expect(page.locator("#pair-first")).toHaveText("0");
    await expect(page.locator("#pair-history li")).toContainText("Próby: 2");
    await expect(page.locator("#stat-total")).toHaveText("0");
    // The next call is a fresh pair, never a degree resolution or cadence.
    await expect
      .poll(() => page.evaluate(() => window.pairAudit.calls.length))
      .toBe(6);
    expect(
      (await page.evaluate(() => window.pairAudit.calls.at(-1))).map(
        (e) => e.notes.length,
      ),
    ).toEqual([1, 1]);
    await page.locator("#pair-stop").click();
    await page.locator("#exercise-select").selectOption("major-degrees");
    await expect(page.locator("#start")).toBeEnabled();
    await expect(page.locator(".workspace")).toBeVisible();
    await expect(page.locator("#same-different")).toBeHidden();
    expect(errors).toEqual([]);
  });
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [1280, 620],
  [375, 812],
])
  test(`pair board touch layout and switching at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = await ready(page, "same");
    await page.evaluate(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(Error("unavailable"));
    });
    await page.locator("#board-enter").click();
    await page.locator("#pair-start").click();
    await expect(page.locator("#pair-one")).toBeEnabled();
    await noPitchInformation(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const el of await page
      .locator(".pair-replays button, .pair-answers button")
      .all()) {
      const box = await el.boundingBox();
      expect(box.width).toBeGreaterThan(100);
      expect(box.height).toBeGreaterThan(70);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await page.locator('[data-pair-answer="same"]').click();
    await expect(page.locator("#pair-first")).toHaveText("1");
    await page.locator("#board-exercise-select").selectOption("major-degrees");
    await expect(page.locator("#board-settings")).toBeVisible();
    await expect(page.locator("#start")).toBeEnabled();
    await page.locator("#board-exercise-select").selectOption("same-different");
    await expect(page.locator("#pair-total")).toHaveText("1");
    await expect(page.locator("#pair-start")).toBeEnabled();
    await page.screenshot({ path: `/tmp/pair-board-${width}-${height}.png` });
    expect(errors).toEqual([]);
  });

for (const [first, expected] of [
  [0, [36, 37]],
  [0.999, [83, 82]],
]) {
  test(`chromatic boundary ${expected[0]} uses real samples and exact silence`, async ({
    page,
  }) => {
    const errors = await ready(page, "different", true);
    await page.evaluate((first) => {
      const draws = [first, 0.9, 0.1, 0.5];
      let i = 0;
      Math.random = () => draws[i++ % draws.length];
      AudioContext.prototype.createOscillator = () => {
        throw new Error("Oscillators forbidden");
      };
    }, first);
    await page.locator("#pair-start").click();
    await expect(page.locator("#pair-one")).toBeEnabled({ timeout: 6000 });
    const audit = await page.evaluate(() => window.pairAudit);
    expect(audit.calls[0].map((e) => e.notes[0])).toEqual(expected);
    expect(audit.starts).toHaveLength(2);
    expect(audit.starts[1] - audit.ends[0]).toBeCloseTo(1, 10);
    await noPitchInformation(page);
    await page.locator("#pair-stop").click();
    expect(errors).toEqual([]);
  });
}
