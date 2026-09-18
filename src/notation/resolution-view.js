export class ResolutionView {
  constructor(element) {
    this.element = element;
    this.cells = [];
    this.events = [];
  }
  show(phrases) {
    this.clear();
    phrases.forEach((phrase, index) => {
      const sequence = document.createElement("div");
      sequence.className = "resolution-sequence";
      sequence.setAttribute("role", "group");
      sequence.setAttribute(
        "aria-label",
        `Rozwiązanie ${index + 1}: ${phrase.map((note) => note.degree).join(" → ")}`,
      );
      phrase.forEach((note) => {
        const cell = document.createElement("span");
        cell.className = "resolution-note";
        cell.textContent = note.degree;
        cell.dataset.midi = note.midi;
        cell.setAttribute(
          "aria-label",
          `Stopień ${note.degree}, ${note.label}`,
        );
        sequence.append(cell);
        this.cells.push(cell);
        this.events.push(cell);
      });
      this.element.append(sequence);
      // Existing resolutionEvents inserts one silent event between phrases.
      if (index < phrases.length - 1) this.events.push(null);
    });
    this.element.classList.add("visible");
    this.element.removeAttribute("aria-hidden");
  }
  highlight(index) {
    const active = this.events[index];
    for (const cell of this.cells) {
      cell.classList.toggle("playing", cell === active);
      if (cell === active) cell.setAttribute("aria-current", "true");
      else cell.removeAttribute("aria-current");
    }
  }
  clear() {
    this.element.replaceChildren();
    this.element.classList.remove("visible");
    this.element.setAttribute("aria-hidden", "true");
    this.cells = [];
    this.events = [];
  }
}
