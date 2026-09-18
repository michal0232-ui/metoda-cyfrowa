import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const key = "metoda-cyfrowa.settings";
const legacy = "functional-ear-trainer.settings.v1";
const custom = {
  key: "G",
  keys: ["G", "F"],
  degrees: [1],
  mixKeys: true,
  answerNames: "gestures",
  noteColors: true,
  reminderKind: "tonic",
  reminderEvery: 3,
  volume: 0.3,
};
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
}
async function values(page) {
  await expect(page.locator("#key")).toHaveValue("G");
  await expect(page.locator("#mix-keys")).toBeChecked();
  await expect(page.locator("#answer-names")).toHaveValue("gestures");
  await expect(page.locator("#note-colors")).toHaveValue("on");
  await expect(page.locator("#reminder-kind")).toHaveValue("tonic");
  await expect(page.locator("#reminder-every")).toHaveValue("3");
  await expect(page.locator("#volume")).toHaveValue("30");
  await expect(page.locator("#degree-toggles input:checked")).toHaveCount(1);
}
test("migration, reload, new session and absence of transient state", async ({
  page,
}) => {
  await page.addInitScript(
    ({ legacy, custom }) =>
      localStorage.setItem(legacy, JSON.stringify(custom)),
    { legacy, custom },
  );
  await ready(page);
  await values(page);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
  ).toEqual({ version: 1, ...custom });
  expect(
    await page.evaluate((legacy) => localStorage.getItem(legacy), legacy),
  ).toBeNull();
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await page.locator('[data-degree="2"]').click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
  ).toEqual({ version: 1, ...custom });
  await page.locator('[data-degree="1"]').first().click();
  await expect(page.locator("#stat-total")).toHaveText("1");
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
  ).toEqual({ version: 1, ...custom });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await values(page);
  await expect(page.locator("#stop")).toBeDisabled();
  await expect(page.locator("#stat-total")).toHaveText("0");
  await expect(
    page.locator("#answers .wrong, #notation .vf-stavenote"),
  ).toHaveCount(0);
});
test("reset confirmation works in both views, cancel preserves data, defaults persist", async ({
  page,
}) => {
  await ready(page);
  for (const board of [false, true]) {
    await page.locator("#answer-names").selectOption("gestures");
    await page.locator("#note-colors").selectOption("on");
    await page.locator("#volume").fill("25");
    if (board) {
      await page.evaluate(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(Error("blocked"));
      });
      await page.locator("#board-enter").click();
      await page.locator("#board-settings").click();
    }
    const before = await page.evaluate((key) => localStorage.getItem(key), key);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#reset-settings").click();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      before,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#reset-settings").click();
    await expect(page.locator("#answer-names")).toHaveValue("digits");
    await expect(page.locator("#note-colors")).toHaveValue("off");
    await expect(page.locator("#volume")).toHaveValue("50");
    await expect(page.locator("#reminder-kind")).toHaveValue("cadence");
    await expect(page.locator("#reminder-every")).toHaveValue("1");
    await expect(page.locator("#degree-toggles input:checked")).toHaveCount(7);
    if (board) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await page.locator("#board-settings-close").click();
      await page.locator("#board-exit").click();
    }
    await page.reload();
    await expect(page.locator("#start")).toBeEnabled();
    await expect(page.locator("#answer-names")).toHaveValue("digits");
  }
});
test("preferences survive closing browser and reopening the same disk profile", async () => {
  const directory = await mkdtemp(join(tmpdir(), "metoda-settings-"));
  let context;
  try {
    const options = {
      channel: "chrome",
      headless: true,
      baseURL: "http://127.0.0.1:5173",
    };
    context = await chromium.launchPersistentContext(directory, options);
    let page = await context.newPage();
    await ready(page);
    await page.locator(".key-picker summary").click();
    await page.getByLabel("Tonacja G-dur", { exact: true }).check();
    await page.getByLabel("Tonacja F-dur", { exact: true }).check();
    await page.getByLabel("Tonacja C-dur", { exact: true }).uncheck();
    await page.locator("#mix-keys").check();
    for (let d = 2; d <= 7; d++)
      await page.getByLabel(`Ćwicz stopień ${d}`, { exact: true }).uncheck();
    await page.locator("#answer-names").selectOption("gestures");
    await page.locator("#note-colors").selectOption("on");
    await page.locator("#reminder-kind").selectOption("tonic");
    await page.locator("#reminder-every").selectOption("3");
    await page.locator("#volume").fill("30");
    await context.close();
    context = null;
    context = await chromium.launchPersistentContext(directory, options);
    page = await context.newPage();
    await ready(page);
    await values(page);
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
    ).toEqual({ version: 1, ...custom });
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  } finally {
    await context?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("corrupt storage and denied storage do not prevent startup", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{broken"), key);
  await ready(page);
  await expect(page.locator("#answer-names")).toHaveValue("digits");
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Denied");
      },
    });
  });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#answer-names").selectOption("solfege");
  await expect(page.locator('[data-degree="1"]').first()).toHaveText("do");
});
