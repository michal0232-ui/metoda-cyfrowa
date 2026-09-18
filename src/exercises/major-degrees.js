import { degreeNote } from "../music/theory.js";

// Each pair is [scale degree, octave relative to the question's tonic].
// For degree 7 both phrases ascend a semitone; the second is one octave lower.
export const RESOLUTIONS = Object.freeze({
  1: [[[1, 0]]],
  2: [
    [
      [2, 0],
      [1, 0],
    ],
  ],
  3: [
    [
      [3, 0],
      [2, 0],
      [1, 0],
    ],
  ],
  4: [
    [
      [4, 0],
      [3, 0],
      [1, 0],
    ],
  ],
  5: [
    [
      [5, 0],
      [1, 0],
    ],
    [
      [5, 0],
      [1, 1],
    ],
  ],
  6: [
    [
      [6, 0],
      [5, 0],
      [1, 0],
    ],
    [
      [6, 0],
      [7, 0],
      [1, 1],
    ],
  ],
  7: [
    [
      [7, 0],
      [1, 1],
    ],
    [
      [7, -1],
      [1, 0],
    ],
  ],
});
export function resolutionPhrases(key, degree) {
  return RESOLUTIONS[degree].map((phrase) =>
    phrase.map(([step, shift]) => degreeNote(key, step, shift)),
  );
}
export function resolutionEvents(question) {
  return resolutionPhrases(question.key, question.degree).flatMap(
    (phrase, index, phrases) => [
      ...phrase.map((note) => ({
        notes: [note.midi],
        duration: 0.55,
        gap: 0.08,
      })),
      ...(index < phrases.length - 1
        ? [{ notes: [], duration: 0.45, gap: 0 }]
        : []),
    ],
  );
}
export function questionEvents(question) {
  const note = (degree, shift = 0) =>
    degreeNote(question.key, degree, shift).midi;
  const chords = [
    [note(1, -1), note(1), note(3), note(5)],
    [note(4, -1), note(1), note(4), note(6)],
    [note(5, -1), note(7, -1), note(2), note(5)],
    [note(1, -1), note(1), note(3), note(5)],
  ];
  return [
    ...chords.map((notes) => ({ notes, duration: 0.62, gap: 0.1 })),
    { notes: [], duration: 0.4, gap: 0 },
    { notes: [question.note.midi], duration: 0.8, gap: 0.12 },
  ];
}
export function createQuestion(settings, random = Math.random) {
  if (!settings.degrees.length)
    throw new RangeError("Wybierz co najmniej jeden stopień");
  const degree =
    settings.degrees[Math.floor(random() * settings.degrees.length)];
  const key = settings.mixKeys
    ? settings.keys[Math.floor(random() * settings.keys.length)]
    : settings.key;
  return {
    key,
    degree,
    note: degreeNote(key, degree),
    wrongDegrees: [],
    solved: false,
  };
}
export function submitAnswer(question, degree) {
  if (
    question.solved ||
    question.wrongDegrees.includes(degree) ||
    !Number.isInteger(degree) ||
    degree < 1 ||
    degree > 7
  )
    return "ignored";
  if (degree === question.degree) {
    question.solved = true;
    return "correct";
  }
  question.wrongDegrees.push(degree);
  return "wrong";
}
export const majorDegrees = {
  id: "major-degrees",
  createQuestion,
  questionEvents,
  resolutionEvents,
  submitAnswer,
};
