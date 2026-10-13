"use strict";

(() => {
  const demo = document.getElementById("ecg-demo");
  if (!demo) return;

  const stepCount = 8;
  const stepDuration = 4000;
  const duration = stepCount * stepDuration;
  const restingTime = duration - 1000;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const byId = id => document.getElementById(id);
  const ui = {
    title: byId("demo-title"), count: byId("phase-count"), caption: byId("phase-caption"),
    network: demo.querySelector(".demo-network"), learningArrow: demo.querySelector(".learning-route svg"),
    wave: byId("edited-wave"), comparison: byId("wave-comparison"), nextBatch: byId("next-batch"),
    region: byId("pr-region"), prBracket: byId("pr-bracket"), prLabel: byId("pr-label"),
    rrBracket: byId("rr-bracket"), rrLabel: byId("rr-label"), scan: byId("scan-line"),
    measure: byId("source-measurement"), measurePacket: byId("measurement-packet"),
    target: byId("target-check"), protect: byId("protect-check"), answer: byId("answer-check"),
    construction: byId("construction-feedback"), admission: byId("admission-label"),
    question: byId("ecg-question"), questionAnswer: byId("question-answer"), questionState: byId("question-state"),
    examplePacket: byId("example-packet"), feedbackPacket: byId("feedback-packet"),
    operator: byId("operator-rule"), recipe: byId("prompt-rule"), sampling: byId("sampling-rule"),
    operatorValue: byId("operator-value"), recipeValue: byId("prompt-value"), samplingValue: byId("sampling-value"),
    agent: byId("agent-state"), version: byId("agent-version"), student: byId("student-status"), studentHeading: byId("student-heading"),
    diagnosis: byId("feedback-diagnosis"), diagnosisContent: byId("diagnosis-content"), diagnosisPlaceholder: byId("diagnosis-placeholder"), diagnosisPacket: byId("diagnosis-packet"),
    learnerReturn: demo.querySelector(".learner-return"), returnSvg: demo.querySelector(".learner-return svg"), returnPath: byId("learner-return-path"), branches: [...demo.querySelectorAll(".branch-node")],
    branchRoutes: [...demo.querySelectorAll(".branch-route")], branchPackets: [...demo.querySelectorAll(".branch-packet")],
    branchStem: demo.querySelector(".branch-stem"), branchOrigin: byId("branch-origin"), branchGroups: [...demo.querySelectorAll(".branch-candidate")], learnerPlaceholder: byId("learner-placeholder"),
    evaluation: byId("evaluation-exit"), evaluationPacket: byId("evaluation-packet"), controlCount: byId("control-phase"),
    pairCards: [0, 1, 2].map(i => byId(`candidate-${i}`)),
    play: byId("play-toggle"), steps: [...demo.querySelectorAll("[data-step-to]")],
    progress: byId("animation-progress"), progressBar: demo.querySelector("[role=progressbar]")
  };
  const titles = [
    "PR-interval measurement", "Targeted waveform construction",
    "R–R constraint repair", "Waveform and answer verification",
    "Development error diagnosis", "Matched candidate selection",
    "Next-round ECG synthesis", "Independent ECG evaluation"
  ];
  const cycleLayers = [...demo.querySelectorAll(
    "#signal-scene, .construction-checks, #question-answer, #question-state, .learning-route, " +
    ".agent-rules, #agent-version, .diagnosis-body, .branch-scene, #student-heading, #student-status"
  )];
  const captions = [
    "PR spans P onset to QRS onset; protect R–R and QRS morphology.",
    "PQ stretching lengthens PR but introduces R–R drift.",
    "TP compensation restores R–R; PR stays longer and QRS is preserved.",
    "Remeasured waveform facts support the answer before training.",
    "Development feedback motivates three candidate teaching recipes.",
    "Compare same-parent branches on a separate development selection set.",
    "The retained recipe creates PR contrast pairs that await verification.",
    "Held-out ECG benchmarks assess generalization independently."
  ];
  const studentLabels = [
    "Current ECG learner", "Current ECG learner", "Current ECG learner",
    "Verified ECG Q/A → training", "Development feedback → proposals",
    "Separate development selection", "Retained recipe → new candidates",
    "Retained learner → external evaluation"
  ];
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
  let position = reducedMotion.matches ? restingTime : 0;
  let playing = !reducedMotion.matches;
  let lastTick = null;
  let request = null;
  let returnSize = "";
  let returnLength = 0;

  // Symbolic ECG geometry: the P wave moves while QRS/T shapes remain intact.
  // R–R drift in the first attempt is repaired through TP compensation.
  function waveform(pr, rr) {
    const y = 213;
    const parts = [`M22 ${y}`];
    for (let i = 0; i < 3; i += 1) {
      const r = 154 + i * rr;
      const p = r - pr;
      parts.push(
        `L${p - 16} ${y}`,
        `C${p - 10} ${y} ${p - 11} ${y - 12} ${p - 2} ${y - 14}`,
        `C${p + 6} ${y - 16} ${p + 12} ${y} ${p + 16} ${y}`,
        `L${r - 12} ${y} L${r - 7} ${y + 10} L${r} ${y - 48} L${r + 6} ${y + 20} L${r + 13} ${y}`,
        `L${r + 30} ${y} C${r + 44} ${y} ${r + 47} ${y - 22} ${r + 61} ${y - 24}`,
        `C${r + 77} ${y - 25} ${r + 87} ${y} ${r + 96} ${y}`
      );
    }
    return parts.join(" ");
  }

  function check(node, status) {
    node.classList.toggle("pass", status === "pass");
    node.classList.toggle("fail", status === "fail");
    node.querySelector("i").textContent = status === "pass" ? "✓" : status === "fail" ? "×" : "·";
  }

  function reveal(node, amount) {
    const opacity = clamp(amount);
    node.style.opacity = String(opacity);
    node.setAttribute("aria-hidden", opacity < 0.01 ? "true" : "false");
  }

  function render(time) {
    position = ((time % duration) + duration) % duration;
    const step = Math.floor(position / stepDuration);
    const p = (position % stepDuration) / stepDuration;
    const stretch = step === 1 ? ease((p - 0.12) / 0.65) : step > 1 ? 1 : 0;
    const repair = step === 2 ? ease((p - 0.1) / 0.64) : step > 2 ? 1 : 0;
    const pr = 46 + 46 * stretch;
    const rr = 210 + 26 * stretch * (1 - repair);
    const operatorChanged = step > 2 || (step === 2 && p > 0.8);
    const selected = step > 5 || (step === 5 && p > 0.72);
    const recipeChanged = selected;
    const targetReady = step > 1 || (step === 1 && p > 0.8);
    const protectedReady = step > 2 || (step === 2 && p > 0.8);
    const answerReady = step > 3 || (step === 3 && p > 0.68);
    const nextCandidates = step >= 6;
    const drift = rr > 214;
    const cyclePresence = ease(position / 400) * (1 - ease((position - (duration - 500)) / 500));
    const diagnosisReveal = ease((position - (4 * stepDuration + 680)) / 500);
    const treeReveal = ease((position - (4 * stepDuration + 1500)) / 450);

    demo.dataset.step = String(step);
    demo.dataset.focus = step === 7 ? "evaluation" : step === 4 || step === 5 ? "development" : "signal";
    ui.title.textContent = titles[step];
    ui.count.textContent = `${String(step + 1).padStart(2, "0")} / 08`;
    ui.controlCount.textContent = `${step + 1} / ${stepCount}`;
    ui.caption.textContent = captions[step];
    ui.student.textContent = step === 3 && !answerReady ? "Waveform and answer checks" : studentLabels[step];
    ui.studentHeading.textContent = step >= 6 ? "Retained branch" : step === 5 ? "Same parent · matched training" : treeReveal > 0 ? "Recipe candidates" : "ECG learner";
    reveal(ui.network, 1);
    cycleLayers.forEach(node => reveal(node, cyclePresence));
    reveal(ui.diagnosisContent, diagnosisReveal);
    reveal(ui.diagnosisPlaceholder, 1 - ease((position - (4 * stepDuration + 400)) / 220));
    reveal(ui.branchOrigin, treeReveal);
    reveal(ui.learnerPlaceholder, 1 - treeReveal);
    ui.wave.setAttribute("d", waveform(pr, rr));
    const prStart = 154 - pr - 16;
    ui.region.setAttribute("x", prStart.toFixed(3));
    ui.region.setAttribute("width", (142 - prStart).toFixed(3));
    ui.prBracket.setAttribute("d", `M${prStart} 251v7H142v-7`);
    ui.prLabel.setAttribute("x", ((prStart + 142) / 2).toFixed(3));
    ui.prLabel.textContent = stretch > 0.5 ? "PR longer" : "PR interval";
    ui.rrBracket.setAttribute("d", `M154 163v-9H${154 + rr}v9`);
    ui.rrLabel.setAttribute("x", (154 + rr / 2).toFixed(3));
    ui.rrLabel.textContent = drift ? "R–R drift" : "R–R preserved";
    ui.rrLabel.style.fill = drift ? "var(--ecg-red)" : "var(--ecg-purple)";
    ui.rrBracket.style.stroke = drift ? "var(--ecg-red)" : "var(--ecg-purple)";
    ui.measure.style.opacity = step === 0 ? "1" : "0";
    ui.measurePacket.setAttribute("cx", String(92 + 50 * ease((p - 0.1) / 0.7)));
    reveal(ui.comparison, 1 - ease((position - (6 * stepDuration - 300)) / 300));
    reveal(ui.nextBatch, ease((position - 6 * stepDuration) / 350));
    ui.pairCards.forEach((card, i) => {
      const arrival = step === 6 ? clamp((p - i * 0.17) / 0.18) : 1;
      card.style.opacity = String(arrival);
      card.style.visibility = nextCandidates ? "visible" : "hidden";
    });
    ui.scan.setAttribute("x1", String(24 + 666 * clamp(p / 0.7)));
    ui.scan.setAttribute("x2", String(24 + 666 * clamp(p / 0.7)));
    ui.scan.style.opacity = step === 3 ? String(0.8 * ease(p / 0.06) * (1 - ease((p - 0.55) / 0.1))) : "0";

    check(ui.target, nextCandidates ? "pending" : targetReady ? "pass" : "pending");
    check(ui.protect, nextCandidates ? "pending" : protectedReady ? "pass" : drift ? "fail" : "pending");
    check(ui.answer, nextCandidates ? "pending" : answerReady ? "pass" : "pending");
    ui.construction.classList.toggle("active", step === 1 || step === 2);
    ui.construction.textContent = step === 1 ? drift ? "R–R drift → construction repair" : "Lengthen PQ → remeasure ECG" : step === 2 ? "TP compensation → restore R–R" : nextCandidates ? "New candidates → repeat waveform checks" : "Waveform checks → grounded supervision";
    ui.admission.textContent = !nextCandidates && answerReady ? "Verified ECG Q/A" : "Candidate ECG Q/A";
    ui.question.dataset.state = nextCandidates ? "candidate" : answerReady ? "verified" : drift ? "repair" : "checking";
    ui.questionAnswer.textContent = nextCandidates ? "PR contrasts at matched R–R; verification is pending." : answerReady ? "Longer PR · R–R and QRS preserved." : step === 0 ? "PR: P onset → QRS onset. Preserve R–R and QRS." : drift ? "PR changed; the R–R drift requires repair." : "Remeasure PR, R–R and QRS before answering.";
    ui.questionState.textContent = nextCandidates ? "Awaiting checks" : answerReady ? "Evidence checked" : step === 0 ? "Target defined" : drift ? "Repair required" : "Checking evidence";
    const exampleTravel = ease((p - 0.72) / 0.24);
    ui.examplePacket.style.opacity = step === 3 && p > 0.72 ? String(clamp((293 * (1 - exampleTravel) - 12) / 10)) : "0";
    ui.examplePacket.setAttribute("cx", String(293 * exampleTravel));
    reveal(ui.learningArrow, ease((position - (3 * stepDuration + 0.68 * stepDuration)) / 180) * (1 - ease((position - (6 * stepDuration - 200)) / 200)));

    ui.operator.classList.toggle("changed", operatorChanged);
    ui.recipe.classList.toggle("changed", recipeChanged);
    ui.sampling.classList.toggle("changed", recipeChanged);
    ui.operator.classList.toggle("focused", step === 1 || step === 2);
    ui.recipe.classList.toggle("focused", step === 4 || step === 5);
    ui.sampling.classList.toggle("focused", step === 4 || step === 5);
    ui.operatorValue.textContent = operatorChanged ? "PQ + TP compensation" : "Stretch PQ";
    ui.recipeValue.textContent = recipeChanged ? "PR contrast pairs" : "Direct practice";
    ui.samplingValue.textContent = recipeChanged ? "Interval confusion" : "Weak ECG categories";
    ui.version.textContent = recipeChanged ? "Retained" : step === 5 ? "Comparing" : step === 4 ? "Proposing" : operatorChanged ? "Repaired" : step === 2 ? "Repairing" : "Current";
    ui.agent.classList.toggle("updated", recipeChanged);
    ui.branches.forEach((node, i) => {
      const candidateReveal = ease((position - (4 * stepDuration + 2000 + i * 520)) / 480);
      reveal(ui.branchGroups[i], candidateReveal);
      node.classList.toggle("active", (step === 4 && p > 0.5 + i * 0.14) || (step === 5 && !selected));
      node.classList.toggle("selected", selected && i === 1);
      ui.branchRoutes[i].classList.toggle("selected", selected && i === 1);
      const stemLength = ui.branchStem.getTotalLength();
      const routeLength = ui.branchRoutes[i].getTotalLength();
      const distance = (stemLength + routeLength) * ease((p - 0.08) / 0.52);
      const branchPoint = distance <= stemLength ? ui.branchStem.getPointAtLength(distance) : ui.branchRoutes[i].getPointAtLength(distance - stemLength);
      ui.branchPackets[i].setAttribute("cx", branchPoint.x.toFixed(3));
      ui.branchPackets[i].setAttribute("cy", branchPoint.y.toFixed(3));
      ui.branchPackets[i].style.opacity = step === 5 && p > 0.08 && p < 0.64 ? String(clamp((stemLength + routeLength - distance - 4) / 8)) : "0";
    });
    ui.diagnosis.classList.toggle("active", step === 4);
    const diagnosisTravel = ease((p - 0.2) / 0.55);
    ui.diagnosisPacket.setAttribute("cx", String(1 + 34 * diagnosisTravel));
    ui.diagnosisPacket.style.opacity = step === 4 && p > 0.2 && p < 0.8 ? String(clamp((34 * (1 - diagnosisTravel) - 8) / 6)) : "0";
    ui.learnerReturn.classList.toggle("active", step === 4);
    reveal(ui.learnerReturn, ease((position - (4 * stepDuration + 400)) / 300) * cyclePresence);
    const returnBox = ui.returnSvg.getBoundingClientRect();
    const returnWidth = Math.max(18, returnBox.width);
    const returnHeight = Math.max(50, returnBox.height);
    const sizeKey = `${returnWidth} ${returnHeight}`;
    if (sizeKey !== returnSize) {
      const right = returnWidth - 3;
      const top = 18;
      const bottom = returnHeight - 18;
      const radius = Math.min(8, (returnWidth - 6) / 2, (bottom - top) / 2);
      ui.returnSvg.setAttribute("viewBox", `0 0 ${returnWidth} ${returnHeight}`);
      ui.returnPath.setAttribute("d", `M3 ${bottom}H${right - radius}Q${right} ${bottom} ${right} ${bottom - radius}V${top + radius}Q${right} ${top} ${right - radius} ${top}H3`);
      returnLength = ui.returnPath.getTotalLength();
      ui.feedbackPacket.setAttribute("r", "2.5");
      returnSize = sizeKey;
    }
    const travel = ease((p - 0.12) / 0.7);
    const feedbackPoint = ui.returnPath.getPointAtLength(returnLength * travel);
    ui.feedbackPacket.setAttribute("cx", feedbackPoint.x.toFixed(3));
    ui.feedbackPacket.setAttribute("cy", feedbackPoint.y.toFixed(3));
    const tipClearance = returnLength * (1 - travel);
    ui.feedbackPacket.style.opacity = step === 4 && p > 0.12 && p < 0.86 ? String(clamp((tipClearance - 8) / 8)) : "0";
    ui.evaluation.classList.toggle("active", step === 7);
    reveal(ui.evaluation, 1);
    const evaluationTravel = ease((p - 0.12) / 0.62);
    ui.evaluationPacket.setAttribute("cx", String(1 + 36 * evaluationTravel));
    ui.evaluationPacket.style.opacity = step === 7 && p > 0.12 && p < 0.84 ? String(clamp((36 * (1 - evaluationTravel) - 9) / 6)) : "0";
    ui.steps.forEach((button, i) => {
      if (i === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    ui.progress.style.width = `${(position / duration) * 100}%`;
    ui.progressBar.setAttribute("aria-valuenow", String(Math.round((position / duration) * 100)));
    return { milliseconds: position, step, focus: demo.dataset.focus, operatorChanged, selected, recipeChanged, nextCandidates, sceneOpacity: 1, diagnosisReveal, treeReveal, pr, rr };
  }

  function syncPlayButton() {
    ui.play.textContent = playing ? "Pause" : "Play";
    ui.play.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
  }
  function tick(now) {
    request = null;
    if (!playing) return;
    if (lastTick !== null && !document.hidden) render(position + now - lastTick);
    lastTick = now;
    request = window.requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    lastTick = null;
    if (request !== null) window.cancelAnimationFrame(request);
    request = null;
    syncPlayButton();
  }
  function play() {
    if (playing && request !== null) return;
    playing = true;
    lastTick = null;
    syncPlayButton();
    request = window.requestAnimationFrame(tick);
  }
  function seek(milliseconds) {
    pause();
    return render(Number.isFinite(Number(milliseconds)) ? Number(milliseconds) : 0);
  }
  function goToStep(step) {
    const index = ((step % stepCount) + stepCount) % stepCount;
    seek(index * stepDuration + stepDuration * 0.9);
  }
  ui.play.addEventListener("click", () => playing ? pause() : play());
  byId("previous-step").addEventListener("click", () => goToStep(Math.floor(position / stepDuration) - 1));
  byId("next-step").addEventListener("click", () => goToStep(Math.floor(position / stepDuration) + 1));
  ui.steps.forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.stepTo))));
  document.addEventListener("visibilitychange", () => { lastTick = null; });
  reducedMotion.addEventListener("change", event => {
    if (event.matches) seek(restingTime);
  });
  // Deterministic frame capture for the accompanying project animation.
  window.ecgEvolution = Object.freeze({ duration, seek, play, pause, getTime: () => position });
  render(position);
  syncPlayButton();
  if (playing) play();
})();

const copyButton = document.querySelector("[data-copy]");
if (copyButton) {
  copyButton.addEventListener("click", async () => {
    const citation = document.getElementById(copyButton.dataset.copy);
    const status = document.getElementById("copy-status");
    if (!citation || !status) return;
    try {
      await navigator.clipboard.writeText(citation.textContent);
      status.textContent = "BibTeX copied.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(citation);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Citation selected. Press Ctrl+C or Command+C to copy.";
    }
  });
}
