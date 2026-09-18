import { test } from "node:test";
import assert from "node:assert/strict";
import { degreeNote, KEYS, midiFrequency } from "../src/music/theory.js";
import {
  createQuestion,
  submitAnswer,
  resolutionPhrases,
  questionEvents,
  resolutionEvents,
} from "../src/exercises/major-degrees.js";
import { normalizeSettings } from "../src/settings/settings.js";
import { Statistics } from "../src/statistics/statistics.js";
import { nearestSample } from "../src/audio/sample-instrument.js";
import { salamander } from "../src/audio/instruments/salamander.js";

test("degree 7 resolves upward twice, with the entire second phrase an octave lower", () => {
  for (const key of KEYS) {
    const [upper, lower] = resolutionPhrases(key.id, 7);
    assert.equal(upper[1].midi - upper[0].midi, 1);
    assert.equal(lower[1].midi - lower[0].midi, 1);
    assert.equal(upper[0].midi - lower[0].midi, 12);
    assert.equal(upper[1].midi - lower[1].midi, 12);
  }
  assert.deepEqual(
    resolutionEvents({ key: "C", degree: 7 }).map((event) => event.notes),
    [[71], [72], [], [59], [60]],
  );
});

test("cadence fits existing samples within three semitones; questions and solutions within one", () => {
  for (const key of KEYS)
    for (let degree = 1; degree <= 7; degree++) {
      const question = createQuestion({ key: key.id, degrees: [degree] });
      const events = questionEvents(question);
      for (const [notes, maxDistance] of [
        [events.slice(0, 5).flatMap((e) => e.notes), 3],
        [
          [...events.slice(5), ...resolutionEvents(question)].flatMap(
            (e) => e.notes,
          ),
          1,
        ],
      ]) {
        for (const midi of notes) {
          assert.ok(midi >= salamander.minMidi && midi <= salamander.maxMidi);
          assert.ok(
            Math.abs(nearestSample(salamander.samples, midi).midi - midi) <=
              maxDistance,
          );
        }
      }
    }
});

test("all digital resolutions preserve exact pitches, order and octave directions", () => {
  const expected = {
    1: [[60]],
    2: [[62, 60]],
    3: [[64, 62, 60]],
    4: [[65, 64, 60]],
    5: [
      [67, 60],
      [67, 72],
    ],
    6: [
      [69, 67, 60],
      [69, 71, 72],
    ],
    7: [
      [71, 72],
      [59, 60],
    ],
  };
  for (const key of KEYS)
    for (let degree = 1; degree <= 7; degree++) {
      assert.deepEqual(
        resolutionPhrases(key.id, degree).map((phrase) =>
          phrase.map((n) => n.midi),
        ),
        expected[degree].map((phrase) =>
          phrase.map((midi) => midi + key.tonic - 60),
        ),
        `${key.id} degree ${degree}`,
      );
    }
});
test("notation spelling resolves to exactly the same MIDI pitch in every key and octave", () => {
  const natural = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  for (const key of KEYS)
    for (let degree = 1; degree <= 7; degree++)
      for (const shift of [-1, 0, 1]) {
        const note = degreeNote(key.id, degree, shift);
        const accidental = { "": 0, "#": 1, b: -1 }[note.accidental];
        assert.equal(
          (note.octave + 1) * 12 + natural[note.letter] + accidental,
          note.midi,
        );
      }
  assert.equal(degreeNote("F#", 7).vexKey, "e#/4");
  assert.equal(degreeNote("Gb", 4).vexKey, "cb/4");
  assert.equal(degreeNote("Bb", 1).label, "B3");
  assert.equal(degreeNote("B", 1).label, "H3");
  assert.equal(midiFrequency(69), 440);
});
test("question plays I–IV–I6/4–V–I, then precisely its target", () => {
  const question = createQuestion({ key: "C", degrees: [4] });
  assert.deepEqual(
    questionEvents(question).map((e) => e.notes),
    [
      [48, 64, 67, 72],
      [53, 65, 69, 72],
      [55, 64, 67, 72],
      [43, 62, 67, 71],
      [48, 64, 67, 72],
      [],
      [65],
    ],
  );
});
test("arbitrary selected degrees, including a single degree, are the entire random pool", () => {
  const config = { key: "D", degrees: [2, 4, 7] };
  assert.equal(createQuestion(config, () => 0).degree, 2);
  assert.equal(createQuestion(config, () => 0.5).degree, 4);
  assert.equal(createQuestion(config, () => 0.999).degree, 7);
  assert.equal(createQuestion({ key: "C", degrees: [6] }).degree, 6);
  assert.throws(() => createQuestion({ key: "C", degrees: [] }));
});
test("wrong choices are unique, do not solve, and completed statistics retain their order", () => {
  const question = createQuestion({ key: "C", degrees: [4] });
  const stats = new Statistics();
  assert.throws(() => stats.record(question));
  assert.equal(submitAnswer(question, 2), "wrong");
  assert.equal(submitAnswer(question, 2), "ignored");
  assert.equal(submitAnswer(question, 6), "wrong");
  assert.equal(question.solved, false);
  assert.equal(submitAnswer(question, 4), "correct");
  assert.equal(submitAnswer(question, 4), "ignored");
  stats.record(question);
  assert.deepEqual(stats.records[0].wrongDegrees, [2, 6]);
  assert.equal(stats.records[0].attempts, 3);
  const next = createQuestion({ key: "G", degrees: [1] });
  submitAnswer(next, 1);
  stats.record(next);
  assert.deepEqual(stats.summary(), { total: 2, firstTry: 1, average: 2 });
});
test("invalid saved settings recover to a valid nonempty pool", () => {
  assert.deepEqual(normalizeSettings({ key: "bad", degrees: [], volume: 12 }), {
    key: "C",
    keys: ["C"],
    mixKeys: false,
    noteColors: false,
    reminderKind: "cadence",
    reminderEvery: 1,
    answerNames: "digits",
    degrees: [1, 2, 3, 4, 5, 6, 7],
    volume: 1,
  });
  assert.deepEqual(
    normalizeSettings({ key: "F", degrees: [7, 0, 2, 2] }).degrees,
    [2, 7],
  );
  assert.equal(normalizeSettings(null).key, "C");
});
