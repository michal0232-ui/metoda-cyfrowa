import "./styles.css";
import { DEGREES, getKey } from "./music/theory.js";
import { AudioEngine, delay } from "./audio/engine.js";
import { SampleInstrument } from "./audio/sample-instrument.js";
import { salamander } from "./audio/instruments/salamander.js";
import { majorDegrees, resolutionPhrases } from "./exercises/major-degrees.js";
import { Staff } from "./notation/staff.js";
import { loadSettings, saveSettings } from "./settings/settings.js";
import { mountSettings } from "./settings/settings-ui.js";
import {
  answerContent,
  renderAnswerContent,
} from "./notation/answer-content.js";
import { Statistics } from "./statistics/statistics.js";

const $ = (id) => document.getElementById(id);
const settings = loadSettings();
const audio = new AudioEngine(new SampleInstrument(salamander));
const staff = new Staff($("notation"));
const statistics = new Statistics();
const exercise = majorDegrees;
let phase = "idle";
let question = null;
let controller = null;
let ready = false;

function status(message) {
  $("status").textContent = message;
}
function currentKey() {
  return question?.key ?? settings.key;
}
function clearScore() {
  staff.render(currentKey());
  $("key-badge").textContent = getKey(currentKey()).label;
  $("score-caption").textContent = "Nuta pojawi się po poprawnej odpowiedzi.";
}
function refreshControls() {
  const active = phase !== "idle";
  $("start").disabled = active || !ready;
  $("stop").disabled = !active;
  $("repeat").disabled = phase !== "answering";
  $("settings-fields").disabled = active;
  $("status-dot").classList.toggle(
    "playing",
    phase === "listening" || phase === "resolving",
  );
  $("step-listen").classList.toggle("active", phase === "listening");
  $("step-answer").classList.toggle("active", phase === "answering");
  $("step-resolve").classList.toggle(
    "active",
    phase === "resolving" || phase === "waiting",
  );
  for (const button of $("answers").children) {
    const degree = Number(button.dataset.degree);
    const content = answerContent(degree, currentKey(), settings.answerNames);
    const { label } = content;
    renderAnswerContent(button, content);
    const wrong = question?.wrongDegrees.includes(degree) ?? false;
    const correct = question?.solved && question.degree === degree;
    button.disabled = phase !== "answering" || wrong;
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
  status("Posłuchaj kadencji i pojedynczego dźwięku…");
  await audio.play(exercise.questionEvents(question), signal);
  if (signal.aborted) return;
  setPhase("answering");
  status("Który stopień gamy słyszysz?");
}
async function nextQuestion(signal) {
  if (signal.aborted) return;
  question = exercise.createQuestion(settings);
  clearScore();
  await playQuestion(signal);
}
async function start() {
  if (phase !== "idle" || !ready) return;
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
  const { signal } = controller;
  setPhase("resolving");
  try {
    statistics.record(question);
    renderStatistics();
    staff.render(question.key, question.note);
    const phrases = resolutionPhrases(question.key, question.degree);
    const notation = phrases
      .map((phrase) => phrase.map((note) => note.degree).join("–"))
      .join("  /  ");
    $("score-caption").textContent =
      `Stopień ${question.degree} · ${question.note.label} · ${notation}`;
    status(`Tak, to stopień ${question.degree}! Posłuchaj rozwiązania.`);
    await audio.play(exercise.resolutionEvents(question), signal);
    if (signal.aborted) return;
    setPhase("waiting");
    status("Za chwilę kolejne zadanie…");
    await delay(1500, signal);
    await nextQuestion(signal);
  } catch (error) {
    handleError(error, signal);
  }
}

for (const degree of DEGREES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.degree = degree;
  button.addEventListener("click", () => answer(degree));
  $("answers").append(button);
}
mountSettings(settings, {
  onKeyChange: () => {
    if (ready) clearScore();
    refreshControls();
  },
  onNamesChange: refreshControls,
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
refreshControls();
initialize();
