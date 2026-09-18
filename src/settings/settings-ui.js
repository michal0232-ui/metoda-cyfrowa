import { DEGREES, KEYS } from "../music/theory.js";
import { saveSettings, resetSettings } from "./settings.js";

export function mountSettings(
  settings,
  { onKeyChange, onNamesChange, onReset },
) {
  const $ = (id) => document.getElementById(id);
  function commitKeys() {
    if (!settings.keys.includes(settings.key)) settings.key = settings.keys[0];
    $("key").replaceChildren(
      ...KEYS.filter((key) => settings.keys.includes(key.id)).map(
        (key) => new Option(key.label, key.id),
      ),
    );
    $("key").value = settings.key;
    $("key").disabled = settings.mixKeys;
    $("mix-keys").checked = settings.mixKeys;
    for (const input of $("key-toggles").querySelectorAll("input"))
      input.checked = settings.keys.includes(input.value);
    $("key-count").textContent = `(${settings.keys.length}/${KEYS.length})`;
    $("key-selection-note").textContent =
      `Zaznaczone tonacje: ${settings.keys.length} z ${KEYS.length}. Co najmniej jedna musi pozostać zaznaczona.`;
    $("key-mode-note").textContent = settings.mixKeys
      ? "Każde zadanie losuje tonację z zaznaczonych. Tonacja może się powtórzyć."
      : "Trening pozostaje w tej tonacji. Włącz mieszanie, aby korzystać z całego zestawu.";
    saveSettings(settings);
    onKeyChange();
  }
  for (const key of KEYS) {
    const label = document.createElement("label");
    label.className = "degree-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key.id;
    input.setAttribute("aria-label", `Tonacja ${key.label}`);
    const span = document.createElement("span");
    span.textContent = key.label;
    label.append(input, span);
    $("key-toggles").append(label);
    input.addEventListener("change", () => {
      if (!input.checked && settings.keys.length === 1) {
        input.checked = true;
        $("key-selection-note").textContent =
          "Pozostaw zaznaczoną co najmniej jedną tonację.";
        return;
      }
      settings.keys = Array.from(
        $("key-toggles").querySelectorAll("input:checked"),
        (input) => input.value,
      );
      commitKeys();
    });
  }
  $("all-keys").addEventListener("click", () => {
    settings.keys = KEYS.map((key) => key.id);
    commitKeys();
  });
  $("only-key").addEventListener("click", () => {
    settings.keys = [settings.key];
    commitKeys();
  });
  $("key").addEventListener("change", () => {
    settings.key = $("key").value;
    commitKeys();
  });
  $("mix-keys").addEventListener("change", () => {
    settings.mixKeys = $("mix-keys").checked;
    commitKeys();
  });
  $("reminder-kind").value = settings.reminderKind;
  // Retain valid custom numeric frequencies loaded from future settings.
  if (![0, 1, 2, 3, 5, 10].includes(settings.reminderEvery))
    $("reminder-every").add(
      new Option(
        `Co ${settings.reminderEvery} odpowiedzi`,
        String(settings.reminderEvery),
      ),
    );
  $("reminder-every").value = String(settings.reminderEvery);
  $("reminder-kind").addEventListener("change", () => {
    settings.reminderKind = $("reminder-kind").value;
    saveSettings(settings);
  });
  $("reminder-every").addEventListener("change", () => {
    settings.reminderEvery = Number($("reminder-every").value);
    saveSettings(settings);
  });
  $("answer-names").value = settings.answerNames;
  $("answer-names").addEventListener("change", () => {
    settings.answerNames = $("answer-names").value;
    saveSettings(settings);
    onNamesChange();
  });
  $("note-colors").value = settings.noteColors ? "on" : "off";
  $("note-colors").addEventListener("change", () => {
    settings.noteColors = $("note-colors").value === "on";
    saveSettings(settings);
    onNamesChange();
  });
  for (const degree of DEGREES) {
    const label = document.createElement("label");
    label.className = "degree-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = degree;
    input.checked = settings.degrees.includes(degree);
    input.setAttribute("aria-label", `Ćwicz stopień ${degree}`);
    const span = document.createElement("span");
    span.textContent = degree;
    label.append(input, span);
    $("degree-toggles").append(label);
    input.addEventListener("change", () => {
      if (!input.checked && settings.degrees.length === 1) {
        input.checked = true;
        $("selection-note").textContent =
          "Pozostaw zaznaczony co najmniej jeden stopień.";
        return;
      }
      settings.degrees = Array.from(
        $("degree-toggles").querySelectorAll("input:checked"),
        (item) => Number(item.value),
      );
      $("selection-note").textContent =
        `Wybrano ${settings.degrees.length} z 7 stopni.`;
      saveSettings(settings);
    });
  }
  $("reset-settings").addEventListener("click", () => {
    if (
      !window.confirm(
        "Przywrócić wszystkie ustawienia domyślne? Zapisane preferencje zostaną zastąpione.",
      )
    )
      return;
    Object.assign(settings, resetSettings());
    for (const input of $("degree-toggles").querySelectorAll("input"))
      input.checked = settings.degrees.includes(Number(input.value));
    $("selection-note").textContent =
      `Wybrano ${settings.degrees.length} z 7 stopni.`;
    $("answer-names").value = settings.answerNames;
    $("note-colors").value = settings.noteColors ? "on" : "off";
    $("reminder-kind").value = settings.reminderKind;
    $("reminder-every").value = String(settings.reminderEvery);
    commitKeys();
    onNamesChange();
    onReset();
  });
  // Build settings before notation/fonts are ready; initial rendering stays in app.js.
  commitKeys();
}
