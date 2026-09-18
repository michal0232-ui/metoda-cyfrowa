import { DEGREES, KEYS } from "../music/theory.js";
import { ANSWER_NAMES } from "../notation/answer-labels.js";
// Keep the legacy storage key so renaming the app preserves saved settings.
const STORAGE_KEY = "functional-ear-trainer.settings.v1";
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
export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return normalizeSettings(null);
  }
}
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* In-memory settings still work when storage is unavailable. */
  }
}
