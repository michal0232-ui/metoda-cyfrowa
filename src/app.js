import "./styles.css";
import { mountExercisePicker } from "./ui/exercise-picker.js";
import { mountSameDifferent } from "./ui/same-different-view.js";
import { mountBoardMode } from "./ui/board-mode.js";
import { DEGREES, getKey, degreeNote } from "./music/theory.js";
import { absoluteNote } from "./music/absolute-note.js";
import { arrangeAnswers } from "./notation/answer-keyboard.js";
import { ResolutionView } from "./notation/resolution-view.js";
import { AudioEngine, delay } from "./audio/engine.js";
import { SampleInstrument } from "./audio/sample-instrument.js";
import { salamander } from "./audio/instruments/salamander.js";
import { majorDegrees, resolutionPhrases } from "./exercises/major-degrees.js";
import { TonalitySession } from "./exercises/tonality-session.js";
import { Staff } from "./notation/staff.js";
import { loadSettings, saveSettings } from "./settings/settings.js";
import { mountSettings } from "./settings/settings-ui.js";
import {
  answerContent,
  renderAnswerContent,
} from "./notation/answer-content.js";
import { Statistics } from "./statistics/statistics.js";

const $ = (id) => document.getElementById(id);
mountBoardMode();
const settings = loadSettings();
const audio = new AudioEngine(new SampleInstrument(salamander));
const staff = new Staff($("notation"));
const resolution = new ResolutionView($("resolution"));
const statistics = new Statistics();
const exercise = majorDegrees;
let phase = "idle";
let question = null;
let controller = null;
let ready = false;
let tonalitySession = null;
let questionReminder = null;

function status(message) {
  $("status").textContent = message;
}
function currentKey() {
  return question?.key ?? settings.key;
}
function clearScore() {
  resolution.clear();
  $("absolute-answer").hidden = true;
  staff.render(currentKey());
  $("key-badge").textContent = getKey(currentKey()).label;
  $("score-caption").textContent = "Nuta pojawi się po poprawnej odpowiedzi.";
}
function renderRecognizedNote() {
  const recognized = question?.solved ? absoluteNote(question.note) : null;
  $("absolute-answer").hidden = !recognized || !settings.noteColors;
  if (!recognized) return;
  staff.render(
    question.key,
    question.note,
    settings.noteColors ? recognized.color : "#000000",
  );
  $("absolute-name").textContent = recognized.name;
  $("absolute-swatch").style.backgroundColor = recognized.color;
  $("absolute-answer").setAttribute(
    "aria-label",
    `Dźwięk absolutny: ${recognized.name}`,
  );
}
function refreshControls() {
  renderRecognizedNote();
  const active = phase !== "idle";
  $("start").disabled = active || !ready;
  $("stop").disabled = !active;
  $("repeat").disabled = phase !== "answering";
  $("resolution-hint").disabled = phase !== "answering";
  $("settings-fields").disabled = active;
  $("status-dot").classList.toggle(
    "playing",
    phase === "listening" || phase === "resolving" || phase === "hinting",
  );
  $("step-listen").classList.toggle("active", phase === "listening");
  $("step-answer").classList.toggle(
    "active",
    phase === "answering" || phase === "hinting",
  );
  $("step-resolve").classList.toggle(
    "active",
    phase === "resolving" || phase === "waiting",
  );
  arrangeAnswers($("answers"), currentKey(), settings.answerNames);
  for (const button of $("answers").querySelectorAll("button[data-degree]")) {
    const degree = Number(button.dataset.degree);
    const content = answerContent(degree, currentKey(), settings.answerNames);
    const { label } = content;
    renderAnswerContent(button, content);
    let band = button.querySelector(".note-color-dot");
    const colored =
      settings.noteColors &&
      ["digits", "european"].includes(settings.answerNames);
    if (colored) {
      if (!band) {
        band = document.createElement("span");
        band.className = "note-color-dot";
        band.setAttribute("aria-hidden", "true");
        button.append(band);
      }
      band.style.backgroundColor = absoluteNote(
        degreeNote(currentKey(), degree),
      ).color;
    } else band?.remove();

    const wrong = question?.wrongDegrees.includes(degree) ?? false;
    const correct = question?.solved && question.degree === degree;
    // Keep answer appearance unchanged during audio-only help; answer() guards interaction.
    button.disabled = !["answering", "hinting"].includes(phase) || wrong;
    button.setAttribute(
      "aria-disabled",
      String(button.disabled || phase === "hinting"),
    );
    button.classList.toggle("wrong", wrong);
    button.classList.toggle("correct", Boolean(correct));
    button.setAttribute(
      "aria-label",
      `Stopień ${degree}${settings.answerNames === "digits" ? "" : ` — ${label}`}${wrong ? " — błędna odpowiedź" : correct ? " — poprawna odpowiedź" : ""}`,
    );
  }
}
function setPhase(value) {
  phase = value;
  refreshControls();
}
function renderStatistics() {
  const { total, firstTry, average } = statistics.summary();
  $("stat-total").textContent = total;
  $("stat-first").textContent = total
    ? `${Math.round((firstTry / total) * 100)}%`
    : "—";
  $("stat-average").textContent = total
    ? average.toLocaleString("pl-PL", { maximumFractionDigits: 2 })
    : "—";
  $("history-count").textContent = `(${total})`;
  $("history-empty").hidden = total > 0;
  $("history-table").hidden = total === 0;
  // Only append the new record; completed tasks are never recorded again on replay.
  const record = statistics.records.at(-1);
  if (record) {
    const row = document.createElement("tr");
    [
      total,
      getKey(record.key).label,
      record.degree,
      record.attempts,
      record.wrongDegrees.join(" → ") || "—",
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    $("history").prepend(row);
  }
}
function stop(
  message = "Trening zakończony. Możesz zmienić ustawienia i zacząć ponownie.",
) {
  controller?.abort();
  controller = null;
  audio.stop();
  question = null;
  tonalitySession = null;
  questionReminder = null;
  setPhase("idle");
  clearScore();
  status(message);
}
function handleError(error, signal) {
  if (error.name === "AbortError" || signal?.aborted) return;
  console.error(error);
  stop(
    "Nie udało się odtworzyć ćwiczenia. Kliknij „Rozpocznij trening”, aby spróbować ponownie.",
  );
}
async function playQuestion(signal) {
  setPhase("listening");
  status(
    questionReminder === "cadence"
      ? "Posłuchaj kadencji i pojedynczego dźwięku…"
      : questionReminder === "tonic"
        ? "Posłuchaj prymy i pojedynczego dźwięku…"
        : "Posłuchaj pojedynczego dźwięku…",
  );
  await audio.play(exercise.questionEvents(question, questionReminder), signal);
  if (signal.aborted) return;
  setPhase("answering");
  status("Który stopień gamy słyszysz?");
}
async function nextQuestion(signal) {
  if (signal.aborted) return;
  question = exercise.createQuestion(settings);
  questionReminder = tonalitySession.beginQuestion(question);
  clearScore();
  await playQuestion(signal);
}
async function start() {
  if (phase !== "idle" || !ready) return;
  tonalitySession = new TonalitySession(settings);
  controller = new AbortController();
  const { signal } = controller;
  setPhase("listening");
  try {
    await nextQuestion(signal);
  } catch (error) {
    handleError(error, signal);
  }
}
async function answer(degree) {
  if (phase !== "answering") return;
  const result = exercise.submitAnswer(question, degree);
  if (result === "ignored") return;
  if (result === "wrong") {
    refreshControls();
    status("To nie ten stopień. Posłuchaj w myślach i spróbuj dalej.");
    return;
  }
  tonalitySession.complete(question);
  const { signal } = controller;
  setPhase("resolving");
  try {
    statistics.record(question);
    renderStatistics();
    renderRecognizedNote();
    const phrases = resolutionPhrases(question.key, question.degree);
    resolution.show(phrases);
    const notation = phrases
      .map((phrase) => phrase.map((note) => note.degree).join("–"))
      .join("  /  ");
    $("score-caption").textContent =
      `Stopień ${question.degree} · ${question.note.label} · ${notation}`;
    status(`Tak, to stopień ${question.degree}! Posłuchaj rozwiązania.`);
    await audio.play(exercise.resolutionEvents(question), signal, (index) =>
      resolution.highlight(index),
    );
    if (signal.aborted) return;
    setPhase("waiting");
    status("Za chwilę kolejne zadanie…");
    await delay(3000, signal);
    await nextQuestion(signal);
  } catch (error) {
    handleError(error, signal);
  }
}

for (const degree of DEGREES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.degree = degree;
  $("answers").append(button);
}
$("answers").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-degree]");
  if (button && !button.disabled) answer(Number(button.dataset.degree));
});
mountSettings(settings, {
  onKeyChange: () => {
    if (ready) clearScore();
    refreshControls();
  },
  onNamesChange: refreshControls,
  onReset: () => {
    $("volume").value = settings.volume * 100;
    updateVolume();
  },
});
$("volume").value = settings.volume * 100;
function updateVolume() {
  settings.volume = Number($("volume").value) / 100;
  $("volume-value").textContent = `${Math.round(settings.volume * 100)}%`;
  audio.setVolume(settings.volume);
}
updateVolume();
$("volume").addEventListener("input", () => {
  updateVolume();
  saveSettings(settings);
});
$("start").addEventListener("click", start);
$("stop").addEventListener("click", () => stop());
$("resolution-hint").addEventListener("click", async () => {
  if (phase !== "answering") return;
  const { signal } = controller;
  setPhase("hinting");
  status("Posłuchaj rozwiązania, a następnie wybierz odpowiedź.");
  try {
    // Same production events as a correct answer; deliberately no visual callback.
    await audio.play(exercise.resolutionEvents(question), signal);
    if (signal.aborted) return;
    setPhase("answering");
    status("Który stopień gamy słyszysz?");
  } catch (error) {
    handleError(error, signal);
  }
});
$("repeat").addEventListener("click", async () => {
  if (phase !== "answering") return;
  const { signal } = controller;
  try {
    await playQuestion(signal);
  } catch (error) {
    handleError(error, signal);
  }
});
document.addEventListener("keydown", (event) => {
  if (
    !exercisePicker.isActive("major-degrees") ||
    $("board-settings-dialog").open ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)
  )
    return;
  if (/^[1-7]$/.test(event.key)) {
    event.preventDefault();
    answer(Number(event.key));
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase !== "idle")
    stop(
      "Trening zatrzymany po opuszczeniu karty. Kliknij „Rozpocznij trening”, aby wrócić.",
    );
});
async function initialize() {
  ready = false;
  $("retry-audio").hidden = true;
  $("start").textContent = "Ładowanie fortepianu…";
  refreshControls();
  try {
    // The full VexFlow package embeds fonts locally; no external font request.
    await document.fonts.ready;
    clearScore();
    document.documentElement.removeAttribute("data-settings-pending");
    await audio.prepare((loaded, total) => {
      status(`Ładowanie fortepianu: ${loaded}/${total} sampli…`);
    });
    ready = true;
    status("Fortepian gotowy. Rozpocznij, by usłyszeć pierwsze zadanie.");
    $("start").textContent = "▶  Rozpocznij trening";
    refreshControls();
  } catch (error) {
    console.error(error);
    $("start").textContent = "Fortepian niedostępny";
    $("retry-audio").hidden = false;
    status(
      "Nie udało się przygotować treningu. Sprawdź pliki aplikacji i ponów ładowanie.",
    );
  }
}
$("retry-audio").addEventListener("click", initialize);
const pairView = mountSameDifferent($("same-different"), audio);
const exercisePicker = mountExercisePicker([
  {
    id: "major-degrees",
    label: "Rozpoznawanie stopni",
    element: document.querySelector(".workspace"),
    hasSettings: true,
    heading: "Poczuj miejsce dźwięku.",
    description: "Rozpoznawaj stopnie gamy i usłysz, jak wracają do toniki.",
    activate: () => {},
    deactivate: () => stop(),
  },
  {
    id: "same-different",
    label: "Ten sam czy inny?",
    element: $("same-different"),
    hasSettings: false,
    heading: "Ten sam czy inny?",
    description: "Posłuchaj dwóch dźwięków i porównaj je.",
    ...pairView,
  },
]);
refreshControls();
initialize();
