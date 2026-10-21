import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { getGlassPlateLean } from "./home-canvas-modules";

export type CanvasVoxel = {
  id: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  moduleId: string;
  colorKey: string;
  wheelAxis?: "x" | "y" | "z";
};

export type CanvasSceneState = {
  voxels: CanvasVoxel[];
  preview: CanvasVoxel | null;
  magnetic: CanvasVoxel | null;
};

export type ModuleRenderOptions = {
  lowPower?: boolean;
  glassEnvMap?: THREE.Texture | null;
};

const COLORS: Record<string, string> = {
  top: "#C9857C", front: "#D2A06E", right: "#D8C27A", left: "#8FA892",
  back: "#7E98B7", bottom: "#A08FB5", white: "#F3F1EC", black: "#3A3D40",
};

export function createModuleMesh(voxel: CanvasVoxel, preview = false, options: ModuleRenderOptions = {}) {
  const group = new THREE.Group();
  const glass = voxel.moduleId === "glassPlate";
  const glassLean = glass ? getGlassPlateLean(voxel) : 0;
  const glassColor = new THREE.Color(voxel.colorKey === "white" ? "#ffffff" : COLORS[voxel.colorKey] ?? "#ffffff");
  if (voxel.colorKey !== "white") glassColor.lerp(new THREE.Color("#ffffff"), 0.8);
  const material = glass
    ? preview || options.lowPower
      ? new THREE.MeshStandardMaterial({
        color: glassColor, roughness: 0.08, metalness: 0,
        transparent: true, opacity: preview ? 0.3 : 0.16, depthWrite: false,
      })
      : new THREE.MeshPhysicalMaterial({
        color: glassColor, roughness: 0.08, metalness: 0, transmission: 1, opacity: 1,
        ior: 1.45, thickness: (glassLean ? 0.25 : Math.min(voxel.sx, voxel.sy, voxel.sz)) - 0.025,
        envMap: options.glassEnvMap ?? null, envMapIntensity: 0.7,
      })
    : new THREE.MeshStandardMaterial({
    color: COLORS[voxel.colorKey] ?? COLORS.white,
    roughness: 0.65,
    metalness: 0.08,
    transparent: preview,
    opacity: preview ? 0.38 : 1,
    depthWrite: !preview,
  });
  const { sx, sy, sz } = voxel;
  function add(geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0, surface = material) {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.userData.voxel = voxel;
    group.add(mesh);
    return mesh;
  }
  function plate(width: number, depth: number, height: number, holes = false) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -depth / 2);
    shape.lineTo(width / 2, -depth / 2);
    shape.lineTo(width / 2, depth / 2);
    shape.lineTo(-width / 2, depth / 2);
    shape.closePath();
    if (holes) {
      for (let x = 0; x < Math.floor(width); x += 1) {
        for (let y = 0; y < Math.floor(depth); y += 1) {
          const hole = new THREE.Path();
          hole.absarc(x + 0.5 - width / 2, y + 0.5 - depth / 2, 0.16, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
      }
    }
    return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -height / 2);
  }

  if (glass) {
    const geometry = new THREE.BoxGeometry(sx - 0.025, sy - glassLean - 0.025, sz - 0.025);
    if (glassLean) {
      geometry.applyMatrix4(new THREE.Matrix4().set(
        1, 0, 0, 0,
        0, 1, -glassLean / (sz - 0.025), 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ));
    }
    add(geometry);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({
      color: preview ? "#6f8a98" : "#96a7ae",
      transparent: true, opacity: preview ? 0.65 : 0.2, depthWrite: false,
    }));
    // Only the solid panel participates in picking; line hits have no face normal.
    outline.raycast = () => {};
    group.add(outline);
  } else if (voxel.moduleId === "hollowCube") {
    const wallX = Math.min(0.25, sx / 3);
    const wallY = Math.min(0.25, sy / 3);
    add(new THREE.BoxGeometry(sx, wallY, sz), 0, (sy - wallY) / 2);
    add(new THREE.BoxGeometry(sx, wallY, sz), 0, -(sy - wallY) / 2);
    add(new THREE.BoxGeometry(wallX, sy - wallY * 2, sz), (sx - wallX) / 2);
    add(new THREE.BoxGeometry(wallX, sy - wallY * 2, sz), -(sx - wallX) / 2);
  } else if (voxel.moduleId === "wheel") {
    const axis = voxel.wheelAxis ?? "z";
    const radius = (axis === "x" ? Math.min(sy, sz) : axis === "y" ? Math.min(sx, sz) : Math.min(sx, sy)) / 2;
    const depth = axis === "x" ? sx : axis === "y" ? sy : sz;
    const rubber = material.clone();
    rubber.color.set("#353a3c");
    rubber.roughness = 0.95;
    function ring(outer: number, inner: number) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 }).translate(0, 0, -depth / 2);
      if (axis === "x") geometry.rotateY(Math.PI / 2);
      if (axis === "y") geometry.rotateX(Math.PI / 2);
      return geometry;
    }
    add(ring(radius, radius * 0.6), 0, 0, 0, rubber);
    material.metalness = 0.35;
    add(ring(radius * 0.6, radius * 0.16));
  } else if (voxel.moduleId === "perforatedPlate") {
    add(plate(sx, sy, sz, true));
  } else if (voxel.moduleId === "hinge") {
    const leafWidth = sx * 0.42;
    add(plate(leafWidth, sy, sz * 0.55, true), -sx * 0.29);
    add(plate(leafWidth, sy, sz * 0.55, true), sx * 0.29);
    const pinMaterial = material.clone();
    pinMaterial.color.set("#9ba4a8");
    pinMaterial.metalness = 0.55;
    for (let index = 0; index < 5; index += 1) {
      add(new THREE.CylinderGeometry(sz * 0.38, sz * 0.38, sy / 5 - 0.015, 20), 0, -sy / 2 + (index + 0.5) * sy / 5, 0, index % 2 ? material : pinMaterial);
    }
  } else {
    const inset = 0.025;
    add(new RoundedBoxGeometry(sx - inset, sy - inset, sz - inset, 2, Math.min(0.05, Math.min(sx, sy, sz) * 0.12)));
  }
  return group;
}

export function disposeModuleGroup(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  materials.forEach(material => material.dispose());
  group.clear();
}
