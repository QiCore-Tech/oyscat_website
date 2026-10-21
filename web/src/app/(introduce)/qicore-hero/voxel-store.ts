import type { CanvasVoxel } from "./lib/home-canvas-geometry";
import { HOME_CANVAS_COLORS, HOME_CANVAS_MODULES } from "./lib/home-canvas-modules";
import { voxelIntersects, type AssemblyCommand } from "./lib/home-vehicle-assembly";

const VALID_MODULE_IDS = new Set<string>(HOME_CANVAS_MODULES.map(module => module.id));
const VALID_COLOR_KEYS = new Set<string>(HOME_CANVAS_COLORS.map(color => color.key));
const COORDINATE_KEYS = ["id", "x", "y", "z", "sx", "sy", "sz"] as const;

const quarter = (value: number) => Math.round(value * 4) / 4;

function normalizeVoxel(voxel: CanvasVoxel): CanvasVoxel {
  return {
    id: voxel.id,
    x: Math.max(0, quarter(voxel.x)),
    y: Math.max(0, quarter(voxel.y)),
    z: Math.max(0, quarter(voxel.z)),
    sx: Math.max(0.25, quarter(voxel.sx || 1)),
    sy: Math.max(0.25, quarter(voxel.sy || 1)),
    sz: Math.max(0.25, quarter(voxel.sz || 1)),
    moduleId: voxel.moduleId,
    colorKey: voxel.colorKey,
    wheelAxis: voxel.wheelAxis === "x" || voxel.wheelAxis === "y" ? voxel.wheelAxis : "z",
  };
}

// Holds the hero's voxel layout and answers the assembly controller's
// begin/place/finish commands. It speaks the same window-event protocol the
// scene and controller were written against, without any editor UI.
export function mountVoxelStore(root: HTMLElement): () => void {
  let voxels: CanvasVoxel[] = [];
  let session: string | null = null;

  const persist = () => {
    root.dataset.canvasColumns = String(Math.max(Number(root.dataset.canvasColumns) || 32, ...voxels.map(v => Math.ceil(v.x + v.sx + 1))));
    root.dataset.canvasRows = String(Math.max(Number(root.dataset.canvasRows) || 24, ...voxels.map(v => Math.ceil(v.y + v.sy + 1))));
    root.dataset.voxelState = JSON.stringify(voxels);
    window.dispatchEvent(new CustomEvent("qicore:canvas-scene-change", {
      detail: { voxels: [...voxels], preview: null, magnetic: null },
    }));
  };

  const fitsBoard = (voxel: CanvasVoxel) =>
    voxel.x >= 0 && voxel.y >= 0 && voxel.z >= 0 &&
    voxel.x + voxel.sx <= Number(root.dataset.canvasColumns) &&
    voxel.y + voxel.sy <= Number(root.dataset.canvasRows);

  const onCommand = (event: Event) => {
    const command = (event as CustomEvent<AssemblyCommand | undefined>).detail;
    if (!command || typeof command.sessionId !== "string") return;
    if (command.action === "begin") {
      if (session !== null || (voxels.length && !command.replace)) return;
      session = command.sessionId;
      root.dataset.assemblySession = session;
      voxels = [];
      persist();
      return;
    }
    if (command.sessionId !== session) return;
    if (command.action === "place") {
      const raw = command.voxel;
      if (!raw || !VALID_MODULE_IDS.has(raw.moduleId) || !VALID_COLOR_KEYS.has(raw.colorKey) ||
        !COORDINATE_KEYS.every(key => Number.isFinite(raw[key]))) return;
      const voxel = normalizeVoxel(raw);
      if (!fitsBoard(voxel) || voxels.some(v => v.id === voxel.id || voxelIntersects(voxel, v))) return;
      voxels.push(voxel);
      persist();
    } else {
      session = null;
      delete root.dataset.assemblySession;
      persist();
    }
  };

  window.addEventListener("qicore:canvas-assembly-command", onCommand);
  persist();
  root.dataset.editorReady = "true";
  window.dispatchEvent(new CustomEvent("qicore:canvas-editor-ready"));

  return () => {
    window.removeEventListener("qicore:canvas-assembly-command", onCommand);
    delete root.dataset.editorReady;
    delete root.dataset.assemblySession;
  };
}
