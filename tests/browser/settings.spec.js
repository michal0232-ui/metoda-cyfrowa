import { test, expect } from "@playwright/test";

test("selected keys, mixing, names and degrees survive reload; pool cannot be empty", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator(".key-picker summary").click();
  await page.getByLabel("Tonacja G-dur", { exact: true }).check();
  await page.getByLabel("Tonacja F-dur", { exact: true }).check();
  await page.getByLabel("Tonacja C-dur", { exact: true }).uncheck();
  await page.locator("#key").selectOption("F");
  await page.locator("#mix-keys").check();
  await page.locator("#answer-names").selectOption("european");
  await page.getByLabel("Ćwicz stopień 3", { exact: true }).uncheck();
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#mix-keys")).toBeChecked();
  await expect(page.locator("#key")).toBeDisabled();
  await expect(page.locator("#key")).toHaveValue("F");
  await expect(page.locator("#answer-names")).toHaveValue("european");
  await expect(
    page.getByLabel("Ćwicz stopień 3", { exact: true }),
  ).not.toBeChecked();
  await page.locator(".key-picker summary").click();
  await expect(page.getByLabel("Tonacja G-dur", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Tonacja F-dur", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("Tonacja C-dur", { exact: true }),
  ).not.toBeChecked();
  await page.locator("#all-keys").click();
  await expect(page.locator("#key-toggles input:checked")).toHaveCount(13);
  await page.locator("#only-key").click();
  await expect(page.locator("#key-toggles input:checked")).toHaveCount(1);
  await page.getByLabel("Tonacja F-dur", { exact: true }).click();
  await expect(page.getByLabel("Tonacja F-dur", { exact: true })).toBeChecked();
});

test("names follow mixed task keys; switching presentation preserves wrong attempts and solution", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "functional-ear-trainer.settings.v1",
      JSON.stringify({
        keys: ["G", "F"],
        key: "G",
        mixKeys: true,
        degrees: [7],
        answerNames: "european",
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  // Deterministic exercise draws after library setup: degree then key, repeated.
  await page.evaluate(() => {
    const values = [0, 0, 0, 0.999];
    let i = 0;
    Math.random = () => values[i++ % values.length];
  });
  await page.locator("#start").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await expect(page.locator("#key-badge")).toHaveText("G-dur");
  await expect(page.locator("#answers button")).toHaveText([
    "G",
    "A",
    "H",
    "C",
    "D",
    "E",
    "F♯",
  ]);
  await page.locator('#answers button[data-degree="2"]').click();
  await page.locator("#answer-names").selectOption("solfege");
  await expect(page.locator("#answers button")).toHaveText([
    "do",
    "re",
    "mi",
    "fa",
    "sol",
    "la",
    "si",
  ]);
  await expect(page.locator('#answers button[data-degree="2"]')).toBeDisabled();
  await expect(page.locator("#notation .vf-stavenote")).toHaveCount(0);
  await page.locator("#repeat").click();
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 8000 });
  await expect(page.locator("#key-badge")).toHaveText("G-dur");
  await page.locator('#answers button[data-degree="7"]').click();
  await expect(page.locator("#history tr")).toHaveText("1G-dur722");
  await expect(page.locator("#notation")).toHaveAttribute(
    "aria-label",
    "Zagrany dźwięk: Fis4",
  );
  await page.locator("#answer-names").selectOption("digits");
  await expect(page.locator('#answers button[data-degree="7"]')).toHaveClass(
    "correct",
  );
  await expect(page.locator("#repeat")).toBeEnabled({ timeout: 12000 });
  await expect(page.locator("#key-badge")).toHaveText("F-dur");
  await page.locator("#answer-names").selectOption("european");
  await expect(page.locator("#answers button")).toHaveText([
    "F",
    "G",
    "A",
    "B",
    "C",
    "D",
    "E",
  ]);
  await expect(page.locator("#answers button.wrong")).toHaveCount(0);
  await page.locator("#stop").click();
});
