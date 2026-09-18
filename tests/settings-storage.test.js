import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadSettings,
  saveSettings,
  resetSettings,
  normalizeSettings,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
} from "../src/settings/settings.js";
function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}
const custom = {
  key: "G",
  keys: ["G", "F"],
  degrees: [2, 5],
  mixKeys: true,
  answerNames: "gestures",
  noteColors: true,
  reminderKind: "tonic",
  reminderEvery: 3,
  volume: 0.3,
};
test("all preferences round-trip in one versioned object; transient state is excluded", () => {
  const s = storage();
  assert.equal(
    saveSettings(
      {
        ...custom,
        question: { degree: 5 },
        wrongDegrees: [1],
        completed: 9,
        fullscreen: true,
        playing: true,
        timer: 10,
      },
      s,
    ),
    true,
  );
  assert.deepEqual(JSON.parse(s.getItem(STORAGE_KEY)), {
    version: 1,
    ...custom,
  });
  assert.deepEqual(loadSettings(s), custom);
});
test("legacy settings migrate without losing fields and old key is removed only after saving", () => {
  const s = storage({ [LEGACY_STORAGE_KEY]: JSON.stringify(custom) });
  assert.deepEqual(loadSettings(s), custom);
  assert.equal(s.getItem(LEGACY_STORAGE_KEY), null);
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).version, 1);
});
test("partial unversioned/version 0 records preserve existing values and fill only missing fields", () => {
  for (const version of [undefined, 0]) {
    const s = storage({
      [STORAGE_KEY]: JSON.stringify({ version, answerNames: "solfege" }),
      [LEGACY_STORAGE_KEY]: JSON.stringify(custom),
    });
    assert.deepEqual(loadSettings(s), { ...custom, answerNames: "solfege" });
  }
  assert.deepEqual(
    loadSettings(
      storage({
        [LEGACY_STORAGE_KEY]: JSON.stringify({ key: "Bb", volume: 0.25 }),
      }),
    ),
    normalizeSettings({ key: "Bb", volume: 0.25 }),
  );
});
test("broken JSON and nonobjects recover; invalid fields do not discard good preferences", () => {
  for (const text of ["{broken", "null", "[]", "17"]) {
    assert.deepEqual(
      loadSettings(storage({ [STORAGE_KEY]: text })),
      normalizeSettings(null),
    );
    assert.deepEqual(
      loadSettings(
        storage({
          [STORAGE_KEY]: text,
          [LEGACY_STORAGE_KEY]: JSON.stringify(custom),
        }),
      ),
      custom,
    );
  }
  const s = storage({
    [STORAGE_KEY]: JSON.stringify({
      ...custom,
      version: 1,
      noteColors: "true",
      reminderEvery: -5,
      degrees: [2, "3", 99],
      answerNames: "bad",
    }),
  });
  assert.deepEqual(loadSettings(s), {
    ...custom,
    noteColors: false,
    reminderEvery: 1,
    degrees: [2],
    answerNames: "digits",
  });
});
test("failed write retains legacy data for migration retry", () => {
  const s = storage({ [LEGACY_STORAGE_KEY]: JSON.stringify(custom) });
  s.setItem = () => {
    throw Error("quota");
  };
  assert.deepEqual(loadSettings(s), custom);
  assert.ok(s.getItem(LEGACY_STORAGE_KEY));
  assert.equal(saveSettings(custom, s), false);
});
test("unavailable storage still supports in-memory settings", () => {
  const s = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
    removeItem() {
      throw Error("denied");
    },
  };
  assert.deepEqual(loadSettings(s), normalizeSettings(null));
  assert.equal(saveSettings(custom, s), false);
  assert.deepEqual(resetSettings(s), normalizeSettings(null));
});
test("future schema is not overwritten by older app; explicit reset still works", () => {
  const text = JSON.stringify({
    ...custom,
    version: 99,
    newPreference: "keep",
  });
  const s = storage({ [STORAGE_KEY]: text });
  assert.deepEqual(loadSettings(s), custom);
  assert.equal(saveSettings(custom, s), false);
  assert.equal(s.getItem(STORAGE_KEY), text);
  assert.deepEqual(resetSettings(s), normalizeSettings(null));
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).version, 1);
});
test("reset replaces preferences without deleting unrelated application data", () => {
  const s = storage({
    unrelated: "keep",
    [LEGACY_STORAGE_KEY]: JSON.stringify(custom),
  });
  saveSettings(custom, s);
  assert.deepEqual(resetSettings(s), normalizeSettings(null));
  assert.deepEqual(loadSettings(s), normalizeSettings(null));
  assert.equal(s.getItem("unrelated"), "keep");
});
