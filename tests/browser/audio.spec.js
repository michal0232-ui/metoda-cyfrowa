import { test, expect } from "@playwright/test";

test("all piano samples decode before Start; playback uses buffers without requests and 7 repeats an octave lower", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp3")) requests.push(request.url());
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "functional-ear-trainer.settings.v1",
      JSON.stringify({ key: "C", degrees: [7], volume: 0.5 }),
    );
    window.recordings = [];
    window.decodedCount = 0;
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function (data) {
      const buffer = await decode.call(this, data);
      window.decodedCount++;
      return buffer;
    };
    AudioContext.prototype.createOscillator = () => {
      throw new Error("Oscillator must not be used");
    };
    const start = AudioBufferSourceNode.prototype.start;
    const buffers = [];
    AudioBufferSourceNode.prototype.start = function (time) {
      if (!buffers.includes(this.buffer)) buffers.push(this.buffer);
      window.recordings.push({
        buffer: buffers.indexOf(this.buffer),
        rate: this.playbackRate.value,
        time,
      });
      return start.call(this, time);
    };
  });
  // Keep one asset pending to prove Start is gated on the whole instrument.
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/C4.mp3", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.decodedCount)).toBe(13);
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#notation svg")).toHaveCount(1);
  release();
  await expect(page.locator("#start")).toBeEnabled();
  expect(await page.evaluate(() => window.decodedCount)).toBe(14);
  expect(requests).toHaveLength(14);
  // No runtime download should be needed, even without network.
  await page.context().setOffline(true);
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  const before = await page.evaluate(() => window.recordings.length);
  expect(before).toBe(17); // Four 4-note chords and the target.
  await page.keyboard.press("2");
  expect(await page.evaluate(() => window.recordings.length)).toBe(before);
  await page.keyboard.press("7");
  await expect
    .poll(() => page.evaluate(() => window.recordings.length))
    .toBe(21);
  const notes = await page.evaluate(() => window.recordings.slice(-4));
  // AudioParam stores 32-bit floats, while JS computes in 64-bit precision.
  for (const [index, rate] of [
    2 ** (-1 / 12),
    1,
    2 ** (-1 / 12),
    1,
  ].entries()) {
    expect(notes[index].rate).toBeCloseTo(rate, 6);
  }
  expect(notes[0].buffer).toBe(notes[1].buffer);
  expect(notes[2].buffer).toBe(notes[3].buffer);
  expect(notes[0].buffer).not.toBe(notes[2].buffer);
  expect(notes[2].time - notes[1].time).toBeCloseTo(1.08);
  await expect(page.locator("#status")).toHaveText(
    "Za chwilę kolejne zadanie…",
    { timeout: 6000 },
  );
  await page.locator("#stop").click();
  expect(requests).toHaveLength(14);
  expect(errors).toEqual([]);
});

test("missing piano sample prevents training; retry loads only the failed file", async ({
  page,
}) => {
  await page.route("**/C4.mp3", (route) =>
    route.fulfill({ status: 404, body: "Missing sample" }),
  );
  await page.goto("/");
  await expect(page.locator("#retry-audio")).toBeVisible();
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#answers button:enabled")).toHaveCount(0);
  await page.unroute("**/C4.mp3");
  const requests = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp3")) requests.push(request.url());
  });
  await page.locator("#retry-audio").click();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#retry-audio")).toBeHidden();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("/C4.mp3");
});
