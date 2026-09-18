import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Accidental,
  Voice,
} from "vexflow/bravura";

// Board notation uses the available height for the stave instead of SVG margins.
export function fitStaffViewport(element) {
  element
    ?.querySelector("svg")
    ?.setAttribute(
      "viewBox",
      document.documentElement.classList.contains("board-mode")
        ? "0 35 640 120"
        : "0 0 640 180",
    );
}

export class Staff {
  constructor(element) {
    this.element = element;
  }
  render(key = "C", note = null, noteColor = "#000000") {
    this.element.replaceChildren();
    const renderer = new Renderer(this.element, Renderer.Backends.SVG);
    renderer.resize(640, 180);
    const context = renderer.getContext();
    context.setFillStyle("#263c37");
    context.setStrokeStyle("#263c37");
    const stave = new Stave(20, 35, 600).addClef("treble").addKeySignature(key);
    stave.setContext(context).draw();
    if (note) {
      const glyph = new StaveNote({
        keys: [note.vexKey],
        duration: "w",
        clef: "treble",
        align_center: true,
      });
      glyph.setKeyStyle(0, { fillStyle: noteColor, strokeStyle: noteColor });
      // The note spelling carries its actual accidental; applyAccidentals compares
      // it with the key signature to show only signs that are needed.
      const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables([
        glyph,
      ]);
      Accidental.applyAccidentals([voice], key);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(context, stave);
    }
    const svg = this.element.querySelector("svg");
    fitStaffViewport(this.element);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("aria-hidden", "true");
    this.element.setAttribute(
      "aria-label",
      note
        ? `Zagrany dźwięk: ${note.label}`
        : "Pusta pięciolinia z kluczem wiolinowym",
    );
  }
}
