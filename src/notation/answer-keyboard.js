import { degreeNote } from "../music/theory.js";

const WHITE_PITCHES = [0, 2, 4, 5, 7, 9, 11];
// Absolute piano geometry, cropped at the two tonic keys (including black tonics).
export function keyboardKeys(key) {
  const start = degreeNote(key, 1).midi;
  const degrees = new Map(
    Array.from({ length: 7 }, (_, i) => [degreeNote(key, i + 1).midi, i + 1]),
  );
  degrees.set(start + 12, 1);
  const keys = Array.from({ length: 13 }, (_, i) => {
    const midi = start + i;
    const pitch = midi % 12;
    const white = WHITE_PITCHES.indexOf(pitch);
    const black = white < 0;
    const boundary = WHITE_PITCHES.filter((p) => p < pitch).length;
    return {
      midi,
      pitch,
      degree: degrees.get(midi),
      tone: black ? "black" : "white",
      left: Math.floor(midi / 12) * 7 + (black ? boundary - 0.31 : white),
      width: black ? 0.62 : 1,
    };
  });
  const left = keys[0].left;
  const width = keys.at(-1).left + keys.at(-1).width - left;
  return keys.map((k) => ({
    ...k,
    left: ((k.left - left) * 100) / width,
    width: (k.width * 100) / width,
  }));
}
export function arrangeAnswers(element, key, mode) {
  const keyboard = mode === "digits" || mode === "european";
  const signature = keyboard ? key : "tiles";
  if (element.dataset.layout === signature) return;
  element.dataset.layout = signature;
  element.classList.toggle("keyboard", keyboard);
  element
    .querySelectorAll(".unused-key, [data-upper-tonic]")
    .forEach((el) => el.remove());
  const buttons = [...element.querySelectorAll("button[data-degree]")];
  if (!keyboard) {
    for (const button of buttons) {
      for (const name of ["pitchClass", "keyTone", "midi"])
        delete button.dataset[name];
      button.style.removeProperty("--key-left");
      button.style.removeProperty("--key-width");
    }
    return;
  }
  for (const [index, keyInfo] of keyboardKeys(key).entries()) {
    let el;
    if (index === 12) {
      el = document.createElement("button");
      el.type = "button";
      el.dataset.degree = "1";
      el.dataset.upperTonic = "true";
      element.append(el);
    } else if (keyInfo.degree)
      el = buttons.find((b) => Number(b.dataset.degree) === keyInfo.degree);
    else {
      el = document.createElement("span");
      el.className = "unused-key";
      el.setAttribute("aria-hidden", "true");
      element.append(el);
    }
    el.dataset.midi = keyInfo.midi;
    el.dataset.pitchClass = keyInfo.pitch;
    el.dataset.keyTone = keyInfo.tone;
    el.style.setProperty("--key-left", `${keyInfo.left}%`);
    el.style.setProperty("--key-width", `${keyInfo.width}%`);
  }
}
