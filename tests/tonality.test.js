import { test } from "node:test";
import assert from "node:assert/strict";
import { TonalitySession } from "../src/exercises/tonality-session.js";
import { normalizeSettings } from "../src/settings/settings.js";
import {
  createQuestion,
  submitAnswer,
  questionEvents,
  cadenceEvents,
  reminderEvents,
} from "../src/exercises/major-degrees.js";
import { degreeNote, KEYS } from "../src/music/theory.js";
const question = (key = "C") => createQuestion({ key, degrees: [3] });
const session = (kind, every) =>
  new TonalitySession({ reminderKind: kind, reminderEvery: every });

for (const kind of ["tonic", "cadence"]) {
  for (const every of [0, 1, 3]) {
    test(`${kind} every ${every}: mandatory initial cadence and completed-task intervals`, () => {
      const s = session(kind, every);
      for (let index = 0; index < 11; index++) {
        const q = question();
        assert.equal(
          s.beginQuestion(q),
          index === 0 ? "cadence" : every && index % every === 0 ? kind : null,
        );
        submitAnswer(q, 3);
        s.complete(q);
      }
      assert.equal(s.completed, 11);
    });
  }
  test(`${kind}: changed key overrides periodic reminder, including beginning-only`, () => {
    for (const every of [0, 1, 3]) {
      const s = session(kind, every);
      const q = question();
      assert.equal(s.beginQuestion(q), "cadence");
      submitAnswer(q, 3);
      s.complete(q);
      const next = question("G");
      assert.equal(s.beginQuestion(next), kind);
      const events = questionEvents(next, kind);
      assert.equal(events.length, kind === "tonic" ? 3 : 7);
      assert.equal(events[0].notes[0], degreeNote("G", 1).midi - 12);
      // Key-change reminders do not reset the global completed-task interval.
      submitAnswer(next, 3);
      s.complete(next);
      assert.equal(s.beginQuestion(question("G")), every === 1 ? kind : null);
    }
  });
}
test("wrong/duplicate attempts never advance completed count; new session resets", () => {
  const s = session("tonic", 3);
  const q = question();
  s.beginQuestion(q);
  for (const degree of [2, 4, 2]) {
    submitAnswer(q, degree);
    s.complete(q);
  }
  assert.equal(s.completed, 0);
  submitAnswer(q, 3);
  s.complete(q);
  s.complete(q);
  submitAnswer(q, 3);
  s.complete(q);
  assert.equal(s.completed, 1);
  assert.equal(session("tonic", 3).beginQuestion(question("G")), "cadence");
});
test("cadence is reused unchanged in every key; tonic uses theory register; no reminder is target only", () => {
  for (const key of KEYS) {
    const q = question(key.id);
    assert.deepEqual(questionEvents(q).slice(0, 5), cadenceEvents(key.id));
    assert.deepEqual(reminderEvents(key.id, "tonic")[0].notes, [
      degreeNote(key.id, 1).midi - 12,
      degreeNote(key.id, 1).midi,
    ]);
    assert.deepEqual(questionEvents(q, null), [
      { notes: [q.note.midi], duration: 0.8, gap: 0.12 },
    ]);
    for (const kind of ["tonic", "cadence"]) {
      const events = questionEvents(q, kind);
      assert.deepEqual(events.at(-2), { notes: [], duration: 0.4, gap: 0 });
      assert.deepEqual(events.at(-1).notes, [q.note.midi]);
    }
  }
});
test("legacy settings retain cadence before each question and numeric frequencies are validated", () => {
  for (const input of [
    null,
    {},
    { key: "G" },
    { reminderKind: "bad", reminderEvery: -1 },
    { reminderEvery: "3" },
    { reminderEvery: 1.5 },
  ]) {
    const s = normalizeSettings(input);
    assert.equal(s.reminderKind, "cadence");
    assert.equal(s.reminderEvery, 1);
  }
  for (const every of [0, 1, 2, 3, 5, 10, 12]) {
    const s = normalizeSettings({
      reminderKind: "tonic",
      reminderEvery: every,
    });
    assert.equal(s.reminderEvery, every);
    assert.equal(s.reminderKind, "tonic");
    assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(s))), s);
  }
});
