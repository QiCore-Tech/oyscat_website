import type { CanvasVoxel } from "./home-canvas-geometry";

// Roomy enough to drive the finished vehicle around by hand.
export const CANVAS_COLUMNS = 204;
export const CANVAS_ROWS = 152;
export const ASSEMBLY_DELAY = 800;
export const ASSEMBLY_STAGE_GAP = 40;
// A batch never lands sooner than this after the previous one, so every part
// settles onto pieces that are already in place.
export const ASSEMBLY_LANDING_GAP = 40;
// Bottom-up: every part lands on the ground or on parts that are already in place.
export const VEHICLE_STAGES = [
  "wheels",
  "suspension",
  "chassis",
  "powertrain",
  "interior",
  "body",
  "glass",
  "roof",
  "details",
] as const;
export type VehicleStage = (typeof VEHICLE_STAGES)[number];
// Flight time and launch interval of each stage in ms; the late trim is the
// fastest, high-frequency part of the build.
export const STAGE_TEMPO: Record<VehicleStage, { flight: number; stagger: number }> = {
  wheels: { flight: 180, stagger: 110 },
  suspension: { flight: 230, stagger: 100 },
  chassis: { flight: 200, stagger: 100 },
  powertrain: { flight: 210, stagger: 80 },
  interior: { flight: 210, stagger: 80 },
  body: { flight: 190, stagger: 48 },
  glass: { flight: 240, stagger: 95 },
  roof: { flight: 210, stagger: 85 },
  details: { flight: 130, stagger: 36 },
};
export type AssemblyStatus = "idle" | "waiting" | "building" | "paused" | "complete" | "cancelled";
export type VehicleEase = "glide" | "snap" | "fall";
type Offset = [number, number, number];
export type VehiclePart = {
  voxel: CanvasVoxel;
  stage: VehicleStage;
  batch: number;
  start: number;
  flight: number;
  // Takeoff point and flight-curve control point, relative to the landing
  // point in blueprint units (x right, y toward the rear, z up).
  entry: Offset;
  via: Offset;
  ease: VehicleEase;
  roll?: boolean;
};
// Parts that lift off and land together.
export type VehicleBatch = { stage: VehicleStage; start: number; flight: number; parts: VehiclePart[] };
export type AssemblyCommand =
  | { action: "begin"; sessionId: string; replace: boolean }
  | { action: "place"; sessionId: string; voxel: CanvasVoxel }
  | { action: "finish" | "takeover"; sessionId: string };
export type AssemblyView = { status: AssemblyStatus; count: number; total: number; stage: VehicleStage };

type Motion = { entry: Offset; ease?: VehicleEase; lift?: number; via?: Offset; roll?: boolean };

function motion(entry: Offset, ease: VehicleEase = "glide", lift = 0): Motion {
  return { entry, ease, lift };
}

const flip = (value: number) => (value === 0 ? 0 : -value);

// A boxy off-road SUV: sage green body, white roof, black roll cage and trim,
// built from the ground up so that no part ever hangs in the air.
export function createVehicleBlueprint(columns = CANVAS_COLUMNS, rows = CANVAS_ROWS): VehiclePart[] {
  const parts: VehiclePart[] = [];
  let stage: VehicleStage = "wheels";
  let batch = -1;
  let flight = 0;

  // Parts added between two launch() calls lift off and land together.
  function launch(next: VehicleStage = stage, flightTime = STAGE_TEMPO[next].flight) {
    stage = next;
    batch += 1;
    flight = flightTime;
  }
  function add(moduleId: string, colorKey: string, [x, y, z]: Offset, [sx, sy, sz]: Offset, move: Motion, wheelAxis?: CanvasVoxel["wheelAxis"]) {
    const { entry, ease = "glide", lift = 0 } = move;
    parts.push({
      stage,
      batch,
      start: 0,
      flight,
      entry,
      via: move.via ?? [entry[0] / 2, entry[1] / 2, entry[2] / 2 + lift],
      ease,
      ...(move.roll ? { roll: true } : {}),
      voxel: {
        id: 720000 + parts.length,
        moduleId,
        colorKey,
        x: columns / 2 + x,
        y: rows / 2 + y,
        z,
        sx,
        sy,
        sz,
        ...(wheelAxis ? { wheelAxis } : {}),
      },
    });
  }
  // A left-side part and its mirror image, which flies in from the right.
  function pair(moduleId: string, colorKey: string, [x, y, z]: Offset, size: Offset, move: Motion, wheelAxis?: CanvasVoxel["wheelAxis"]) {
    add(moduleId, colorKey, [x, y, z], size, move, wheelAxis);
    const mirror = ([dx, dy, dz]: Offset): Offset => [flip(dx), dy, dz];
    add(moduleId, colorKey, [-x - size[0], y, z], size, {
      ...move,
      entry: mirror(move.entry),
      ...(move.via ? { via: mirror(move.via) } : {}),
    }, wheelAxis);
  }

  // 1. 轮胎与轮毂：四个越野胎从四角贴地滚入集结，轮毂分两批沿轴向扣合
  launch("wheels", 420);
  for (const [y, dy] of [[-4.5, -6], [1.5, 6]] as const) {
    pair("wheel", "white", [-3.5, y, 0], [1, 3, 3], { entry: [-5, dy, 0], via: [0, dy / 2, 0], roll: true }, "x");
  }
  launch();
  for (const y of [-3.5, 2.5]) pair("cube", "black", [-3.75, y, 1], [0.25, 1, 1], motion([-2.5, 0, 0], "snap"));
  launch();
  for (const y of [-3.25, 2.75]) pair("cube", "white", [-4, y, 1.25], [0.25, 0.5, 0.5], motion([-2, 0, 0], "snap"));

  // 2. 车轴与悬架：车轴沿轴向插入两侧轮毂，差速器、弹簧和减震自上而下连接车轴与底盘
  launch("suspension");
  add("beam", "black", [-2.5, -3.25, 1.25], [5, 0.5, 0.5], motion([-7, 0, 0]));
  launch();
  add("beam", "black", [-2.5, 2.75, 1.25], [5, 0.5, 0.5], motion([7, 0, 0]));
  launch();
  for (const y of [-3.5, 2.5]) add("cube", "black", [-0.5, y, 1.75], [1, 1, 0.5], motion([0, 0, 3.5], "snap"));
  launch();
  for (const y of [-3.25, 2.75]) pair("column", "right", [-1.5, y, 1.75], [0.5, 0.5, 0.5], motion([0, 0, 3], "snap"));
  launch();
  for (const y of [-3.25, 3]) pair("column", "white", [-2.25, y, 1.75], [0.25, 0.25, 0.5], motion([0, 0, 3], "snap"));

  // 3. 底盘与加固件：左右两半主板下落到弹簧上，外伸梁从两侧吸附
  launch("chassis", 300);
  pair("thinPlate", "black", [-2.5, -6.25, 2.25], [2.5, 12.25, 0.25], motion([0, 0, 6], "fall"));
  for (const [y, sy] of [[-5.75, 1], [-1.25, 2.5], [4.75, 0.75]] as const) {
    launch();
    pair("beam", "black", [-3, y, 2.5], [1.25, sy, 0.25], motion([-4, 0, 0.5], "snap", 0.6));
  }

  // 4. 动力结构：散热器从前方、油箱从后方、其余从上方装入
  launch("powertrain");
  add("tile", "back", [-1.5, -5.5, 2.5], [3, 0.25, 1], motion([0, -5, 1], "glide", 0.75));
  launch();
  add("cube", "black", [-1, -4.5, 2.5], [2, 2, 0.75], motion([0, 0, 5]));
  launch();
  add("cube", "top", [-0.75, -4.25, 3.25], [1.5, 1.5, 0.25], motion([0, 0, 4]));
  launch();
  pair("cube", "black", [-1.25, -4, 2.5], [0.25, 1, 0.5], motion([0, 0, 4]));
  launch();
  add("cube", "right", [-1.5, -5, 2.5], [0.5, 0.75, 0.5], motion([0, 0, 4]));
  add("cube", "white", [1, -5, 2.5], [0.5, 0.75, 0.75], motion([0, 0, 4]));
  launch();
  add("cube", "black", [-0.5, -2.5, 2.5], [1, 0.75, 0.5], motion([0, 0, 4.5]));
  launch();
  pair("cube", "black", [-1.5, 4.25, 2.5], [1.5, 0.75, 0.5], motion([0, 5, 1], "glide", 0.75));

  // 5. 座椅及仪表：车身封闭前从上方落进敞开的车舱
  launch("interior");
  add("beam", "black", [-1.75, -1.25, 2.5], [3.5, 0.5, 1], motion([0, 0, 5]));
  launch();
  add("tile", "back", [-1.75, -1.25, 3.5], [3.5, 0.5, 0.25], motion([0, 0, 4]));
  launch();
  pair("cube", "front", [-1.75, 0, 2.5], [1.25, 1.25, 0.5], motion([0, 0, 5]));
  launch();
  pair("tile", "front", [-1.75, 0.75, 3], [1.25, 0.5, 1.5], motion([0, 0, 5]));
  launch();
  add("tile", "front", [-1.25, 3.25, 2.5], [2.5, 1, 1.5], motion([0, 0, 5]));

  // 6. 车身方块和板件：左右成对对称飞入，从下往上逐层生长
  const grow = motion([-4.5, 0, 1.5], "glide", 1);
  launch("body");
  pair("beam", "left", [-2.5, -4.75, 2.5], [0.75, 3.5, 0.75], grow);
  launch();
  pair("beam", "left", [-2.5, 1.25, 2.5], [0.75, 3.5, 0.75], grow);
  launch();
  add("beam", "black", [-1.75, -5.75, 2.5], [3.5, 0.25, 0.25], motion([0, -4, 0.5], "glide", 0.75));
  launch();
  add("tile", "left", [-1.75, 5, 2.5], [3.5, 0.5, 1], motion([0, 4.5, 0.5], "glide", 0.75));
  launch();
  pair("cube", "left", [-3, -5.75, 2.75], [1.25, 1, 0.75], grow);
  launch();
  pair("longPlate", "left", [-3, -1.25, 2.75], [0.5, 2.5, 0.75], grow);
  launch();
  pair("cube", "left", [-3, 4.75, 2.75], [1.25, 0.75, 0.75], grow);
  // The grille's vertical slats let the radiator show between them.
  for (const x of [-0.5, -1, -1.5]) {
    launch();
    pair("column", "black", [x, -5.75, 2.75], [0.25, 0.25, 1], motion([0, -3.5, 0.5], "glide", 0.5));
  }
  // Wheel-arch flares overhang the tires but rest on the inner wheel wells.
  for (const y of [-4.75, 1.25]) {
    launch();
    pair("thinPlate", "black", [-3.5, y, 3.25], [2.25, 3.5, 0.25], grow);
  }
  for (const [y, sx, sy] of [[-5.75, 1.25, 4.5], [-1.25, 0.5, 2.5], [1.25, 0.5, 4.25]] as const) {
    launch();
    pair("longPlate", "left", [-3, y, 3.5], [sx, sy, 0.25], grow);
  }
  launch();
  add("tile", "left", [-2.5, 5, 3.5], [5, 0.5, 0.5], motion([0, 4.5, 1], "glide", 0.75));
  launch();
  add("tile", "left", [-3, -5.75, 3.75], [6, 2.25, 0.25], motion([0, 0, 4]));
  launch();
  add("tile", "left", [-3, -3.5, 3.75], [6, 3, 0.25], motion([0, 0, 4]));
  for (const y of [-0.5, 2.5]) {
    launch();
    pair("longPlate", "left", [-3, y, 3.75], [0.5, 3, 0.25], grow);
  }

  // 7. 透明玻璃件：侧窗沿 x 侧向滑入，前后风挡斜向插入
  launch("glass");
  pair("glassPlate", "white", [-2.5, -1.25, 4], [2.5, 0.75, 1.75], motion([0, -3, 3]));
  launch();
  pair("glassPlate", "white", [-2.75, -0.5, 4], [0.25, 2, 1.75], motion([-4, 0, 0]));
  launch();
  pair("glassPlate", "white", [-2.75, 2.5, 4], [0.25, 2.25, 1.75], motion([-4, 0, 0]));
  launch();
  pair("glassPlate", "white", [-2.5, 5.25, 4], [2.5, 0.25, 1.75], motion([0, 3, 3]));

  // 8. 车顶和防滚架：立柱、顶板和顶边梁从上往下依次落下闭合
  for (const [y, sy] of [[-1.25, 0.75], [1.5, 1], [4.75, 0.75]] as const) {
    launch("roof");
    pair("column", "black", [-3, y, 4], [0.5, sy, 1.75], motion([0, 0, 4]));
  }
  launch();
  add("thinPlate", "white", [-3, -1.25, 5.75], [6, 3.25, 0.25], motion([0, 0, 4.5]));
  launch();
  add("thinPlate", "white", [-3, 2, 5.75], [6, 3.5, 0.25], motion([0, 0, 4.5]));
  launch();
  pair("beam", "black", [-3, -1.25, 6], [0.5, 6.75, 0.25], motion([0, 0, 3]));

  // 9. 灯、保险杠、装饰：后期高频快速装配
  launch("details");
  add("beam", "black", [-3, -6.25, 2.5], [6, 0.5, 0.5], motion([0, -3, 0.5], "snap"));
  launch();
  add("beam", "black", [-3, 5.5, 2.5], [6, 0.5, 0.5], motion([0, 3, 0.5], "snap"));
  launch();
  pair("wheel", "right", [-2.75, -6, 3], [1, 0.25, 1], motion([0, -2.5, 0.5], "snap"), "y");
  launch();
  add("cube", "black", [-0.5, -6.25, 3], [1, 0.5, 0.25], motion([0, -2.5, 0.5], "snap"));
  launch();
  pair("cube", "top", [-2.75, 5.5, 3], [0.5, 0.25, 0.5], motion([0, 2.5, 0.5], "snap"));
  launch();
  add("cube", "black", [-0.5, 5.5, 3], [1, 0.75, 0.25], motion([0, 2.5, 0], "snap"));
  launch();
  add("wheel", "white", [-1.25, 5.5, 3.25], [2.5, 0.75, 2.5], motion([0, 3.5, 0.5], "snap"), "y");
  launch();
  pair("cube", "black", [-3.5, -1, 4.25], [0.5, 0.5, 0.5], motion([-2.5, 0, 0.5], "snap"));
  launch();
  pair("cube", "black", [-3.25, 0.25, 3.25], [0.25, 0.5, 0.25], motion([-2, 0, 0], "snap"));
  launch();
  add("perforatedPlate", "black", [-1, -4.25, 4], [2, 1, 0.25], motion([0, 0, 2.5], "snap"));
  launch();
  add("perforatedPlate", "black", [-1.5, 0.5, 6], [3, 3, 0.25], motion([0, 0, 3], "snap"));
  launch();
  pair("cube", "right", [-1.25, 0.5, 6.25], [0.5, 0.5, 0.5], motion([0, 0, 2], "snap"));
  add("cube", "right", [-0.25, 0.5, 6.25], [0.5, 0.5, 0.5], motion([0, 0, 2], "snap"));

  // Each batch lands only after the previous one, and a new stage waits for
  // the last landing of the stage before it.
  let previous: VehiclePart | null = null;
  for (const part of parts) {
    if (previous?.batch === part.batch) {
      part.start = previous.start;
    } else if (!previous) {
      part.start = ASSEMBLY_DELAY;
    } else {
      const landed = previous.start + previous.flight;
      part.start = part.stage === previous.stage
        ? Math.max(previous.start + STAGE_TEMPO[part.stage].stagger, landed + ASSEMBLY_LANDING_GAP - part.flight)
        : landed + ASSEMBLY_STAGE_GAP;
    }
    previous = part;
  }
  return parts;
}

// Which seat the driver takes, looking forward: left-hand drive for Chinese
// visitors, right-hand drive for English ones.
export type DriverSide = "left" | "right";

// The steering wheel and a little driver for the vehicle above, seated on the
// `side` seat and holding the wheel. They are scenery, not board voxels: they
// switch seats with the language, so they never go through the store.
export function createCockpit(side: DriverSide, columns = CANVAS_COLUMNS, rows = CANVAS_ROWS) {
  const mirror = side === "right";
  const parts: CanvasVoxel[] = [];
  function add(moduleId: string, colorKey: string, [x, y, z]: Offset, [sx, sy, sz]: Offset, wheelAxis?: CanvasVoxel["wheelAxis"]) {
    parts.push({
      id: 730000 + parts.length,
      moduleId,
      colorKey,
      x: columns / 2 + (mirror ? -x - sx : x),
      y: rows / 2 + y,
      z,
      sx,
      sy,
      sz,
      ...(wheelAxis ? { wheelAxis } : {}),
    });
  }
  // The column rises out of the dashboard and the wheel stands above its top,
  // where it shows through the windshield.
  add("column", "black", [-1.25, -0.75, 3.75], [0.25, 0.25, 0.25]);
  add("wheel", "black", [-1.5, -0.5, 3.5], [0.75, 0.25, 0.75], "y");
  // Seated: shins in the footwell, thighs on the seat, then torso and head.
  add("cube", "black", [-1.5, -0.5, 2.5], [0.75, 0.5, 0.75]);
  add("cube", "black", [-1.5, 0, 3], [0.75, 0.75, 0.25]);
  add("cube", "back", [-1.5, 0.25, 3.25], [0.75, 0.5, 0.75]);
  add("cube", "right", [-1.375, 0.25, 4], [0.5, 0.5, 0.5]);
  add("cube", "black", [-1.375, 0.25, 4.5], [0.5, 0.5, 0.125]);
  // Arms reach forward and the hands hold the wheel at a quarter to three.
  for (const x of [-1.75, -0.75]) {
    add("cube", "back", [x, 0, 3.75], [0.25, 0.5, 0.25]);
    add("cube", "right", [x, -0.25, 3.75], [0.25, 0.25, 0.25]);
  }
  return parts;
}

export function groupVehicleBatches(parts: VehiclePart[]): VehicleBatch[] {
  const batches: VehicleBatch[] = [];
  for (const part of parts) {
    const last = batches[batches.length - 1];
    if (last && last.parts[0].batch === part.batch) last.parts.push(part);
    else batches.push({ stage: part.stage, start: part.start, flight: part.flight, parts: [part] });
  }
  return batches;
}

// Earlier default vehicles. Saved copies still count as an untouched default,
// so returning visitors see the current vehicle replayed instead.
function layoutBuilder(columns: number, rows: number) {
  const voxels: CanvasVoxel[] = [];
  function add(moduleId: string, colorKey: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, wheelAxis?: CanvasVoxel["wheelAxis"]) {
    voxels.push({ id: 710000 + voxels.length, moduleId, colorKey, x: columns / 2 + x, y: rows / 2 + y, z, sx, sy, sz, ...(wheelAxis ? { wheelAxis } : {}) });
  }
  return { voxels, add };
}

export function createPreviousVehicleLayout(columns = CANVAS_COLUMNS, rows = CANVAS_ROWS, windows: "glass" | "steepGlass" | "uprightGlass" | "solid" = "glass") {
  const glass = windows !== "solid";
  const { voxels, add } = layoutBuilder(columns, rows);
  for (const x of [-2, 0]) {
    for (const y of [-5, 0]) {
      add("thinPlate", "black", x, y, 2.25, 2, 5, 0.25);
    }
  }
  for (const x of [-2.25, 1.75]) {
    for (const y of [-5, 0]) {
      add("beam", "black", x, y, 1.75, 0.5, 5, 0.5);
    }
  }

  for (const y of [-3.25, 2.75]) {
    add("beam", "black", -2.75, y, 1.25, 2.0, 0.5, 0.5);
    add("beam", "black", 0.75, y, 1.25, 2.0, 0.5, 0.5);
  }
  for (const y of [-4.25, -2.25, 1.75, 3.75]) {
    for (const x of [-2.25, 1.75]) {
      add("column", "white", x, y, 0.5, 0.5, 0.5, 1.25);
    }
  }

  for (const y of [-4.5, 1.5]) {
    for (const x of [-3.5, 2.75]) {
      add("wheel", "white", x, y, 0, 0.75, 3, 3, "x");
    }
  }
  for (const y of [-4.5, 1.5]) {
    for (const [hubX, capColor] of [[-3.75, "white"], [3.5, "white"]] as const) {
      add("cube", "black", hubX, y + 0.5, 1.25, 0.25, 0.5, 0.5);
      add("cube", "black", hubX, y + 2.0, 1.25, 0.25, 0.5, 0.5);
      add("cube", capColor, hubX, y + 1.25, 0.5, 0.25, 0.5, 0.5);
      add("cube", capColor, hubX, y + 1.25, 2.0, 0.25, 0.5, 0.5);
    }
  }

  add("perforatedPlate", "black", -1.5, -5.25, 2.5, 3, 0.25, 0.75);
  add("cube", "black", -1.25, -4.75, 2.5, 1.0, 1.0, 0.75);
  add("cube", "black", 0.25, -4.75, 2.5, 1.0, 1.0, 0.75);
  add("cube", "black", -1.0, -3.5, 2.5, 1.0, 1.0, 0.75);
  add("cube", "black", 0.0, -3.5, 2.5, 1.0, 1.0, 0.75);
  add("cube", "back", -1.0, -2.5, 2.5, 1.0, 1.0, 0.75);
  add("cube", "back", 0.0, -2.5, 2.5, 1.0, 1.0, 0.75);
  add("cube", "black", -1.5, 3.5, 2.5, 3.0, 0.5, 0.75);
  add("cube", "black", -1.0, 4.0, 2.5, 1.0, 0.5, 0.75);
  add("cube", "black", 0.0, 4.0, 2.5, 1.0, 0.5, 0.75);

  add("cube", "black", -1.5, 0.0, 2.5, 1.0, 1.0, 0.5);
  add("tile", "black", -1.5, 1.0, 2.5, 1.0, 0.25, 1.5);
  add("cube", "black", 0.5, 0.0, 2.5, 1.0, 1.0, 0.5);
  add("tile", "black", 0.5, 1.0, 2.5, 1.0, 0.25, 1.5);
  add("beam", "black", -1.5, -1.5, 3.0, 3.0, 0.5, 0.25);
  add("cube", "black", -0.5, -0.75, 2.5, 1.0, 1.25, 0.5);

  for (const y of [-4.5, -1.5, 1.5]) {
    add("longPlate", "left", -2.75, y, 2.5, 0.5, 3.0, 0.25);
    add("longPlate", "left", 2.25, y, 2.5, 0.5, 3.0, 0.25);
  }
  for (const y of [-5.0, -2.0, 0.5, 3.0]) {
    add("cube", "left", -2.5, y, 2.75, 0.75, 1.5, 0.5);
    add("cube", "left", 1.75, y, 2.75, 0.75, 1.5, 0.5);
  }
  add("tile", "left", -2.0, -5.0, 3.25, 2.0, 2.5, 0.25);
  add("tile", "left", 0.0, -5.0, 3.25, 2.0, 2.5, 0.25);
  add("tile", "left", -2.0, 2.5, 3.5, 2.0, 2.25, 0.25);
  add("tile", "left", 0.0, 2.5, 3.5, 2.0, 2.25, 0.25);
  add("tile", "left", -2.0, 4.75, 2.75, 2.0, 0.25, 1.0);
  add("tile", "left", 0.0, 4.75, 2.75, 2.0, 0.25, 1.0);

  const windshieldDepth = windows === "steepGlass" ? 1.75 : windows === "uprightGlass" ? 0.25 : 0.75;
  add(glass ? "glassPlate" : "tile", glass ? "white" : "left", -2.0, -2.5, 3.5, 2.0, windshieldDepth, 1.5);
  add(glass ? "glassPlate" : "tile", glass ? "white" : "left", 0.0, -2.5, 3.5, 2.0, windshieldDepth, 1.5);
  add(glass ? "glassPlate" : "tile", glass ? "white" : "left", -2.0, 2.25, 3.5, 2.0, 0.25, 1.5);
  add(glass ? "glassPlate" : "tile", glass ? "white" : "left", 0.0, 2.25, 3.5, 2.0, 0.25, 1.5);
  for (const y of [-1.75, 0.25]) {
    add(glass ? "glassPlate" : "beam", glass ? "white" : "left", -2.0, y, 3.75, 0.25, 2.0, 1.25);
    add(glass ? "glassPlate" : "beam", glass ? "white" : "left", 1.75, y, 3.75, 0.25, 2.0, 1.25);
  }

  for (const y of [-2.0, 2.0]) {
    for (const x of [-2.5, 2.0]) {
      add("column", "black", x, y, 3.5, 0.5, 0.5, 1.5);
    }
  }
  for (const x of [-2.0, 0.0]) {
    for (const y of [-2.0, 0.25]) {
      add("thinPlate", "black", x, y, 5.0, 2.0, 2.25, 0.25);
    }
  }

  add("beam", "black", -2.75, -5.75, 1.75, 5.5, 0.5, 0.75);
  add("beam", "black", -2.75, 5.25, 1.75, 5.5, 0.5, 0.75);
  add("cube", "right", -2.5, -5.25, 2.5, 0.5, 0.25, 0.5);
  add("cube", "right", 2.0, -5.25, 2.5, 0.5, 0.25, 0.5);
  add("cube", "white", -1.25, -2.25, 5.25, 0.75, 0.25, 0.5);
  add("cube", "white", 0.5, -2.25, 5.25, 0.75, 0.25, 0.5);
  add("cube", "top", -2.5, 5.0, 2.5, 0.5, 0.25, 0.5);
  add("cube", "top", 2.0, 5.0, 2.5, 0.5, 0.25, 0.5);
  return voxels;
}

function createOriginalVehicleLayout(columns: number, rows: number, windows: "glass" | "steepGlass" | "uprightGlass" | "solid") {
  const glass = windows !== "solid";
  const { voxels, add } = layoutBuilder(columns, rows);
  for (const x of [-2.25, 1.75]) {
    for (const y of [-5.5, -2.75, 0, 2.75]) add("beam", "black", x, y, 1.75, 0.5, 2.75, 0.5);
  }
  for (const y of [-3.25, 2.75]) add("beam", "black", -2.75, y, 1.25, 5.5, 0.5, 0.5);
  for (const x of [-2.25, -0.75, 0.75]) {
    for (const y of [-5.5, -2.75, 0, 2.75]) add("thinPlate", "black", x, y, 2.25, 1.5, 2.75, 0.25);
  }
  for (const y of [-4.5, 1.5]) {
    for (const x of [-3.5, 2.75]) add("wheel", "white", x, y, 0, 0.75, 3, 3, "x");
  }
  for (const y of [-5.5, -4.5, -3.5]) {
    for (const [x, sx] of [[-2.5, 2], [-0.5, 2], [1.5, 1]]) add("tile", "left", x, y, 2.5, sx, 1, 0.75);
  }
  for (const x of [-2.5, 1.5]) {
    for (const y of [-5.5, 4.5]) add("cube", "left", x < 0 ? -2.75 : 2.25, y, 1.75, 0.5, 1, 0.5);
    for (const y of [-1.5, -0.5, 0.5]) add("cube", "left", x, y, 2.5, 1, 1, 1);
    for (const y of [-1.5, 0.5]) {
      const narrow = windows === "steepGlass" && y < 0;
      add("longPlate", "left", narrow && x > 0 ? x + 0.5 : x, y, 3.5, narrow ? 0.5 : 1, 1, 0.25);
    }
  }
  for (const x of [-2.75, 2]) {
    for (const y of [-4.5, -3.5, -2.5, 1.5, 2.5, 3.5]) add("longPlate", "left", x, y, 3.25, 0.75, 1, 0.25);
  }
  for (const y of [3.5, 4.5]) {
    for (const [x, sx] of [[-2.5, 2], [-0.5, 2], [1.5, 1]]) add("tile", "left", x, y, 2.5, sx, 1, 0.75);
  }
  add("beam", "black", -1.5, -5.75, 2.5, 3, 0.25, 0.75);
  for (const [x, sx] of [[-2.5, 2], [-0.5, 2], [1.5, 1]]) add("tile", "left", x, 5.5, 2.5, sx, 0.5, 1);
  for (const y of [-2.5, 2.5]) {
    for (const x of [-2, -1, 0, 1]) add("cube", "left", x, y, 2.5, 1, 0.5, 1);
  }

  for (const x of [-1.5, 0.5]) add("cube", "black", x, 0.5, 2.5, 1, 1, 1);
  if (glass) {
    for (const x of [-1.5, 0.5]) add("tile", "black", x, 1.5, 2.5, 1, 0.25, 1.5);
    add("beam", "black", -1.5, -1.75, 3.25, 3, 0.5, 0.25);
  }
  for (const x of [-2.5, 2]) {
    for (const y of [-2.5, 0, 2.5]) add("column", "white", x, y, 3.5, 0.5, 0.5, 1.5);
    for (const y of [-2, 0.5]) add(glass ? "glassPlate" : "beam", glass ? "white" : "back", glass && x > 0 ? x + 0.25 : x, y, 3.75, glass ? 0.25 : 0.5, 2, 1.25);
  }
  for (const y of [-2.5, 2.5]) {
    const depth = y < 0 && windows === "steepGlass" ? 1.75 : y < 0 && windows === "glass" ? 0.75 : glass ? 0.25 : 0.5;
    for (const x of [-2, 0]) add(glass ? "glassPlate" : "tile", glass ? "white" : "back", x, glass && y > 0 ? y + 0.25 : y, 3.5, 2, depth, 1.5);
  }
  for (const [x, sx] of [[-2.75, 2], [-0.75, 2], [1.25, 1.5]]) {
    for (const [y, sy] of [[-2.75, 2], [-0.75, 2], [1.25, 1.75]]) add("thinPlate", "white", x, y, 5, sx, sy, 0.25);
  }
  for (const x of [-2, 1.5]) add("longPlate", "black", x, -2, 5.25, 0.5, 4, 0.25);
  for (const y of [-1.5, 1.5]) add("longPlate", "black", -1.5, y, 5.25, 3, 0.5, 0.25);

  for (const y of [-6, 5.5]) add("beam", "black", -3, y, 1.75, 6, 0.5, 0.5);
  for (const x of [-2.5, 1.5]) {
    add("cube", "white", x, -6, 2.5, 1, 0.5, 1);
    add("cube", "right", x + 0.25, -6.25, 2.75, 0.5, 0.25, 0.5);
  }
  for (const x of [-2.5, 2]) add("cube", "top", x, 6, 2.75, 0.5, 0.25, 0.5);
  add("longPlate", "white", -3.25, -1.5, 3.75, 0.75, 0.5, 0.25);
  add("longPlate", "white", 2.5, -1.5, 3.75, 0.75, 0.5, 0.25);
  for (const x of [-3.5, 3.25]) add("cube", "back", x, -1.75, 3.75, 0.25, 1, 0.5);
  for (const x of [-1.75, 0.25]) add("longPlate", "black", x, -2.75, 3.5, 1.5, 0.25, 0.25);
  add("perforatedPlate", "black", -0.5, -4.5, 3.25, 1, 1, 0.25);
  return voxels;
}

export function isUnmodifiedVehicle(voxels: CanvasVoxel[], columns = CANVAS_COLUMNS, rows = CANVAS_ROWS) {
  const byId = new Map(voxels.map(voxel => [voxel.id, voxel]));
  if (byId.size !== voxels.length) return false;
  const fields = ["moduleId", "colorKey", "x", "y", "z", "sx", "sy", "sz"] as const;
  const matches = (layout: CanvasVoxel[]) => voxels.length === layout.length && layout.every(expected => {
    const actual = byId.get(expected.id);
    return actual !== undefined && fields.every(field => actual[field] === expected[field]) &&
      (actual.wheelAxis ?? "z") === (expected.wheelAxis ?? "z");
  });
  const layouts = [
    () => createVehicleBlueprint(columns, rows).map(part => part.voxel),
    ...(["glass", "steepGlass", "uprightGlass", "solid"] as const).map(windows => () => createPreviousVehicleLayout(columns, rows, windows)),
    ...(["glass", "solid"] as const).map(windows => () => createOriginalVehicleLayout(columns, rows, windows)),
  ];
  return layouts.some(layout => matches(layout()));
}

export function voxelIntersects(a: CanvasVoxel, b: CanvasVoxel) {
  return a.x < b.x + b.sx && a.x + a.sx > b.x &&
    a.y < b.y + b.sy && a.y + a.sy > b.y &&
    a.z < b.z + b.sz && a.z + a.sz > b.z;
}

export function getVoxelBounds(voxels: CanvasVoxel[]) {
  return voxels.reduce((bounds, v) => ({
    minX: Math.min(bounds.minX, v.x), minY: Math.min(bounds.minY, v.y), minZ: Math.min(bounds.minZ, v.z),
    maxX: Math.max(bounds.maxX, v.x + v.sx), maxY: Math.max(bounds.maxY, v.y + v.sy), maxZ: Math.max(bounds.maxZ, v.z + v.sz),
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity });
}

// One clock drives both the initial delay and every flight; hidden time is never added.
export class AssemblyClock {
  elapsed = 0;
  private previous: number | null = null;
  tick(now: number) {
    if (this.previous !== null) this.elapsed += Math.max(0, Math.min(now - this.previous, 64));
    this.previous = now;
    return this.elapsed;
  }
  pause() { this.previous = null; }
}
