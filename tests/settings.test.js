import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../src/settings/settings.js";
import { answerLabel } from "../src/notation/answer-labels.js";
import { DEGREES, KEYS } from "../src/music/theory.js";
import {
  createQuestion,
  questionEvents,
  submitAnswer,
} from "../src/exercises/major-degrees.js";

test("European names preserve scale spelling, H natural and B flat", () => {
  const expected = {
    C: ["C", "D", "E", "F", "G", "A", "H"],
    G: ["G", "A", "H", "C", "D", "E", "F♯"],
    F: ["F", "G", "A", "B", "C", "D", "E"],
    "F#": ["F♯", "G♯", "A♯", "H", "C♯", "D♯", "E♯"],
    Gb: ["G♭", "A♭", "B", "C♭", "D♭", "E♭", "F"],
    B: ["H", "C♯", "D♯", "E", "F♯", "G♯", "A♯"],
    Bb: ["B", "C", "D", "E♭", "F", "G", "A"],
  };
  for (const [key, names] of Object.entries(expected))
    assert.deepEqual(
      DEGREES.map((d) => answerLabel(d, key, "european")),
      names,
    );
});
test("digits and movable solfege do not depend on key", () => {
  for (const key of KEYS) {
    assert.deepEqual(
      DEGREES.map((d) => answerLabel(d, key.id, "digits")),
      ["1", "2", "3", "4", "5", "6", "7"],
    );
    assert.deepEqual(
      DEGREES.map((d) => answerLabel(d, key.id, "solfege")),
      ["do", "re", "mi", "fa", "sol", "la", "si"],
    );
  }
});
test("mixing samples only selected keys and each question has its own cadence and pitch", () => {
  const settings = normalizeSettings({
    keys: ["G", "F"],
    key: "F",
    degrees: [7],
    mixKeys: true,
  });
  for (const [draw, key] of [
    [0, "G"],
    [0.999, "F"],
  ]) {
    const q = createQuestion(settings, () => draw);
    assert.equal(q.key, key);
    assert.equal(q.degree, 7);
    assert.deepEqual(questionEvents(q).at(-1).notes, [q.note.midi]);
    assert.equal(
      questionEvents(q)[0].notes[0] + 12,
      KEYS.find((k) => k.id === key).tonic,
    );
  }
  settings.mixKeys = false;
  for (const draw of [0, 0.5, 0.999])
    assert.equal(createQuestion(settings, () => draw).key, "F");
  settings.keys = KEYS.map((k) => k.id);
  settings.mixKeys = true;
  KEYS.forEach((key, index) =>
    assert.equal(
      createQuestion(settings, () => (index + 0.1) / KEYS.length).key,
      key.id,
    ),
  );
});
test("presentation modes never change questions or answer identity", () => {
  for (const answerNames of ["digits", "solfege", "european", "gestures"]) {
    const q = createQuestion(
      normalizeSettings({ key: "G", degrees: [7], answerNames }),
    );
    assert.equal(submitAnswer(q, 2), "wrong");
    assert.equal(submitAnswer(q, 7), "correct");
    assert.deepEqual(q.wrongDegrees, [2]);
    assert.equal(q.note.midi, 66);
  }
});
test("settings migrate legacy selection and validate new fields", () => {
  const old = normalizeSettings({ key: "Bb", degrees: [2, 7], volume: 0.3 });
  assert.deepEqual(old.keys, ["Bb"]);
  assert.equal(old.mixKeys, false);
  assert.equal(old.answerNames, "digits");
  const next = normalizeSettings({
    key: "C",
    keys: ["G", "invalid", "G", "F"],
    mixKeys: true,
    answerNames: "european",
    degrees: [2, 7],
  });
  assert.equal(next.key, "G");
  assert.deepEqual(next.keys, ["G", "F"]);
  assert.equal(next.mixKeys, true);
  assert.equal(next.answerNames, "european");
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(next))), next);
  assert.deepEqual(normalizeSettings({ keys: [] }).keys, ["C"]);
  assert.equal(
    normalizeSettings({ answerNames: "bad", mixKeys: "true" }).mixKeys,
    false,
  );
  assert.equal(normalizeSettings({ answerNames: "bad" }).answerNames, "digits");
});
