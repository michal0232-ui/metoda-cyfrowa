import { degreeNote } from "../music/theory.js";

export const ANSWER_NAMES = ["digits", "solfege", "european", "gestures"];
const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "si"];
const LETTERS = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "H" };

// Presentation only: button identity, answers and statistics remain degrees.
export function answerLabel(degree, key, mode) {
  if (mode === "digits") return String(degree);
  if (mode === "solfege" || mode === "gestures") return SOLFEGE[degree - 1];
  const note = degreeNote(key, degree);
  if (note.letter === "b" && note.accidental === "b") return "B";
  return LETTERS[note.letter] + { "#": "♯", b: "♭", "": "" }[note.accidental];
}
