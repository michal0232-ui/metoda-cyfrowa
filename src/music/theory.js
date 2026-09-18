import { SCALES } from "./scales.js";
export const DEGREES = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
const LETTERS = ["c", "d", "e", "f", "g", "a", "b"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
// MIDI and spelling are derived together, so sound and notation cannot diverge.
export const KEYS = Object.freeze(
  [
    { id: "C", label: "C-dur", tonic: 60, letter: "c", octave: 4 },
    { id: "G", label: "G-dur", tonic: 55, letter: "g", octave: 3 },
    { id: "D", label: "D-dur", tonic: 62, letter: "d", octave: 4 },
    { id: "A", label: "A-dur", tonic: 57, letter: "a", octave: 3 },
    { id: "E", label: "E-dur", tonic: 64, letter: "e", octave: 4 },
    { id: "B", label: "H-dur", tonic: 59, letter: "b", octave: 3 },
    { id: "F#", label: "Fis-dur", tonic: 54, letter: "f", octave: 3 },
    { id: "F", label: "F-dur", tonic: 53, letter: "f", octave: 3 },
    { id: "Bb", label: "B-dur", tonic: 58, letter: "b", octave: 3 },
    { id: "Eb", label: "Es-dur", tonic: 63, letter: "e", octave: 4 },
    { id: "Ab", label: "As-dur", tonic: 56, letter: "a", octave: 3 },
    { id: "Db", label: "Des-dur", tonic: 61, letter: "d", octave: 4 },
    { id: "Gb", label: "Ges-dur", tonic: 54, letter: "g", octave: 3 },
  ].map((key) => ({ ...key, mode: "major" })),
);
export function getKey(id) {
  const key = KEYS.find((item) => item.id === id);
  if (!key) throw new RangeError(`Nieznana tonacja: ${id}`);
  return key;
}
export function degreeNote(keyId, degree, octaveShift = 0) {
  if (!DEGREES.includes(degree) || !Number.isInteger(octaveShift))
    throw new RangeError("Nieprawidłowy stopień lub oktawa");
  const key = getKey(keyId);
  const index = LETTERS.indexOf(key.letter) + degree - 1;
  const letterIndex = index % 7;
  const octave = key.octave + Math.floor(index / 7) + octaveShift;
  const midi =
    key.tonic + SCALES[key.mode].intervals[degree - 1] + 12 * octaveShift;
  const alteration = midi - (12 * (octave + 1) + NATURAL[letterIndex]);
  const accidental = { "-1": "b", 0: "", 1: "#" }[alteration];
  if (accidental === undefined)
    throw new RangeError("Nieobsługiwany znak chromatyczny");
  const letter = LETTERS[letterIndex];
  const names = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "H" };
  const name =
    letter === "b" && accidental === "b"
      ? "B"
      : names[letter] +
        (accidental === "#"
          ? "is"
          : accidental === "b"
            ? letter === "e" || letter === "a"
              ? "s"
              : "es"
            : "");
  return {
    degree,
    midi,
    letter,
    accidental,
    octave,
    vexKey: `${letter}${accidental}/${octave}`,
    label: `${name}${octave}`,
  };
}
export const midiFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
