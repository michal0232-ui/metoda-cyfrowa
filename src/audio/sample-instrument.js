export function nearestSample(samples, midi) {
  if (!samples.length) throw new Error("Brak sampli instrumentu");
  return samples.reduce((nearest, sample) =>
    Math.abs(sample.midi - midi) < Math.abs(nearest.midi - midi)
      ? sample
      : nearest,
  );
}

// Instrument contract: load(context, onProgress), schedule(context, output,
// { midi, start, duration, velocity }) -> end time, and stop(context).
// No fetch/decode operation is permitted in schedule().
export class SampleInstrument {
  buffers = new Map();
  voices = new Set();
  loading = null;
  constructor(definition) {
    this.definition = definition;
  }

  async load(context, onProgress = () => {}) {
    if (this.loading) return this.loading;
    const samples = this.definition.samples;
    let loaded = this.buffers.size;
    onProgress(loaded, samples.length);
    this.loading = (async () => {
      const results = await Promise.allSettled(
        samples.map(async (sample) => {
          if (this.buffers.has(sample.midi)) return;
          const response = await fetch(sample.url, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok)
            throw new Error(
              `Nie można wczytać sampla ${sample.url}: ${response.status}`,
            );
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          this.buffers.set(sample.midi, buffer);
          onProgress(++loaded, samples.length);
        }),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  schedule(context, output, { midi, start, duration, velocity }) {
    const { samples, minMidi, maxMidi, release } = this.definition;
    if (midi < minMidi || midi > maxMidi)
      throw new RangeError(`Dźwięk MIDI ${midi} poza zakresem instrumentu`);
    const sample = nearestSample(samples, midi);
    const buffer = this.buffers.get(sample.midi);
    if (!buffer) throw new Error("Instrument nie jest jeszcze załadowany");
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((midi - sample.midi) / 12);
    const envelope = context.createGain();
    const end = start + duration + release;
    // Preserve the recorded attack/decay; only soften onset and key release.
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(velocity, start + 0.003);
    envelope.gain.setValueAtTime(velocity, start + duration);
    envelope.gain.linearRampToValueAtTime(0, end);
    source.connect(envelope).connect(output);
    const voice = { source, envelope };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(end);
    return end;
  }

  stop(context) {
    if (!context) return;
    for (const { source, envelope } of this.voices) {
      envelope.gain.cancelAndHoldAtTime(context.currentTime);
      envelope.gain.linearRampToValueAtTime(0, context.currentTime + 0.015);
      source.stop(context.currentTime + 0.02);
    }
  }
}
