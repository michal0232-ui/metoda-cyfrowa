import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPair,
  DEFAULT_PITCHES,
  NOTE_DURATION,
  SILENCE,
  pairEvents,
  replayEvents,
  submitPairAnswer,
  pairRecord,
} from "../src/exercises/same-different.js";
import { salamander } from "../src/audio/instruments/salamander.js";
function draw(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
test("independent 50/50 threshold; same MIDI versus distinct MIDI inside the four chromatic octaves", () => {
  assert.deepEqual(
    DEFAULT_PITCHES,
    Array.from({ length: 48 }, (_, i) => 36 + i),
  );
  let same = 0;
  for (let i = 0; i < 1000; i++) {
    const q = createPair({}, draw([0.3, i / 1000, 0.9]));
    if (q.kind === "same") {
      same++;
      assert.equal(q.notes[0], q.notes[1]);
    } else assert.notEqual(q.notes[0], q.notes[1]);
    assert.ok(q.notes.every((n) => DEFAULT_PITCHES.includes(n)));
  }
  assert.equal(same, 500);
});
test("future pitch pools and distance bounds never create an identical different pair", () => {
  for (const pitch of [0, 0.5, 0.999]) {
    const q = createPair(
      { pitches: [60, 61, 62, 70], maxDistance: 1 },
      draw([pitch, 0.9, 0.999]),
    );
    assert.equal(Math.abs(q.notes[0] - q.notes[1]), 1);
  }
  assert.throws(() => createPair({ pitches: [60] }));
  assert.throws(() => createPair({ pitches: [60, 72], maxDistance: 1 }));
});
test("exactly one second of silence after sample release; individual replays preserve question", () => {
  const q = createPair({}, draw([0, 0.9, 0.99])),
    before = structuredClone(q);
  const [first, second] = pairEvents(q, salamander.release);
  assert.ok(
    Math.abs(
      first.duration +
        first.gap -
        (first.duration + salamander.release) -
        SILENCE,
    ) < 1e-12,
  );
  assert.equal(first.duration, NOTE_DURATION);
  assert.deepEqual(first.notes, [q.notes[0]]);
  assert.deepEqual(second.notes, [q.notes[1]]);
  for (const i of [0, 1])
    assert.deepEqual(replayEvents(q, i)[0].notes, [q.notes[i]]);
  assert.deepEqual(q, before);
});
test("wrong answer remains open, repeated wrong clicks ignored, independent completion record", () => {
  for (const value of [0.1, 0.9]) {
    const q = createPair({}, draw([0, value, 0.5]));
    const wrong = q.kind === "same" ? "different" : "same";
    assert.equal(submitPairAnswer(q, wrong), "wrong");
    assert.equal(q.solved, false);
    assert.equal(submitPairAnswer(q, wrong), "ignored");
    assert.equal(submitPairAnswer(q, q.kind), "correct");
    assert.deepEqual(pairRecord(q), {
      kind: q.kind,
      attempts: 2,
      firstTry: false,
      replayCounts: [0, 0],
    });
    assert.equal(submitPairAnswer(q, q.kind), "ignored");
    const first = createPair({}, draw([0, value, 0.5]));
    submitPairAnswer(first, first.kind);
    assert.equal(pairRecord(first).firstTry, true);
  }
});

test("semitone edges, both directions, and wider intervals for every first MIDI", () => {
  for (let midi = 36; midi <= 83; midi++) {
    const first = (midi - 36 + 0.1) / 48;
    for (const direction of [0, 0.999]) {
      const q = createPair({}, draw([first, 0.9, 0.1, direction]));
      assert.equal(q.notes[0], midi);
      assert.equal(
        q.notes[1],
        midi === 36 ? 37 : midi === 83 ? 82 : midi + (direction === 0 ? -1 : 1),
      );
      const wide = createPair({}, draw([first, 0.9, 0.9, direction]));
      assert.ok(Math.abs(wide.notes[1] - midi) > 1);
      assert.ok(wide.notes[1] >= 36 && wide.notes[1] <= 83);
    }
    const same = createPair({}, draw([first, 0.1]));
    assert.deepEqual(same.notes, [midi, midi]);
    assert.ok(midi >= salamander.minMidi && midi <= salamander.maxMidi);
  }
});
test("seeded independent draws produce 50% same and 50% semitones among different, without session balancing", () => {
  let seed = 123456789;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let same = 0,
    different = 0,
    semitones = 0,
    up = 0,
    down = 0,
    run = 0,
    maxRun = 0,
    last = null;
  const firstCounts = new Map();
  for (let i = 0; i < 48000; i++) {
    const q = createPair({}, random),
      diff = q.notes[1] - q.notes[0];
    firstCounts.set(q.notes[0], (firstCounts.get(q.notes[0]) ?? 0) + 1);
    if (q.kind === "same") same++;
    else {
      different++;
      if (Math.abs(diff) === 1) {
        semitones++;
        if (q.notes[0] > 36 && q.notes[0] < 83) {
          if (diff > 0) up++;
          else down++;
        }
      }
    }
    run = q.kind === last ? run + 1 : 1;
    last = q.kind;
    maxRun = Math.max(maxRun, run);
  }
  assert.ok(Math.abs(same / 48000 - 0.5) < 0.02);
  assert.ok(Math.abs(semitones / different - 0.5) < 0.02);
  assert.ok(Math.abs(up / (up + down) - 0.5) < 0.02);
  assert.equal(firstCounts.size, 48);
  for (const count of firstCounts.values())
    assert.ok(count > 800 && count < 1200);
  assert.ok(maxRun >= 5);
});
