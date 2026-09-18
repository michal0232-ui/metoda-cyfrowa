// Session state only: question generation and answer validation stay in the exercise.
export class TonalitySession {
  constructor(settings) {
    this.kind = settings.reminderKind;
    this.every = settings.reminderEvery;
    this.completed = 0;
    this.previousKey = null;
    this.counted = new WeakSet();
  }
  beginQuestion(question) {
    const first = this.previousKey === null;
    const changed = !first && question.key !== this.previousKey;
    const periodic =
      this.every > 0 && this.completed > 0 && this.completed % this.every === 0;
    this.previousKey = question.key;
    // One decision, so a key change and a periodic reminder cannot duplicate audio.
    return first ? "cadence" : changed || periodic ? this.kind : null;
  }
  complete(question) {
    if (!question.solved || this.counted.has(question)) return;
    this.counted.add(question);
    this.completed++;
  }
}
