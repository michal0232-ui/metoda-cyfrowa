export class Statistics {
  records = [];
  record(question) {
    if (!question.solved)
      throw new Error("Nie można zapisać nierozwiązanego zadania");
    this.records.push({
      degree: question.degree,
      key: question.key,
      attempts: question.wrongDegrees.length + 1,
      wrongDegrees: [...question.wrongDegrees],
      completedAt: new Date().toISOString(),
    });
  }
  summary() {
    const total = this.records.length;
    return {
      total,
      firstTry: this.records.filter((r) => r.attempts === 1).length,
      average: total
        ? this.records.reduce((sum, r) => sum + r.attempts, 0) / total
        : 0,
    };
  }
}
