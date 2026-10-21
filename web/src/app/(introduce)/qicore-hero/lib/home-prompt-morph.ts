import { cubicBezier } from "motion";

export type MorphRect = { left: number; top: number; width: number; height: number };
// `heading` and `stretch` squash the capsule along its flight direction, `tilt`
// banks it into the curve and `tint` is the opacity of its colored half.
export type MorphFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  heading: number;
  stretch: number;
  tilt: number;
  tint: number;
};
type Point = { x: number; y: number };

// Stage lengths in ms and sizes in px: the prompt field collapses into a
// two-tone capsule, the capsule flies along a cubic Bézier arc, then grows and
// widens into the alert pill.
export const PROMPT_MORPH = {
  collapse: 340,
  travel: 560,
  grow: 160,
  widen: 320,
  capsuleWidth: 44,
  capsuleHeight: 20,
  fieldRadius: 16,
};
export const PROMPT_MORPH_DURATION = PROMPT_MORPH.collapse + PROMPT_MORPH.travel + PROMPT_MORPH.grow + PROMPT_MORPH.widen;

const collapseEase = cubicBezier(0.65, 0, 0.35, 1);
const travelEase = cubicBezier(0.45, 0, 0.15, 1);
const growEase = cubicBezier(0.33, 1, 0.68, 1);
// A slight overshoot makes the capsule read as unfolding into the pill.
const widenEase = cubicBezier(0.34, 1.25, 0.64, 1);
const BANK = 0.4;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const centerOf = (rect: MorphRect): Point => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

export function getMorphPath(from: Point, to: Point): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Bow perpendicular to the straight line, always toward the top of the
  // screen, so the arc never dips below the field it left.
  let nx = dy / length;
  let ny = -dx / length;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const bow = Math.min(length * 0.35, 160);
  return [
    from,
    { x: from.x + dx * 0.2 + nx * bow, y: from.y + dy * 0.2 + ny * bow },
    { x: to.x - dx * 0.25 + nx * bow * 0.55, y: to.y - dy * 0.25 + ny * bow * 0.55 },
    to,
  ];
}

export function getMorphFrame(from: MorphRect, to: MorphRect, elapsed: number): MorphFrame {
  const { collapse, travel, grow, widen, capsuleWidth, capsuleHeight, fieldRadius } = PROMPT_MORPH;
  const start = centerOf(from);
  const end = centerOf(to);
  const still = { heading: 0, stretch: 1, tilt: 0 };
  if (elapsed < collapse) {
    const t = collapseEase(Math.max(0, elapsed) / collapse);
    const width = mix(from.width, capsuleWidth, t);
    const height = mix(from.height, capsuleHeight, t);
    const radius = Math.min(mix(fieldRadius, capsuleHeight / 2, t), width / 2, height / 2);
    // The colored half tints in once the field is small enough to read as a capsule.
    return { ...start, ...still, width, height, radius, tint: clamp01((t - 0.45) / 0.55) };
  }
  elapsed -= collapse;
  if (elapsed < travel) {
    const progress = elapsed / travel;
    const t = travelEase(progress);
    const u = 1 - t;
    const [p0, p1, p2, p3] = getMorphPath(start, end);
    // The curve's derivative gives the flight direction.
    const vx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
    const vy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
    const heading = Math.atan2(vy, vx);
    const swing = Math.sin(Math.PI * progress);
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      width: capsuleWidth,
      height: capsuleHeight,
      radius: capsuleHeight / 2,
      heading,
      stretch: 1 + 0.25 * swing,
      // Bank toward the flight direction without ever flipping the capsule:
      // level when flying straight across or straight up, steepest on diagonals.
      tilt: BANK * Math.sin(2 * heading) * swing,
      tint: 1,
    };
  }
  elapsed -= travel;
  // The capsule keeps its proportions while it grows to the alert's height.
  const grownWidth = Math.min(to.width, (to.height * capsuleWidth) / capsuleHeight);
  if (elapsed < grow) {
    const t = growEase(elapsed / grow);
    const height = mix(capsuleHeight, to.height, t);
    return { ...end, ...still, width: mix(capsuleWidth, grownWidth, t), height, radius: height / 2, tint: 1 };
  }
  elapsed -= grow;
  const progress = Math.min(1, elapsed / widen);
  const width = Math.max(to.height, mix(grownWidth, to.width, widenEase(progress)));
  // The colored half fades out as it widens so the hand-off to the white alert is seamless.
  return { ...end, ...still, width, height: to.height, radius: to.height / 2, tint: 1 - clamp01(progress / 0.8) };
}
