// Pitch classes, not scale degrees. B in European notation means B-flat; H is B-natural.
export const NOTE_COLORS = Object.freeze(
  [
    { name: "C", hex: "#E53935" },
    { name: "C♯ / D♭", hex: "#9B1C20" },
    { name: "D", hex: "#F58220" },
    { name: "D♯ / E♭", hex: "#A64B00" },
    { name: "E", hex: "#F9D635" },
    { name: "F", hex: "#36A657" },
    { name: "F♯ / G♭", hex: "#176B3A" },
    { name: "G", hex: "#2474D2" },
    { name: "G♯ / A♭", hex: "#800020" },
    { name: "A", hex: "#8046B5" },
    { name: "A♯ / B", hex: "#A8DDB5" },
    { name: "H", hex: "#EF87B5" },
  ].map(Object.freeze),
);

export function noteColor(midi) {
  if (!Number.isInteger(midi))
    throw new TypeError("Wysokość MIDI musi być liczbą całkowitą");
  return NOTE_COLORS[((midi % 12) + 12) % 12];
}

// Choose the higher WCAG contrast ratio (black or white), including future palette edits.
export function colorText(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#FFFFFF";
}
