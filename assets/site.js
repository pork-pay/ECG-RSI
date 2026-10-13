"use strict";

(() => {
  const demo = document.getElementById("ecg-demo");
  if (!demo) return;

  const stepCount = 8;
  const stepDuration = 4000;
  const duration = stepCount * stepDuration;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const byId = id => document.getElementById(id);
  const ui = {
    title: byId("demo-title"), count: byId("phase-count"), caption: byId("phase-caption"),
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
    agent: byId("agent-state"), version: byId("agent-version"), student: byId("student-status"),
    diagnosis: byId("feedback-diagnosis"), diagnosisPacket: byId("diagnosis-packet"),
    learnerReturn: demo.querySelector(".learner-return"), returnSvg: demo.querySelector(".learner-return svg"), returnPath: byId("learner-return-path"), branches: [...demo.querySelectorAll(".branch-node")],
    branchRoutes: [...demo.querySelectorAll(".branch-route")], branchPackets: [...demo.querySelectorAll(".branch-packet")],
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
  let position = reducedMotion.matches ? duration - 1 : 0;
  let playing = !reducedMotion.matches;
  let lastTick = null;
  let request = null;
  let returnSize = "";

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

  function branchPoint(progress, y) {
    const t = clamp(progress);
    if (t < 0.25) return [29 + 46 * t / 0.25, 50];
    if (t > 0.7) return [123 + 51 * (t - 0.7) / 0.3, y];
    const b = (t - 0.25) / 0.45;
    const a = 1 - b;
    return [a*a*a*75 + 3*a*a*b*102 + 3*a*b*b*95 + b*b*b*123,
      a*a*a*50 + 3*a*a*b*50 + 3*a*b*b*y + b*b*b*y];
  }

  function render(time) {
    position = ((time % duration) + duration) % duration;
    const step = Math.floor(position / stepDuration);
    const p = (position % stepDuration) / stepDuration;
    const stretch = step === 1 ? ease((p - 0.12) / 0.65) : step > 1 ? 1 : 0;
    const repair = step === 2 ? ease((p - 0.1) / 0.64) : step > 2 ? 1 : 0;
    const pr = 46 + 46 * stretch;
    const rr = 210 + 26 * stretch * (1 - repair);
    const operatorChanged = step > 2 || (step === 2 && p > 0.23);
    const selected = step > 5 || (step === 5 && p > 0.72);
    const recipeChanged = selected;
    const targetReady = step > 1 || (step === 1 && p > 0.8);
    const protectedReady = step > 2 || (step === 2 && p > 0.8);
    const answerReady = step > 3 || (step === 3 && p > 0.55);
    const nextCandidates = step >= 6;
    const drift = rr > 214;

    demo.dataset.step = String(step);
    demo.dataset.focus = step === 7 ? "evaluation" : step === 4 || step === 5 ? "development" : "signal";
    ui.title.textContent = titles[step];
    ui.count.textContent = `${String(step + 1).padStart(2, "0")} / 08`;
    ui.controlCount.textContent = `${step + 1} / ${stepCount}`;
    ui.caption.textContent = captions[step];
    ui.student.textContent = studentLabels[step];
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
    ui.comparison.style.display = nextCandidates ? "none" : "";
    ui.nextBatch.style.display = nextCandidates ? "" : "none";
    ui.comparison.style.opacity = "1";
    ui.nextBatch.style.opacity = "1";
    ui.pairCards.forEach((card, i) => {
      const arrival = step === 6 ? clamp((p - i * 0.17) / 0.18) : 1;
      card.style.opacity = String(arrival);
      card.style.visibility = nextCandidates ? "visible" : "hidden";
    });
    ui.scan.setAttribute("x1", String(24 + 666 * clamp(p / 0.7)));
    ui.scan.setAttribute("x2", String(24 + 666 * clamp(p / 0.7)));
    ui.scan.style.opacity = step === 3 && p < 0.65 ? "0.8" : "0";

    check(ui.target, nextCandidates ? "pending" : targetReady ? "pass" : "pending");
    check(ui.protect, nextCandidates ? "pending" : protectedReady ? "pass" : drift ? "fail" : "pending");
    check(ui.answer, nextCandidates ? "pending" : answerReady ? "pass" : "pending");
    ui.construction.classList.toggle("active", step === 1 || step === 2);
    ui.construction.textContent = step === 1 ? "R–R drift → construction repair" : step === 2 ? "TP compensation → restore R–R" : nextCandidates ? "New candidates → repeat waveform checks" : "Waveform checks → grounded supervision";
    ui.admission.textContent = !nextCandidates && answerReady ? "Verified ECG Q/A" : "Candidate ECG Q/A";
    ui.question.dataset.state = nextCandidates ? "candidate" : answerReady ? "verified" : drift ? "repair" : "checking";
    ui.questionAnswer.textContent = nextCandidates ? "PR contrasts at matched R–R; verification is pending." : answerReady ? "Longer PR · R–R and QRS preserved." : step === 0 ? "PR: P onset → QRS onset. Preserve R–R and QRS." : drift ? "PR changed; the R–R drift requires repair." : "Remeasure PR, R–R and QRS before answering.";
    ui.questionState.textContent = nextCandidates ? "Awaiting checks" : answerReady ? "Evidence checked" : step === 0 ? "Target defined" : drift ? "Repair required" : "Checking evidence";
    ui.examplePacket.style.opacity = step === 3 && p > 0.58 && p < 0.94 ? "1" : "0";
    ui.examplePacket.setAttribute("cx", String(293 * ease((p - 0.58) / 0.34)));

    ui.operator.classList.toggle("changed", operatorChanged);
    ui.recipe.classList.toggle("changed", recipeChanged);
    ui.sampling.classList.toggle("changed", recipeChanged);
    ui.operator.classList.toggle("focused", step === 1 || step === 2);
    ui.recipe.classList.toggle("focused", step === 4 || step === 5);
    ui.sampling.classList.toggle("focused", step === 4 || step === 5);
    ui.operatorValue.textContent = operatorChanged ? "PQ + TP compensation" : "Stretch PQ";
    ui.recipeValue.textContent = recipeChanged ? "PR contrast pairs" : "Direct practice";
    ui.samplingValue.textContent = recipeChanged ? "Interval confusion" : "Weak ECG categories";
    ui.version.textContent = recipeChanged ? "Retained" : step === 5 ? "Comparing" : step === 4 ? "Proposing" : operatorChanged ? "Repaired" : "Current";
    ui.agent.classList.toggle("updated", recipeChanged);
    ui.branches.forEach((node, i) => {
      node.classList.toggle("active", (step === 4 && p > 0.5 + i * 0.14) || (step === 5 && !selected));
      node.classList.toggle("selected", selected && i === 1);
      ui.branchRoutes[i].classList.toggle("selected", selected && i === 1);
      const [x, y] = branchPoint(ease((p - 0.08) / 0.52), [20, 50, 80][i]);
      ui.branchPackets[i].setAttribute("cx", x.toFixed(3));
      ui.branchPackets[i].setAttribute("cy", y.toFixed(3));
      ui.branchPackets[i].style.opacity = step === 5 && p > 0.08 && p < 0.64 ? "1" : "0";
    });
    ui.diagnosis.classList.toggle("active", step === 4);
    ui.diagnosisPacket.setAttribute("cx", String(1 + 34 * ease((p - 0.2) / 0.55)));
    ui.diagnosisPacket.style.opacity = step === 4 && p > 0.2 && p < 0.8 ? "1" : "0";
    ui.learnerReturn.classList.toggle("active", step === 4);
    const returnBox = ui.returnSvg.getBoundingClientRect();
    const returnWidth = Math.max(18, returnBox.width);
    const returnHeight = Math.max(50, returnBox.height);
    const sizeKey = `${returnWidth} ${returnHeight}`;
    if (sizeKey !== returnSize) {
      ui.returnSvg.setAttribute("viewBox", `0 0 ${returnWidth} ${returnHeight}`);
      ui.returnPath.setAttribute("d", `M3 ${returnHeight - 18}C${returnWidth - 3} ${returnHeight - 18} ${returnWidth - 3} 18 3 18m4-4-4 4 4 4`);
      ui.feedbackPacket.setAttribute("r", "2.5");
      returnSize = sizeKey;
    }
    const travel = ease((p - 0.12) / 0.7);
    // Cubic return path from learner to generator; position is deterministic.
    const a = 1 - travel;
    const packetX = a*a*a*3 + 3*a*a*travel*(returnWidth - 3) + 3*a*travel*travel*(returnWidth - 3) + travel*travel*travel*3;
    const packetY = a*a*a*(returnHeight - 18) + 3*a*a*travel*(returnHeight - 18) + 3*a*travel*travel*18 + travel*travel*travel*18;
    ui.feedbackPacket.setAttribute("cx", packetX.toFixed(3));
    ui.feedbackPacket.setAttribute("cy", packetY.toFixed(3));
    ui.feedbackPacket.style.opacity = step === 4 && p > 0.12 && p < 0.86 ? "1" : "0";
    ui.evaluation.classList.toggle("active", step === 7);
    ui.evaluationPacket.setAttribute("cx", String(1 + 36 * ease((p - 0.12) / 0.62)));
    ui.evaluationPacket.style.opacity = step === 7 && p > 0.12 && p < 0.84 ? "1" : "0";
    ui.steps.forEach((button, i) => {
      if (i === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    ui.progress.style.width = `${(position / duration) * 100}%`;
    ui.progressBar.setAttribute("aria-valuenow", String(Math.round((position / duration) * 100)));
    return { milliseconds: position, step, focus: demo.dataset.focus, operatorChanged, selected, recipeChanged, nextCandidates, pr, rr };
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
    if (event.matches) seek(duration - 1);
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
