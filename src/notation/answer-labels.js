import { absoluteNote } from "../music/absolute-note.js";
import { degreeNote } from "../music/theory.js";

export const ANSWER_NAMES = ["digits", "solfege", "european", "gestures"];
const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "si"];

// Presentation only: button identity, answers and statistics remain degrees.
export function answerLabel(degree, key, mode) {
  if (mode === "digits") return String(degree);
  if (mode === "solfege" || mode === "gestures") return SOLFEGE[degree - 1];
  return absoluteNote(degreeNote(key, degree)).name;
}
