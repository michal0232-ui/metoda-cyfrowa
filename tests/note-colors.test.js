import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTE_COLORS, noteColor, colorText } from "../src/music/note-colors.js";
import { degreeNote } from "../src/music/theory.js";
import { normalizeSettings } from "../src/settings/settings.js";
import { AudioEngine } from "../src/audio/engine.js";

test("colors follow absolute pitches, European H/B and octave equivalence", () => {
  for (const midi of [48, 60, 72]) assert.equal(noteColor(midi).hex, "#E53935");
  assert.equal(noteColor(67).hex, "#2474D2");
  assert.equal(noteColor(71).hex, "#EF87B5");
  assert.equal(noteColor(70).hex, "#A8DDB5");
  assert.equal(noteColor(degreeNote("F#", 1).midi).hex, "#176B3A");
  assert.equal(
    noteColor(degreeNote("F#", 1).midi),
    noteColor(degreeNote("Gb", 1).midi),
  );
  for (const [sharpKey, sharpDegree, flatKey] of [
    ["A", 3, "Db"],
    ["E", 7, "Eb"],
    ["G", 7, "Gb"],
    ["A", 7, "Ab"],
    ["B", 7, "Bb"],
  ]) {
    assert.equal(
      noteColor(degreeNote(sharpKey, sharpDegree).midi),
      noteColor(degreeNote(flatKey, 1).midi),
    );
  }
  assert.equal(noteColor(degreeNote("G", 1).midi).hex, "#2474D2");
  assert.equal(noteColor(degreeNote("F", 4).midi).hex, "#A8DDB5");
});
test("palette text automatically has at least 4.5:1 contrast", () => {
  for (const { hex } of NOTE_COLORS) {
    const channels = hex
      .slice(1)
      .match(/../g)
      .map((c) => parseInt(c, 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const l =
      channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const text = colorText(hex);
    assert.ok(
      (text === "#000000" ? (l + 0.05) / 0.05 : 1.05 / (l + 0.05)) >= 4.5,
    );
  }
  assert.equal(colorText("#FFFFFF"), "#000000");
  assert.equal(colorText("#000000"), "#FFFFFF");
});
test("colors default off, accept only booleans and do not depend on naming mode", () => {
  for (const value of [null, {}, { noteColors: "true" }, { noteColors: 1 }])
    assert.equal(normalizeSettings(value).noteColors, false);
  for (const answerNames of ["digits", "solfege", "european", "gestures"]) {
    const settings = normalizeSettings({ answerNames, noteColors: true });
    assert.equal(settings.noteColors, true);
    assert.equal(settings.answerNames, answerNames);
    assert.deepEqual(
      normalizeSettings(JSON.parse(JSON.stringify(settings))),
      settings,
    );
  }
});
test("visual playback follows AudioContext time, holds through gaps and clears on silence/end", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const engine = new AudioEngine({
    schedule: (_, __, n) => n.start + n.duration,
    stop: () => {},
  });
  engine.context = { currentTime: 0, state: "running" };
  engine.ready = true;
  const calls = [];
  const done = engine.play(
    [
      { notes: [60], duration: 0.5, gap: 0.1 },
      { notes: [], duration: 0.3 },
      { notes: [62], duration: 0.5 },
    ],
    new AbortController().signal,
    (i) => calls.push(i),
  );
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(1000);
  assert.deepEqual(calls, []); // Suspended clock: no advancement.
  engine.context.currentTime = 0.05;
  t.mock.timers.tick(30);
  assert.deepEqual(calls, [0]);
  engine.context.currentTime = 0.59;
  t.mock.timers.tick(30);
  assert.deepEqual(calls, [0]);
  engine.context.currentTime = 0.7;
  t.mock.timers.tick(30);
  assert.deepEqual(calls, [0, null]);
  engine.context.currentTime = 0.95;
  t.mock.timers.tick(30);
  assert.deepEqual(calls, [0, null, 2]);
  engine.context.currentTime = 2;
  t.mock.timers.tick(30);
  await done;
  assert.deepEqual(calls, [0, null, 2, null]);
});
test("aborting audio clears the active visual and cancels further updates", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let stops = 0;
  const engine = new AudioEngine({
    schedule: (_, __, n) => n.start + n.duration,
    stop: () => stops++,
  });
  engine.context = { currentTime: 0, state: "running" };
  engine.ready = true;
  const controller = new AbortController();
  const calls = [];
  const done = engine.play(
    [{ notes: [60], duration: 2 }],
    controller.signal,
    (i) => calls.push(i),
  );
  await Promise.resolve();
  await Promise.resolve();
  engine.context.currentTime = 0.1;
  t.mock.timers.tick(30);
  controller.abort();
  await assert.rejects(done, { name: "AbortError" });
  engine.context.currentTime = 5;
  t.mock.timers.tick(1000);
  assert.deepEqual(calls, [0, null]);
  assert.equal(stops, 1);
});

test("absolute names and colors do not belong to relative degree labels", async () => {
  const { absoluteNote } = await import("../src/music/absolute-note.js");
  const { answerLabel } = await import("../src/notation/answer-labels.js");
  for (const [key, degree, name, color] of [
    ["C", 1, "C", "#E53935"],
    ["G", 1, "G", "#2474D2"],
    ["F", 5, "C", "#E53935"],
  ]) {
    for (const octave of [-1, 0, 1]) {
      const absolute = absoluteNote(degreeNote(key, degree, octave));
      assert.equal(absolute.name, name);
      assert.equal(absolute.color, color);
    }
  }
  for (const key of ["C", "G", "F"]) {
    assert.equal(answerLabel(1, key, "digits"), "1");
    assert.equal(answerLabel(1, key, "solfege"), "do");
    assert.equal(answerLabel(1, key, "gestures"), "do");
  }
});
