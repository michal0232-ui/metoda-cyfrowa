import { DEGREES, KEYS } from "../music/theory.js";
import { ANSWER_NAMES } from "../notation/answer-labels.js";
export const STORAGE_KEY = "metoda-cyfrowa.settings";
export const SETTINGS_VERSION = 1;
export const LEGACY_STORAGE_KEY = "functional-ear-trainer.settings.v1";
export function normalizeSettings(value) {
  const degrees = [
    ...new Set(
      Array.isArray(value?.degrees)
        ? value.degrees.filter((d) => DEGREES.includes(d))
        : DEGREES,
    ),
  ].sort();
  const validKey = (id) => KEYS.some((key) => key.id === id);
  const oldKey = validKey(value?.key) ? value.key : "C";
  const selected = [
    ...new Set(
      Array.isArray(value?.keys) ? value.keys.filter(validKey) : [oldKey],
    ),
  ];
  const keys = selected.length ? selected : [oldKey];
  return {
    key: keys.includes(oldKey) ? oldKey : keys[0],
    keys,
    mixKeys: value?.mixKeys === true,
    reminderKind: value?.reminderKind === "tonic" ? "tonic" : "cadence",
    reminderEvery:
      Number.isSafeInteger(value?.reminderEvery) && value.reminderEvery >= 0
        ? value.reminderEvery
        : 1,
    noteColors: value?.noteColors === true,
    answerNames: ANSWER_NAMES.includes(value?.answerNames)
      ? value.answerNames
      : "digits",
    degrees: degrees.length ? degrees : [...DEGREES],
    volume: Number.isFinite(value?.volume)
      ? Math.min(1, Math.max(0, value.volume))
      : 0.5,
  };
}
function read(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}
function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage = browserStorage()) {
  const current = read(storage, STORAGE_KEY);
  const legacy = read(storage, LEGACY_STORAGE_KEY);
  // Version 0 / unversioned objects use the original field names. Future migrations
  // can transform this input before normalization; unknown newer versions are read-only.
  const settings = normalizeSettings({ ...legacy, ...current });
  saveSettings(settings, storage);
  return settings;
}
export function saveSettings(settings, storage = browserStorage()) {
  try {
    const current = read(storage, STORAGE_KEY);
    if (
      Number.isInteger(current?.version) &&
      current.version > SETTINGS_VERSION
    )
      return false;
    // A whitelist excludes questions, timers, statistics and fullscreen even if supplied.
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SETTINGS_VERSION,
        ...normalizeSettings(settings),
      }),
    );
    // Remove the legacy copy only AFTER a successful write, so failed migration loses nothing.
    storage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false; // In-memory preferences still work when storage is unavailable/full.
  }
}
export function resetSettings(storage = browserStorage()) {
  const defaults = normalizeSettings(null);
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* Reset remains usable in memory. */
  }
  saveSettings(defaults, storage);
  return defaults;
}
