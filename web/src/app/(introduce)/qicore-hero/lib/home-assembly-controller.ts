import {
  AssemblyClock, ASSEMBLY_DELAY, createVehicleBlueprint, isUnmodifiedVehicle,
  groupVehicleBatches, type AssemblyCommand, type AssemblyView, type VehicleBatch, type VehiclePart,
} from "./home-vehicle-assembly";

export type AssemblyFlight = { batch: VehicleBatch; progress: number };
type Callbacks = {
  onChange: (view: AssemblyView) => void;
  onStart: (parts: VehiclePart[]) => void;
  onFrame: (flights: AssemblyFlight[]) => void;
  onReset?: () => void;
};

export function createAssemblyController(root: HTMLElement, callbacks: Callbacks) {
  let parts = createVehicleBlueprint(Number(root.dataset.canvasColumns), Number(root.dataset.canvasRows));
  let batches = groupVehicleBatches(parts);
  let clock = new AssemblyClock();
  let sessionId: string | null = null;
  let count = 0;
  let batchIndex = 0;
  let frame = 0;
  let visible = false;
  let disposed = false;
  let automaticHandled = false;
  let manualPause = false;
  let status: AssemblyView["status"] = "idle";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const main = root.closest("main");
  // The prompt gate holds the first build until the visitor's message is sent,
  // long after the scene has painted and warmed up.
  let promptGated = root.dataset.assemblyGate === "locked";
  let gateLocked = promptGated;
  function command(detail: AssemblyCommand) {
    window.dispatchEvent(new CustomEvent("qicore:canvas-assembly-command", { detail }));
  }
  function active() {
    return visible && !document.hidden && !main?.hidden &&
      root.dataset.moduleDrawerOpen !== "true" && root.dataset.assemblyDialogOpen !== "true";
  }
  function notify(next: AssemblyView["status"]) {
    status = next;
    root.dataset.assemblyStatus = status;
    root.dataset.assemblyCount = String(count);
    root.dataset.assemblyTotal = String(parts.length);
    root.dataset.assemblyElapsed = String(Math.round(clock.elapsed));
    callbacks.onChange({ status, count, total: parts.length, stage: batches[Math.min(batchIndex, batches.length - 1)].stage });
  }
  function clearFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    clock.pause();
  }
  function finish() {
    if (!sessionId) return;
    command({ action: "finish", sessionId });
    sessionId = null;
    clearFrame();
    callbacks.onFrame([]);
    notify("complete");
  }
  function step(now: number) {
    frame = 0;
    if (disposed || !sessionId) return;
    if (!active() || manualPause) { clock.pause(); notify("paused"); return; }
    // Shader compilation must not consume the visible assembly's initial delay.
    if (root.dataset.threePainted !== "true") {
      clock.pause();
      frame = requestAnimationFrame(step);
      return;
    }
    const elapsed = clock.tick(now);
    // A whole batch lands at once: one place command per member voxel.
    while (batchIndex < batches.length && elapsed >= batches[batchIndex].start + batches[batchIndex].flight) {
      for (const part of batches[batchIndex].parts) {
        command({ action: "place", sessionId, voxel: part.voxel });
      }
      count += batches[batchIndex].parts.length;
      batchIndex += 1;
      notify(elapsed < batches[0].start ? "waiting" : "building");
      if (!sessionId) return;
    }
    if (batchIndex === batches.length) { finish(); return; }
    const flights: AssemblyFlight[] = [];
    for (let index = batchIndex; !reduced.matches && index < batches.length; index += 1) {
      const batch = batches[index];
      if (elapsed < batch.start) break;
      flights.push({ batch, progress: Math.min(1, (elapsed - batch.start) / batch.flight) });
    }
    callbacks.onFrame(flights);
    const next = elapsed < batches[0].start ? "waiting" : "building";
    if (status !== next) notify(next);
    root.dataset.assemblyElapsed = String(Math.round(elapsed));
    frame = requestAnimationFrame(step);
  }
  function start(replace = false) {
    if (disposed || root.dataset.assemblyGate === "locked" || root.dataset.threeFailed === "true" ||
      root.dataset.editorReady !== "true" || root.dataset.threeReady !== "true") return;
    if (sessionId) cancel();
    automaticHandled = true;
    delete root.dataset.homeDisplayReady;
    window.dispatchEvent(new CustomEvent("qicore:canvas-select-module", { detail: null }));
    parts = createVehicleBlueprint(Number(root.dataset.canvasColumns), Number(root.dataset.canvasRows));
    batches = groupVehicleBatches(parts);
    count = 0;
    batchIndex = 0;
    clock = new AssemblyClock();
    manualPause = false;
    const nextId = `vehicle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    command({ action: "begin", sessionId: nextId, replace });
    if (root.dataset.assemblySession !== nextId) return;
    sessionId = nextId;
    callbacks.onStart(parts);
    notify("waiting");
    // A prompt-gated start fires long after the scene warmed up, so the
    // ceremonial warm-up delay would be dead air after the message is sent:
    // skip ahead and let the first batch take off almost immediately. Cold
    // starts keep the full delay so shaders can compile before the first flight.
    if (promptGated && root.dataset.threePainted === "true") clock.elapsed = ASSEMBLY_DELAY - 150;
    sync();
  }
  function cancel() {
    automaticHandled = true;
    if (!sessionId) return;
    command({ action: "takeover", sessionId });
    sessionId = null;
    clearFrame();
    callbacks.onFrame([]);
    notify("cancelled");
  }
  // Returning home re-locks the gate: drop the old vehicle and arm a fresh
  // prompt-gated build, exactly as a page refresh would.
  function rearm() {
    if (sessionId) {
      command({ action: "takeover", sessionId });
      sessionId = null;
    }
    clearFrame();
    callbacks.onFrame([]);
    automaticHandled = false;
    manualPause = false;
    promptGated = true;
    count = 0;
    batchIndex = 0;
    clock = new AssemblyClock();
    status = "idle";
    for (const key of ["assemblyStatus", "assemblyCount", "assemblyTotal", "assemblyElapsed", "canvasTouched"]) delete root.dataset[key];
    callbacks.onReset?.();
    callbacks.onChange({ status, count, total: parts.length, stage: batches[0].stage });
  }
  function sync() {
    if (disposed) return;
    const locked = root.dataset.assemblyGate === "locked";
    if (locked && !gateLocked) rearm();
    gateLocked = locked;
    if (root.dataset.threeFailed === "true") { cancel(); return; }
    if (sessionId) {
      if (!active() || manualPause) {
        clearFrame();
        if (status !== "paused") notify("paused");
      } else if (!frame) {
        clock.pause();
        frame = requestAnimationFrame(step);
      }
      return;
    }
    if (!automaticHandled && active() && root.dataset.assemblyGate !== "locked" && root.dataset.editorReady === "true" && root.dataset.threeReady === "true") {
      const saved = JSON.parse(root.dataset.voxelState || "[]");
      if (root.dataset.canvasTouched === "true") {
        automaticHandled = true;
      } else if (!saved.length || isUnmodifiedVehicle(saved, Number(root.dataset.canvasColumns), Number(root.dataset.canvasRows))) {
        start(true);
      } else if (root.dataset.canvasTouched !== "true") {
        start(true);
      } else {
        automaticHandled = true;
      }
    }
  }
  const mutations = new MutationObserver(sync);
  mutations.observe(root, { attributes: true, attributeFilter: ["data-editor-ready", "data-three-ready", "data-three-failed", "data-module-drawer-open", "data-assembly-dialog-open", "data-canvas-active", "data-assembly-gate"] });
  if (main) mutations.observe(main, { attributes: true, attributeFilter: ["hidden"] });
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  intersection.observe(root);
  window.addEventListener("qicore:canvas-takeover", cancel);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  sync();
  return {
    start,
    togglePause() { manualPause = !manualPause; sync(); },
    dispose() {
      cancel();
      disposed = true;
      clearFrame();
      mutations.disconnect();
      intersection.disconnect();
      window.removeEventListener("qicore:canvas-takeover", cancel);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    },
  };
}
