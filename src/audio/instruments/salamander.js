// Sample map is independent of scales, exercises and the playback scheduler.
export const salamander = {
  id: "salamander-grand-piano",
  name: "Salamander Grand Piano",
  minMidi: 40,
  maxMidi: 77,
  release: 0.12,
  samples: [
    [39, "Ds2"],
    [42, "Fs2"],
    [45, "A2"],
    [48, "C3"],
    [51, "Ds3"],
    [54, "Fs3"],
    [57, "A3"],
    [60, "C4"],
    [63, "Ds4"],
    [66, "Fs4"],
    [69, "A4"],
    [72, "C5"],
    [75, "Ds5"],
    [78, "Fs5"],
  ].map(([midi, file]) => ({ midi, url: `/audio/salamander/${file}.mp3` })),
};
