import { test } from "node:test";
import assert from "node:assert/strict";
import { cadencePitches, reminderTonic } from "../src/music/cadence.js";
import {
  cadenceEvents,
  reminderEvents,
} from "../src/exercises/major-degrees.js";

const reference = [
  [48, 64, 67, 72], // C3 / E4 G4 C5
  [53, 65, 69, 72], // F3 / F4 A4 C5
  [55, 64, 67, 72], // G3 / E4 G4 C5
  [43, 62, 67, 71], // G2 / D4 G4 H4
  [48, 64, 67, 72], // C3 / E4 G4 C5
];
test("C-major reference preserves exact octaves, voicing and descending dominant bass", () => {
  assert.deepEqual(cadencePitches("C"), reference);
  assert.equal(cadencePitches("C")[3][0], cadencePitches("C")[2][0] - 12);
  assert.equal(reminderTonic("C"), 48);
  assert.equal(reminderTonic("C"), cadencePitches("C")[4][0]);
});
for (const [key, shift] of [
  ["C", 0],
  ["G", -5],
  ["F", -7],
  ["D", 2],
  ["Bb", -2],
  ["B", -1],
]) {
  test(`${key}: exact whole-voicing transposition by ${shift} semitones, including tonic reminder`, () => {
    const expected = reference.map((chord) =>
      chord.map((midi) => midi + shift),
    );
    assert.deepEqual(cadencePitches(key), expected);
    assert.equal(expected[3][0], expected[2][0] - 12);
    assert.deepEqual(
      cadenceEvents(key),
      expected.map((notes) => ({ notes, duration: 0.62, gap: 0.1 })),
    );
    assert.deepEqual(reminderEvents(key, "tonic"), [
      { notes: [expected[4][0]], duration: 0.62, gap: 0.1 },
      { notes: [], duration: 0.4, gap: 0 },
    ]);
  });
}
