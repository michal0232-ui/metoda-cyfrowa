import { test } from "node:test";
import assert from "node:assert/strict";
import { keyboardKeys } from "../src/notation/answer-keyboard.js";
import { KEYS, degreeNote } from "../src/music/theory.js";
import { noteColor } from "../src/music/note-colors.js";
test("every key has exactly a tonic-to-tonic chromatic octave and eight scale answers", () => {
  for (const key of KEYS) {
    const keys = keyboardKeys(key.id);
    assert.equal(keys.length, 13);
    assert.equal(keys[0].midi, key.tonic);
    assert.equal(keys.at(-1).midi, key.tonic + 12);
    assert.deepEqual(
      keys.filter((k) => k.degree).map((k) => k.degree),
      [1, 2, 3, 4, 5, 6, 7, 1],
    );
    assert.equal(noteColor(keys[0].midi).hex, noteColor(keys.at(-1).midi).hex);
    for (const k of keys) {
      assert.ok(k.left >= 0);
      assert.ok(k.left + k.width <= 100.000001);
    }
  }
});
test("all major keys map seven distinct degrees onto pitch keys; C color is independent of degree", () => {
  for (const key of KEYS)
    assert.equal(
      new Set(
        Array.from(
          { length: 7 },
          (_, i) => degreeNote(key.id, i + 1).midi % 12,
        ),
      ).size,
      7,
    );
  for (const [key, degree] of [
    ["C", 1],
    ["G", 4],
    ["F", 5],
  ]) {
    const midi = degreeNote(key, degree).midi;
    assert.equal(midi % 12, 0);
    assert.equal(noteColor(midi).hex, "#E53935");
  }
});
