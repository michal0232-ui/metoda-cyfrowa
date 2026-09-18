import { noteColor } from "./note-colors.js";

const LETTERS = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "H" };

// Absolute spelling and pitch color, independent of movable degree labels.
export function absoluteNote(note) {
  const name =
    note.letter === "b" && note.accidental === "b"
      ? "B"
      : LETTERS[note.letter] + { "#": "♯", b: "♭", "": "" }[note.accidental];
  return { name, midi: note.midi, color: noteColor(note.midi).hex };
}
