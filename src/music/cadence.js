import { getKey } from "./theory.js";

// Relative to C4 (MIDI 60). Each chord is [bass, right-hand low, middle, high].
// C3/E4 G4 C5 → F3/F4 A4 C5 → G3/E4 G4 C5 → G2/D4 G4 H4 → C3/E4 G4 C5.
export const CADENCE_OFFSETS = Object.freeze(
  [
    [-12, 4, 7, 12],
    [-7, 5, 9, 12],
    [-5, 4, 7, 12],
    [-17, 2, 7, 11],
    [-12, 4, 7, 12],
  ].map(Object.freeze),
);

export function cadencePitches(key) {
  const tonic = getKey(key).tonic;
  return CADENCE_OFFSETS.map((chord) => chord.map((offset) => tonic + offset));
}

export function reminderTonic(key) {
  return cadencePitches(key).at(-1)[0];
}
