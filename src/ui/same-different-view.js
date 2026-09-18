import {
  createPair,
  pairEvents,
  replayEvents,
  submitPairAnswer,
  pairRecord,
} from "../exercises/same-different.js";
import { delay } from "../audio/engine.js";
import "./same-different.css";

export function mountSameDifferent(element, audio) {
  element.innerHTML = `
    <h2>Ten sam czy inny?</h2>
    <p id="pair-status" role="status" aria-live="polite">Posłuchaj dwóch dźwięków i porównaj je.</p>
    <div class="pair-replays" role="group" aria-label="Odsłuch dźwięków">
      <button id="pair-one" aria-label="Zagraj dźwięk 1" disabled>①</button>
      <button id="pair-two" aria-label="Zagraj dźwięk 2" disabled>②</button>
    </div>
    <div class="pair-answers" role="group" aria-label="Porównaj dźwięki">
      <button data-pair-answer="same" disabled>TEN SAM</button>
      <button data-pair-answer="different" disabled>INNY</button>
    </div>
    <div class="pair-transport">
      <button id="pair-start" class="primary">Rozpocznij trening</button>
      <button id="pair-stop" class="secondary" disabled>Zakończ</button>
    </div>
    <section class="pair-statistics" aria-label="Statystyki ćwiczenia Ten sam czy inny">
      <p>Ukończone: <strong id="pair-total">0</strong> · Za pierwszym razem: <strong id="pair-first">0</strong></p>
      <details><summary>Historia odpowiedzi</summary><ol id="pair-history"></ol></details>
    </section>`;
  const $ = (id) => element.querySelector(`#${id}`);
  const buttons = [...element.querySelectorAll("[data-pair-answer]")];
  const records = [];
  let phase = "idle",
    question = null,
    controller = null,
    active = false;
  function status(text) {
    $("pair-status").textContent = text;
  }
  function refresh() {
    $("pair-start").disabled = phase !== "idle";
    $("pair-stop").disabled = phase === "idle";
    $("pair-one").disabled = $("pair-two").disabled = phase !== "answering";
    for (const button of buttons) {
      const choice = button.dataset.pairAnswer;
      const wrong = question?.wrongAnswers.includes(choice);
      const correct = question?.solved && choice === question.kind;
      button.disabled = phase !== "answering" || wrong;
      button.classList.toggle("wrong", !!wrong);
      button.classList.toggle("correct", !!correct);
      button.textContent = `${choice === "same" ? "TEN SAM" : "INNY"}${wrong ? " ✕" : correct ? " ✓" : ""}`;
      button.setAttribute(
        "aria-label",
        `${choice === "same" ? "Ten sam" : "Inny"}${wrong ? " — błędna odpowiedź" : correct ? " — poprawna odpowiedź" : ""}`,
      );
    }
  }
  function stop() {
    controller?.abort();
    controller = null;
    audio.stop();
    question = null;
    phase = "idle";
    refresh();
    status("Trening zatrzymany. Możesz rozpocząć ponownie.");
  }
  function fail(error, signal) {
    if (signal.aborted || error.name === "AbortError") return;
    console.error(error);
    stop();
    status("Nie udało się odtworzyć dźwięków. Spróbuj rozpocząć ponownie.");
  }
  async function next(signal) {
    if (signal.aborted) return;
    question = createPair();
    phase = "playing";
    refresh();
    status("Posłuchaj dwóch dźwięków…");
    await audio.play(
      pairEvents(question, audio.instrument.definition.release),
      signal,
    );
    if (signal.aborted) return;
    phase = "answering";
    refresh();
    status("Ten sam czy inny? Wybierz odpowiedź.");
  }
  $("pair-start").addEventListener("click", async () => {
    if (!active || phase !== "idle") return;
    controller = new AbortController();
    const { signal } = controller;
    phase = "loading";
    refresh();
    try {
      if (!audio.ready) {
        status("Ładowanie fortepianu…");
        await audio.prepare();
      }
      if (!signal.aborted) await next(signal);
    } catch (error) {
      fail(error, signal);
    }
  });
  $("pair-stop").addEventListener("click", stop);
  for (const [index, id] of ["pair-one", "pair-two"].entries())
    $(id).addEventListener("click", async () => {
      if (phase !== "answering") return;
      const { signal } = controller;
      question.replayCounts[index]++;
      phase = "playing";
      refresh();
      status(`Posłuchaj dźwięku ${index + 1}…`);
      try {
        await audio.play(replayEvents(question, index), signal);
        if (signal.aborted) return;
        phase = "answering";
        refresh();
        status("Ten sam czy inny? Wybierz odpowiedź.");
      } catch (error) {
        fail(error, signal);
      }
    });
  for (const button of buttons)
    button.addEventListener("click", async () => {
      if (phase !== "answering") return;
      const result = submitPairAnswer(question, button.dataset.pairAnswer);
      if (result === "ignored") return;
      if (result === "wrong") {
        refresh();
        status("Spróbuj ponownie. Możesz jeszcze raz posłuchać obu dźwięków.");
        return;
      }
      const { signal } = controller;
      records.push(pairRecord(question));
      $("pair-total").textContent = records.length;
      $("pair-first").textContent = records.filter((r) => r.firstTry).length;
      const record = records.at(-1),
        row = document.createElement("li");
      row.textContent = `${record.kind === "same" ? "Ten sam" : "Inny"} · Próby: ${record.attempts} · Pierwsza poprawna: ${record.firstTry ? "tak" : "nie"}`;
      $("pair-history").prepend(row);
      phase = "waiting";
      refresh();
      status("Dobrze! Za chwilę następne zadanie.");
      try {
        await delay(1200, signal);
        await next(signal);
      } catch (error) {
        fail(error, signal);
      }
    });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active && phase !== "idle") stop();
  });
  refresh();
  return {
    activate() {
      active = true;
    },
    deactivate() {
      active = false;
      stop();
    },
  };
}
