// Exercise descriptors provide isolated lifecycle hooks; the picker knows no training logic.
export function mountExercisePicker(exercises) {
  let current = exercises[0];
  const selects = ["exercise-select", "board-exercise-select"].map((id) =>
    document.getElementById(id),
  );
  for (const select of selects) {
    for (const exercise of exercises) {
      const option = document.createElement("option");
      option.value = exercise.id;
      option.textContent = exercise.label;
      select.append(option);
    }
    select.addEventListener("change", () => choose(select.value));
  }
  function choose(id) {
    const next = exercises.find((exercise) => exercise.id === id);
    if (!next || next === current) return;
    document.getElementById("board-settings-dialog").close();
    current.deactivate();
    current = next;
    render();
    current.activate();
  }
  function render() {
    for (const exercise of exercises)
      exercise.element.hidden = exercise !== current;
    for (const select of selects) select.value = current.id;
    document.getElementById("board-settings").hidden = !current.hasSettings;
    document.querySelector(".intro h1").textContent = current.heading;
    document.querySelector(".intro p:not(.eyebrow)").textContent =
      current.description;
  }
  render();
  return { isActive: (id) => current.id === id };
}
