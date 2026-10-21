import type { CanvasVoxel } from "./home-canvas-geometry";

// Poses are offsets from the spot where the vehicle was built, in scene units.
// Heading 0 faces the scene's +y (the vehicle's front), so the forward vector
// is (-sin heading, cos heading); positive curvature turns left.
export type DrivePose = { x: number; y: number; heading: number; curvature: number };
// `straight` is the distance driven without turning, `turn` the total angle turned.
export type DrivePath = { length: number; straight: number; turn: number; sample: (distance: number) => DrivePose };
export type DriveState = "parked" | "roaming" | "returning" | "manual";
// Keyboard driving: throttle forward (1) or back (-1), steer left (1) or right (-1).
export type DriveInput = { throttle: -1 | 0 | 1; steer: -1 | 0 | 1 };
// The board around the build spot in pose coordinates, and the vehicle's half
// width (across) and half length (front to back).
export type DriveArea = { minX: number; maxX: number; minY: number; maxY: number; halfWidth: number; halfLength: number };
export type SpeedCurve = { duration: number; distanceAt: (time: number) => number; speedAt: (time: number) => number };
export type WheelAssembly = { members: CanvasVoxel[]; pivot: [number, number, number]; radius: number; front: boolean };

// The generated vehicle on the 204 x 152 board.
export const DEFAULT_DRIVE_AREA: DriveArea = { minX: -102, maxX: 102, minY: -76, maxY: 76, halfWidth: 4, halfLength: 6.25 };
// Each leg turns on one radius picked from this range; the drive home tries a few.
export const DRIVE_TURN_RADII: [number, number] = [4, 7];
export const DRIVE_RETURN_RADII = [3.5, 5, 6.5];
// A leg is at least this long and never turns further than this in total,
// so the car keeps travelling instead of running in circles.
export const DRIVE_MIN_LEG = 4;
export const DRIVE_MAX_LEG_TURN = Math.PI * 1.25;
// Every leg ends with at least this much board ahead, so the next one has
// room to turn instead of facing the edge.
export const DRIVE_ESCAPE = 6;
// Share of legs that set off mostly straight ahead, and the longest such run.
export const DRIVE_STRAIGHT_CHANCE = 0.4;
export const DRIVE_MAX_RUN = 24;
// Average speed of a leg in units per second; legs with more turning drive slower.
export const DRIVE_SPEED: [number, number] = [3, 6];
// The drive home averages this speed, or more when it is long, up to the cap,
// so the car is back within about DRIVE_RETURN_TIME seconds from anywhere.
export const DRIVE_RETURN_SPEED = 5;
export const DRIVE_RETURN_MAX_SPEED = 10;
export const DRIVE_RETURN_TIME = 5;
// Units per second squared a leg tries to stay within when speeding up or braking.
export const DRIVE_MAX_ACCEL = 6;
// Share of legs that end at a standstill, and how long the car then idles (ms).
export const DRIVE_STOP_CHANCE = 0.25;
export const DRIVE_STOP_PAUSE: [number, number] = [400, 1400];
// Waits in ms: a short beat after the build lands, a longer one after a drag.
export const DRIVE_START_DELAY = 800;
export const DRIVE_IDLE_RESUME = 6000;
export const DRIVE_MAX_STEER = 0.6;
// Keyboard driving: top speeds forward and in reverse (units per second),
// speeding up, braking against the motion and coasting (units per second
// squared), the tightest turn, and the sideways pull a turn may reach, which
// widens turns at speed. Holding forward speeds up for two seconds, then
// cruises at the top speed with room left to cross the board.
export const MANUAL_MAX_SPEED = 16;
export const MANUAL_MAX_REVERSE = 5;
export const MANUAL_ACCEL = 8;
export const MANUAL_BRAKE = 16;
export const MANUAL_COAST = 6;
export const MANUAL_MIN_RADIUS = 4;
export const MANUAL_MAX_LATERAL = 40;
const STEER_LAG = 0.2;
const TAU = Math.PI * 2;
export const HOME_POSE: DrivePose = { x: 0, y: 0, heading: 0, curvature: 0 };

// Rounding just below a full turn snaps to zero, or a car that is already
// lined up would loop once more before parking.
const mod2pi = (angle: number) => {
  const wrapped = ((angle % TAU) + TAU) % TAU;
  return wrapped > TAU - 1e-9 ? 0 : wrapped;
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Turn = "L" | "S" | "R";
const WORDS: Record<string, [Turn, Turn, Turn]> = {
  LSL: ["L", "S", "L"], RSR: ["R", "S", "R"], LSR: ["L", "S", "R"],
  RSL: ["R", "S", "L"], RLR: ["R", "L", "R"], LRL: ["L", "R", "L"],
};

// Segment lengths, in turning radii, of each Dubins word that connects the
// normalized start and goal (Shkel & Lumelsky); a missing word has no solution.
function dubinsWords(alpha: number, beta: number, d: number) {
  const sa = Math.sin(alpha), sb = Math.sin(beta), ca = Math.cos(alpha), cb = Math.cos(beta);
  const cab = Math.cos(alpha - beta);
  const d2 = d * d;
  const words: Record<string, [number, number, number]> = {};
  let p2 = 2 + d2 - 2 * cab + 2 * d * (sa - sb);
  if (p2 >= 0) {
    const tmp = Math.atan2(cb - ca, d + sa - sb);
    words.LSL = [mod2pi(tmp - alpha), Math.sqrt(p2), mod2pi(beta - tmp)];
  }
  p2 = 2 + d2 - 2 * cab + 2 * d * (sb - sa);
  if (p2 >= 0) {
    const tmp = Math.atan2(ca - cb, d - sa + sb);
    words.RSR = [mod2pi(alpha - tmp), Math.sqrt(p2), mod2pi(tmp - beta)];
  }
  p2 = -2 + d2 + 2 * cab + 2 * d * (sa + sb);
  if (p2 >= 0) {
    const p = Math.sqrt(p2);
    const tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
    words.LSR = [mod2pi(tmp - alpha), p, mod2pi(tmp - beta)];
  }
  p2 = -2 + d2 + 2 * cab - 2 * d * (sa + sb);
  if (p2 >= 0) {
    const p = Math.sqrt(p2);
    const tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
    words.RSL = [mod2pi(alpha - tmp), p, mod2pi(beta - tmp)];
  }
  let tmp = (6 - d2 + 2 * cab + 2 * d * (sa - sb)) / 8;
  if (Math.abs(tmp) <= 1) {
    const p = mod2pi(TAU - Math.acos(tmp));
    const t = mod2pi(alpha - Math.atan2(ca - cb, d - sa + sb) + p / 2);
    words.RLR = [t, p, mod2pi(alpha - beta - t + p)];
  }
  tmp = (6 - d2 + 2 * cab + 2 * d * (sb - sa)) / 8;
  if (Math.abs(tmp) <= 1) {
    const p = mod2pi(TAU - Math.acos(tmp));
    const t = mod2pi(-alpha - Math.atan2(ca - cb, d + sa - sb) + p / 2);
    words.LRL = [t, p, mod2pi(beta - alpha - t + p)];
  }
  return words;
}

// The shortest forward-only path from `from` to `to` that turns on circles of
// radius `rho`: turn, go straight or turn the other way, then turn again.
export function planDubinsPath(from: DrivePose, to: DrivePose, rho: number): DrivePath {
  // Dubins works with headings measured from +x.
  const theta0 = from.heading + Math.PI / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) / rho;
  const angle = d > 0 ? mod2pi(Math.atan2(dy, dx)) : 0;
  let best: { turns: [Turn, Turn, Turn]; lengths: [number, number, number]; total: number } | null = null;
  for (const [word, lengths] of Object.entries(dubinsWords(mod2pi(theta0 - angle), mod2pi(to.heading + Math.PI / 2 - angle), d))) {
    const total = lengths[0] + lengths[1] + lengths[2];
    if (!best || total < best.total) best = { turns: WORDS[word], lengths, total };
  }
  const { turns, lengths } = best!;
  // Pose at the start of each segment, in turning radii relative to `from`.
  const starts: [number, number, number][] = [[0, 0, theta0]];
  const advance = ([x, y, theta]: [number, number, number], turn: Turn, t: number): [number, number, number] => {
    if (turn === "L") return [x + Math.sin(theta + t) - Math.sin(theta), y - Math.cos(theta + t) + Math.cos(theta), theta + t];
    if (turn === "R") return [x - Math.sin(theta - t) + Math.sin(theta), y + Math.cos(theta - t) - Math.cos(theta), theta - t];
    return [x + Math.cos(theta) * t, y + Math.sin(theta) * t, theta];
  };
  for (let index = 0; index < 2; index += 1) starts.push(advance(starts[index], turns[index], lengths[index]));
  const length = best!.total * rho;
  return {
    length,
    straight: turns.reduce((sum, turn, index) => (turn === "S" ? sum + lengths[index] * rho : sum), 0),
    turn: turns.reduce((sum, turn, index) => (turn === "S" ? sum : sum + lengths[index]), 0),
    sample(distance) {
      let t = Math.min(length, Math.max(0, distance)) / rho;
      let index = 0;
      while (index < 2 && t > lengths[index]) t -= lengths[index++];
      const [x, y, theta] = advance(starts[index], turns[index], Math.min(t, lengths[index]));
      const turn = turns[index];
      return { x: from.x + x * rho, y: from.y + y * rho, heading: theta - Math.PI / 2, curvature: turn === "L" ? 1 / rho : turn === "R" ? -1 / rho : 0 };
    },
  };
}

// How far the vehicle's footprint sticks out past the board; zero or less fits.
export function getPoseOverhang({ x, y, heading }: DrivePose, area: DriveArea) {
  const c = Math.abs(Math.cos(heading));
  const s = Math.abs(Math.sin(heading));
  const ex = area.halfWidth * c + area.halfLength * s;
  const ey = area.halfWidth * s + area.halfLength * c;
  return Math.max(area.minX - (x - ex), x + ex - area.maxX, area.minY - (y - ey), y + ey - area.maxY);
}

export function getPathOverhang(path: DrivePath, area: DriveArea) {
  const count = Math.max(1, Math.ceil(path.length / 0.25));
  let worst = -Infinity;
  for (let index = 0; index <= count; index += 1) worst = Math.max(worst, getPoseOverhang(path.sample(path.length * index / count), area));
  return worst;
}

// The shortest way home that stays on the board, facing forward on arrival.
export function planReturnPath(from: DrivePose, area: DriveArea = DEFAULT_DRIVE_AREA): DrivePath {
  const allowed = Math.max(0, getPoseOverhang(from, area));
  let shortest: DrivePath | null = null;
  let fitting: DrivePath | null = null;
  for (const rho of DRIVE_RETURN_RADII) {
    const path = planDubinsPath(from, HOME_POSE, rho);
    if (!shortest || path.length < shortest.length) shortest = path;
    if ((!fitting || path.length < fitting.length) && getPathOverhang(path, area) <= allowed + 1e-9) fitting = path;
  }
  return fitting ?? shortest!;
}

// Where the vehicle's center may go while facing `heading`, with the footprint on the board.
function getRoom(heading: number, area: DriveArea) {
  const c = Math.abs(Math.cos(heading));
  const s = Math.abs(Math.sin(heading));
  const ex = area.halfWidth * c + area.halfLength * s;
  const ey = area.halfWidth * s + area.halfLength * c;
  return { minX: area.minX + ex, maxX: area.maxX - ex, minY: area.minY + ey, maxY: area.maxY - ey };
}

// The nearest pose with the footprint on the board, sliding along any edge it crosses.
export function keepOnBoard(pose: DrivePose, area: DriveArea): DrivePose {
  const room = getRoom(pose.heading, area);
  return {
    ...pose,
    x: Math.min(room.maxX, Math.max(room.minX, pose.x)),
    y: Math.min(room.maxY, Math.max(room.minY, pose.y)),
  };
}

// How far the vehicle can drive from (x, y) along `bearing` with its footprint at `heading` staying on the board.
function getRunway(x: number, y: number, bearing: number, heading: number, area: DriveArea) {
  const room = getRoom(heading, area);
  const fx = -Math.sin(bearing);
  const fy = Math.cos(bearing);
  let run = Infinity;
  if (fx > 1e-9) run = Math.min(run, (room.maxX - x) / fx);
  if (fx < -1e-9) run = Math.min(run, (room.minX - x) / fx);
  if (fy > 1e-9) run = Math.min(run, (room.maxY - y) / fy);
  if (fy < -1e-9) run = Math.min(run, (room.minY - y) / fy);
  return run;
}

// A random next leg that stays on the board: either a run mostly straight
// ahead, or a drive to a random spot that arrives roughly along the way there.
export function planRoamLeg(from: DrivePose, area: DriveArea = DEFAULT_DRIVE_AREA, random: () => number = Math.random): DrivePath {
  const fitting: DrivePath[] = [];
  // A car already over the edge may take any leg that does not stray further.
  const allowed = Math.max(0, getPoseOverhang(from, area)) + 1e-9;
  for (let attempt = 0; attempt < 120 && fitting.length < 6; attempt += 1) {
    const rho = mix(DRIVE_TURN_RADII[0], DRIVE_TURN_RADII[1], random());
    let target: DrivePose | null = null;
    if (random() < DRIVE_STRAIGHT_CHANCE) {
      const drift = (random() - 0.5) * 0.6;
      const bearing = from.heading + drift / 2;
      const heading = from.heading + drift;
      const runway = Math.min(getRunway(from.x, from.y, bearing, heading, area) - DRIVE_ESCAPE, DRIVE_MAX_RUN);
      if (runway < DRIVE_MIN_LEG) continue;
      const distance = mix(DRIVE_MIN_LEG, runway, random());
      target = { x: from.x - Math.sin(bearing) * distance, y: from.y + Math.cos(bearing) * distance, heading, curvature: 0 };
    } else {
      // Pick the arrival heading first, within a U-turn of the current one, so
      // the spot can be one where the car fits and the way there stays a drive.
      const heading = from.heading + (random() - 0.5) * 1.8 * Math.PI;
      const room = getRoom(heading, area);
      if (room.minX > room.maxX || room.minY > room.maxY) continue;
      target = { x: mix(room.minX, room.maxX, random()), y: mix(room.minY, room.maxY, random()), heading, curvature: 0 };
    }
    if (getRunway(target.x, target.y, target.heading, target.heading, area) < DRIVE_ESCAPE) continue;
    const path = planDubinsPath(from, target, rho);
    if (path.length >= DRIVE_MIN_LEG && path.turn <= DRIVE_MAX_LEG_TURN && getPathOverhang(path, area) <= allowed) fitting.push(path);
  }
  if (fitting.length) return fitting[Math.floor(random() * fitting.length)];
  // Nothing fits from here: head for the middle of the board, where there is
  // the most room, on whichever approach strays least.
  let best: { path: DrivePath; overhang: number } | null = null;
  for (let index = 0; index < 8; index += 1) {
    for (const rho of DRIVE_RETURN_RADII) {
      const path = planDubinsPath(from, { x: 0, y: 0, heading: index * TAU / 8, curvature: 0 }, rho);
      if (path.length < 0.5) continue;
      const overhang = getPathOverhang(path, area);
      if (!best || overhang < best.overhang - 1e-9 || (overhang < best.overhang + 1e-9 && path.length < best.path.length)) best = { path, overhang };
    }
  }
  return best!.path;
}

// Distance over time as a cubic Bézier: the leg sets off at speed `v0`, eases
// up and down, and arrives at speed `v1`, with times in seconds. A leg must
// average at least (v0 + v1) / 3, or the curve would run backwards.
export function createSpeedCurve(length: number, v0: number, v1: number, average: number): SpeedCurve {
  const longest = v0 + v1 > 0 ? 2.9 * length / (v0 + v1) : Infinity;
  const planned = Math.min(length / Math.max(average, 1e-3), longest);
  // The curve's acceleration is linear in time, so it peaks at one end.
  const peak = (time: number) => Math.max(
    Math.abs(6 * length / time ** 2 - (2 * v1 + 4 * v0) / time),
    Math.abs((4 * v1 + 2 * v0) / time - 6 * length / time ** 2),
  );
  // Stretch a leg that would lurch until it speeds up and brakes gently, or
  // as gently as its length allows.
  let duration = planned;
  if (length > 0 && peak(planned) > DRIVE_MAX_ACCEL) {
    const upper = Math.min(longest, planned * 10);
    for (let step = 1; step <= 60; step += 1) {
      const time = planned * (upper / planned) ** (step / 60);
      if (peak(time) < peak(duration)) duration = time;
      if (peak(time) <= DRIVE_MAX_ACCEL) break;
    }
  }
  const c1 = v0 * duration / 3;
  const c2 = length - v1 * duration / 3;
  const at = (time: number) => Math.min(1, Math.max(0, duration > 0 ? time / duration : 1));
  return {
    duration,
    distanceAt(time) {
      const u = at(time);
      const w = 1 - u;
      return 3 * w * w * u * c1 + 3 * w * u * u * c2 + u * u * u * length;
    },
    speedAt(time) {
      if (duration <= 0) return 0;
      const u = at(time);
      const w = 1 - u;
      return (3 * w * w * c1 + 6 * w * u * (c2 - c1) + 3 * u * u * (length - c2)) / duration;
    },
  };
}

type Leg = { path: DrivePath; curve: SpeedCurve; time: number; distance: number; stop: boolean };

// Parked at the build spot, the car waits out its countdown, then roams the
// board leg after leg, each leg eased by its own Bézier speed curve and some
// ending in a short stop. When recalled it drives the shortest way home,
// slows to a stop exactly on the spot and parks again. Taking the wheel hands
// it to the keyboard, from wherever it is.
export function createVehicleDriver(random: () => number = Math.random) {
  let area = DEFAULT_DRIVE_AREA;
  let state: DriveState = "parked";
  let input: DriveInput = { throttle: 0, steer: 0 };
  // How long a keyboard-driven car may stand idle before roaming again (null
  // holds it), and how long it has stood.
  let resumeAfter: number | null = null;
  let idle = 0;
  // While parked, the countdown to set off; while roaming, the idle between legs.
  let wait = DRIVE_START_DELAY;
  let pose = HOME_POSE;
  let speed = 0;
  let leg: Leg | null = null;
  let travel = 0;
  let curvature = 0;
  function park(delay: number) {
    state = "parked";
    wait = delay;
    pose = HOME_POSE;
    speed = 0;
    leg = null;
  }
  function startLeg() {
    const path = planRoamLeg(pose, area, random);
    // A twisty leg drives slower, and none brakes much harder than it entered.
    const average = Math.max(speed * 0.8, mix(DRIVE_SPEED[0], DRIVE_SPEED[1], random()) * (0.6 + 0.4 * path.straight / path.length));
    const stop = random() < DRIVE_STOP_CHANCE;
    const arrival = stop ? 0 : average * mix(0.5, 1.1, random());
    leg = { path, curve: createSpeedCurve(path.length, speed, arrival, average), time: 0, distance: 0, stop };
  }
  // Drive along the current leg; returns the time left over once it ends.
  function advance(ms: number) {
    const current = leg!;
    const end = current.time + ms / 1000;
    current.time = Math.min(end, current.curve.duration);
    const distance = current.curve.distanceAt(current.time);
    travel += distance - current.distance;
    current.distance = distance;
    // Legs are planned to stay on the board, but when none fits the fallback
    // may graze past an edge; the car slides along it instead.
    pose = keepOnBoard(current.path.sample(distance), area);
    speed = current.curve.speedAt(current.time);
    if (end < current.curve.duration) return 0;
    if (state === "returning") {
      park(DRIVE_IDLE_RESUME);
      return 0;
    }
    if (current.stop) {
      speed = 0;
      wait = mix(DRIVE_STOP_PAUSE[0], DRIVE_STOP_PAUSE[1], random());
    }
    leg = null;
    return (end - current.curve.duration) * 1000;
  }
  // Keyboard driving on a bicycle model. The footprint is pushed back inside
  // the board, so the car slides along an edge it grazes and stops dead at
  // one it meets head-on.
  function steerByHand(dtMs: number) {
    const dt = dtMs / 1000;
    const tightest = Math.min(1 / MANUAL_MIN_RADIUS, speed ? MANUAL_MAX_LATERAL / speed ** 2 : Infinity);
    curvature += (input.steer * tightest - curvature) * (1 - Math.exp(-dt / STEER_LAG));
    if (input.throttle > 0) {
      speed = Math.min(MANUAL_MAX_SPEED, speed + (speed < 0 ? MANUAL_BRAKE : MANUAL_ACCEL) * dt);
    } else if (input.throttle < 0) {
      speed = Math.max(-MANUAL_MAX_REVERSE, speed - (speed > 0 ? MANUAL_BRAKE : MANUAL_ACCEL) * dt);
    } else {
      speed = Math.sign(speed) * Math.max(0, Math.abs(speed) - MANUAL_COAST * dt);
    }
    if (!speed || !dt) return;
    const heading = pose.heading + speed * dt * curvature;
    const next = keepOnBoard({
      x: pose.x - Math.sin(heading) * speed * dt,
      y: pose.y + Math.cos(heading) * speed * dt,
      heading,
      curvature,
    }, area);
    // Only the distance actually covered along the car's axis counts.
    const moved = (next.x - pose.x) * -Math.sin(heading) + (next.y - pose.y) * Math.cos(heading);
    travel += moved;
    speed = moved / dt;
    pose = next;
  }
  return {
    get state() { return state; },
    get pose() { return pose; },
    get speed() { return speed; },
    // Distance covered so far, which turns the wheels.
    get travel() { return travel; },
    // Path curvature, eased so the front wheels sweep rather than snap.
    get curvature() { return curvature; },
    // The board the vehicle must stay on, around its build spot.
    setArea(board: DriveArea) { area = board; },
    // Drive by keyboard from wherever the car is, keeping its speed. Left
    // alone at a standstill for `resume` ms it roams on from there; null
    // keeps it waiting for the keys.
    takeWheel(resume: number | null = null) {
      if (state !== "manual") {
        state = "manual";
        leg = null;
        wait = 0;
        input = { throttle: 0, steer: 0 };
      }
      resumeAfter = resume;
      idle = 0;
    },
    setInput(next: DriveInput) { input = next; },
    tick(dtMs: number, holding = false) {
      if (state === "manual") {
        steerByHand(dtMs);
        if (resumeAfter !== null && !input.throttle && !input.steer && !speed) {
          idle += dtMs;
          if (idle >= resumeAfter) state = "roaming";
        } else {
          idle = 0;
        }
        return;
      }
      let left = dtMs;
      if (state === "parked") {
        if (!holding) wait -= dtMs;
        if (wait <= 0) {
          state = "roaming";
          wait = 0;
        }
        left = 0;
      }
      // Carry time over leg boundaries so a rolling hand-off never stutters.
      for (let step = 0; step < 8 && left > 0 && state !== "parked"; step += 1) {
        if (!leg) {
          const idle = Math.min(wait, left);
          wait -= idle;
          left -= idle;
          if (wait > 0) break;
          startLeg();
        }
        left = advance(left);
      }
      // Parked wheels straighten out; stopped ones keep their angle.
      const target = state === "parked" ? 0 : leg ? pose.curvature : curvature;
      curvature += (target - curvature) * (1 - Math.exp(-dtMs / 1000 / STEER_LAG));
    },
    // A drag sends a roaming car home; while parked it restarts the countdown.
    recall() {
      if (state === "parked") {
        wait = DRIVE_IDLE_RESUME;
      } else if (state === "roaming") {
        const path = planReturnPath(pose, area);
        if (path.length < 1e-4) {
          park(DRIVE_IDLE_RESUME);
          return;
        }
        state = "returning";
        wait = 0;
        const average = Math.min(DRIVE_RETURN_MAX_SPEED, Math.max(DRIVE_RETURN_SPEED, path.length / DRIVE_RETURN_TIME));
        leg = { path, curve: createSpeedCurve(path.length, speed, 0, average), time: 0, distance: 0, stop: true };
      }
    },
    // Jump straight back to the start point, e.g. before editing or a rebuild.
    reset(delay = DRIVE_START_DELAY) {
      park(delay);
      travel = 0;
      curvature = 0;
    },
  };
}

export function getSteerAngle(curvature: number, wheelbase: number) {
  return Math.max(-DRIVE_MAX_STEER, Math.min(DRIVE_MAX_STEER, Math.atan(wheelbase * curvature)));
}

// Ground wheels with an x axle, each with the hubs and caps centered on that
// axle beside it; the axle beams that span both sides are left out. The axle
// with the smaller board y is the front one, which steers.
export function findWheelAssemblies(voxels: CanvasVoxel[]): WheelAssembly[] {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const assemblies = voxels
    .filter(wheel => wheel.moduleId === "wheel" && wheel.wheelAxis === "x" && wheel.z === 0)
    .map(wheel => {
      const cy = wheel.y + wheel.sy / 2;
      const cz = wheel.z + wheel.sz / 2;
      const members = voxels.filter(part => part === wheel || (
        part.moduleId !== "wheel" && near(part.y + part.sy / 2, cy) && near(part.z + part.sz / 2, cz) &&
        part.x >= wheel.x - 0.5 - 1e-6 && part.x + part.sx <= wheel.x + wheel.sx + 0.5 + 1e-6
      ));
      return { members, pivot: [wheel.x + wheel.sx / 2, cy, cz] as [number, number, number], radius: Math.min(wheel.sy, wheel.sz) / 2, front: false };
    });
  const axles = assemblies.map(assembly => assembly.pivot[1]);
  const front = Math.min(...axles);
  if (Math.max(...axles) - front > 1e-6) for (const assembly of assemblies) assembly.front = near(assembly.pivot[1], front);
  return assemblies;
}

export function getWheelbase(assemblies: WheelAssembly[]) {
  const axles = assemblies.map(assembly => assembly.pivot[1]);
  return axles.length ? Math.max(...axles) - Math.min(...axles) : 0;
}
