export const HOME_CANVAS_MODULES = [
  { id: "cube", category: "basic", sx: 1, sy: 1, sz: 1 },
  { id: "beam", category: "basic", sx: 3, sy: 1, sz: 1 },
  { id: "tile", category: "basic", sx: 2, sy: 2, sz: 1 },
  { id: "column", category: "basic", sx: 1, sy: 1, sz: 3 },
  { id: "thinPlate", category: "plates", sx: 3, sy: 2, sz: 0.25 },
  { id: "glassPlate", category: "plates", sx: 3, sy: 2, sz: 0.25 },
  { id: "longPlate", category: "plates", sx: 4, sy: 1, sz: 0.25 },
  { id: "perforatedPlate", category: "plates", sx: 3, sy: 2, sz: 0.25 },
  { id: "wheel", category: "mechanical", sx: 2, sy: 2, sz: 0.5 },
  { id: "hollowCube", category: "mechanical", sx: 3, sy: 3, sz: 3 },
  { id: "hinge", category: "mechanical", sx: 3, sy: 2, sz: 0.5 },
] as const;

export const HOME_CANVAS_MODULE_CATEGORIES = ["basic", "plates", "mechanical"] as const;

export const HOME_CANVAS_COLORS = [
  { key: "top", hex: "#C9857C" },
  { key: "front", hex: "#D2A06E" },
  { key: "right", hex: "#D8C27A" },
  { key: "left", hex: "#8FA892" },
  { key: "back", hex: "#7E98B7" },
  { key: "bottom", hex: "#A08FB5" },
  { key: "white", hex: "#F3F1EC" },
  { key: "black", hex: "#3A3D40" },
] as const;

export type CanvasModuleId = (typeof HOME_CANVAS_MODULES)[number]["id"];
export type CanvasColorKey = (typeof HOME_CANVAS_COLORS)[number]["key"];

export const GLASS_PLATE_SIZES = {
  z: { sx: 3, sy: 2, sz: 0.25 },
  y: { sx: 3, sy: 0.25, sz: 2 },
  x: { sx: 0.25, sy: 3, sz: 2 },
} as const;
export type GlassPlateAxis = keyof typeof GLASS_PLATE_SIZES;

export function getGlassPlateAxis(size: { sx: number; sy: number; sz: number }): GlassPlateAxis {
  // Inclined front panels occupy more than the nominal thickness on every axis.
  if (Math.min(size.sx, size.sy, size.sz) > 0.25) return "y";
  if (size.sx <= size.sy && size.sx <= size.sz) return "x";
  return size.sy <= size.sz ? "y" : "z";
}

// A front/back panel's extra occupied depth encodes its lean without a new saved field.
export function getGlassPlateLean(size: { sx: number; sy: number; sz: number }) {
  return getGlassPlateAxis(size) === "y" ? Math.max(0, size.sy - 0.25) : 0;
}
