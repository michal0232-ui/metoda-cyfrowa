export class AudioEngine {
  context = null;
  volume = 0.5;
  ready = false;
  constructor(instrument) {
    this.instrument = instrument;
  }
  createContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.65;
      this.master.connect(this.context.destination);
    }
  }
  async prepare(onProgress) {
    this.createContext();
    await this.instrument.load(this.context, onProgress);
    this.ready = true;
  }
  async unlock() {
    if (!this.ready) throw new Error("Instrument nie jest jeszcze załadowany");
    if (this.context.state !== "running") await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Przeglądarka nie uruchomiła dźwięku");
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.volume * 0.65,
        this.context.currentTime,
        0.025,
      );
  }
  async play(events, signal, onEvent) {
    await this.unlock();
    if (signal.aborted) throw new DOMException("Przerwano", "AbortError");
    let cursor = this.context.currentTime + 0.04;
    let end = cursor;
    const timeline = [];
    for (const [index, event] of events.entries()) {
      timeline.push({
        index,
        start: cursor,
        end: cursor + event.duration + (event.gap ?? 0),
        audible: event.notes.length > 0,
      });
      event.notes.forEach((midi) => {
        const voiceEnd = this.instrument.schedule(this.context, this.master, {
          midi,
          start: cursor,
          duration: event.duration,
          velocity: 0.8 / Math.sqrt(Math.max(1, event.notes.length)),
        });
        end = Math.max(end, voiceEnd);
      });
      cursor += event.duration + (event.gap ?? 0);
    }
    end = Math.max(end, cursor);
    // AudioContext time is authoritative, including when the device suspends audio.
    await new Promise((resolve, reject) => {
      let previous = null;
      const update = (index) => {
        if (previous !== index) {
          previous = index;
          onEvent?.(index);
        }
      };
      const cleanup = () => {
        clearInterval(timer);
        signal.removeEventListener("abort", abort);
        update(null);
      };
      const abort = () => {
        cleanup();
        this.stop();
        reject(new DOMException("Przerwano", "AbortError"));
      };
      const timer = setInterval(() => {
        const now = this.context.currentTime;
        if (onEvent)
          update(
            timeline.find(
              (event) => event.audible && now >= event.start && now < event.end,
            )?.index ?? null,
          );
        if (this.context.currentTime >= end) {
          cleanup();
          resolve();
        }
      }, 30);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  stop() {
    this.instrument.stop(this.context);
  }
}
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Przerwano", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Przerwano", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
