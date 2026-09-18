import { answerLabel } from "./answer-labels.js";

// One mapping for all gesture presentations. Vite includes these original files in builds.
export const GESTURE_IMAGES = Object.freeze({
  1: new URL("../../assets/gestures/do.png", import.meta.url).href,
  2: new URL("../../assets/gestures/re.png", import.meta.url).href,
  3: new URL("../../assets/gestures/mi.png", import.meta.url).href,
  4: new URL("../../assets/gestures/fa.png", import.meta.url).href,
  5: new URL("../../assets/gestures/sol.png", import.meta.url).href,
  6: new URL("../../assets/gestures/la.png", import.meta.url).href,
  7: new URL("../../assets/gestures/si.png", import.meta.url).href,
});

export function answerContent(degree, key, mode) {
  const label = answerLabel(degree, key, mode);
  return {
    label,
    image: mode === "gestures" ? GESTURE_IMAGES[degree] : null,
    text: mode === "gestures" ? null : label,
  };
}

// Image and text are independent, allowing future gesture + label combinations.
export function renderAnswerContent(button, { image, text }) {
  button.classList.toggle("gesture", Boolean(image));
  const signature = JSON.stringify([image, text]);
  if (button.dataset.content === signature) return;
  button.dataset.content = signature;
  button.replaceChildren();
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = ""; // The button supplies the accessible degree and solfege label.
    img.draggable = false;
    img.className = "answer-gesture";
    button.append(img);
  }
  if (text) {
    const span = document.createElement("span");
    span.textContent = text;
    button.append(span);
  }
}
