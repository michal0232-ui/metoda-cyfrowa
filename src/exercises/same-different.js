export const DEFAULT_PITCHES = Object.freeze(
  Array.from({ length: 48 }, (_, index) => 36 + index),
);
export const NOTE_DURATION = 0.62;
export const SILENCE = 1;
// A configurable pitch pool supports future diatonic/chromatic ranges; no UI yet.
export function createPair(
  { pitches = DEFAULT_PITCHES, maxDistance = Infinity } = {},
  random = Math.random,
) {
  const pool = [...new Set(pitches)];
  if (
    pool.length < 2 ||
    pool.some((p) => !Number.isInteger(p)) ||
    !(maxDistance >= 1)
  )
    throw new RangeError("Nieprawidłowy zakres dźwięków");
  const candidates = pool.filter((p) =>
    pool.some((q) => q !== p && Math.abs(q - p) <= maxDistance),
  );
  if (!candidates.length)
    throw new RangeError("Brak różnych dźwięków w zadanym zakresie");
  const first = candidates[Math.floor(random() * candidates.length)];
  const same = random() < 0.5;
  const alternatives = pool.filter(
    (p) => p !== first && Math.abs(p - first) <= maxDistance,
  );
  let second = first;
  if (!same) {
    const semitones = alternatives.filter((p) => Math.abs(p - first) === 1);
    const wider = alternatives.filter((p) => Math.abs(p - first) > 1);
    // Default chromatic range always offers both groups. Custom future pools
    // may lack one group, in which case use the available valid alternatives.
    const group = !semitones.length
      ? wider
      : !wider.length
        ? semitones
        : random() < 0.5
          ? semitones
          : wider;
    second = group[Math.floor(random() * group.length)];
  }
  return {
    notes: [first, second],
    kind: same ? "same" : "different",
    wrongAnswers: [],
    solved: false,
    replayCounts: [0, 0],
  };
}
export function pairEvents(question, release) {
  if (!Number.isFinite(release) || release < 0)
    throw new RangeError("Nieprawidłowy czas wybrzmiewania");
  return [
    {
      notes: [question.notes[0]],
      duration: NOTE_DURATION,
      gap: release + SILENCE,
    },
    { notes: [question.notes[1]], duration: NOTE_DURATION, gap: 0 },
  ];
}
export function replayEvents(question, index) {
  if (index !== 0 && index !== 1)
    throw new RangeError("Nieprawidłowy numer dźwięku");
  return [{ notes: [question.notes[index]], duration: NOTE_DURATION, gap: 0 }];
}
export function submitPairAnswer(question, choice) {
  if (
    question.solved ||
    !["same", "different"].includes(choice) ||
    question.wrongAnswers.includes(choice)
  )
    return "ignored";
  if (choice !== question.kind) {
    question.wrongAnswers.push(choice);
    return "wrong";
  }
  question.solved = true;
  return "correct";
}
export function pairRecord(question) {
  if (!question.solved) throw new Error("Zadanie nie zostało ukończone");
  return {
    kind: question.kind,
    attempts: question.wrongAnswers.length + 1,
    firstTry: question.wrongAnswers.length === 0,
    replayCounts: [...question.replayCounts],
  };
}
