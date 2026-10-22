"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useTranslations } from "next-intl";
import type { CanvasSceneState, CanvasVoxel } from "../lib/home-canvas-geometry";
import { createAssemblyController, type AssemblyFlight } from "../lib/home-assembly-controller";
import {
  CANVAS_COLUMNS, CANVAS_ROWS, createCockpit, createVehicleBlueprint, getVoxelBounds, isUnmodifiedVehicle,
  type DriverSide, type VehicleEase,
} from "../lib/home-vehicle-assembly";
import {
  createVehicleDriver, findWheelAssemblies, getSteerAngle, getWheelbase,
  DRIVE_IDLE_RESUME, DRIVE_START_DELAY, type DriveInput, type DriveState, type WheelAssembly,
} from "../lib/home-vehicle-drive";

// How long, in ms, the camera takes to catch up with the moving vehicle; a
// vehicle driven by hand goes much faster, so the camera keeps up closely.
const FOLLOW_LAG = 450;
const MANUAL_FOLLOW_LAG = 120;
// Keys by position (`code`) first, so WASD sits under the same fingers on any
// layout, falling back to the typed letter when the position is unreported.
const DRIVE_CODES: Record<string, string> = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" };
const driveKey = (event: KeyboardEvent) =>
  DRIVE_CODES[event.code] ?? (/^[wasd]$/i.test(event.key) ? event.key.toLowerCase() : null);
// Typing into a field, such as the feedback form, is never driving.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

type CoreSceneModules = [
  typeof import("three"),
  typeof import("three/addons/controls/OrbitControls.js"),
  typeof import("../lib/home-canvas-geometry"),
];

let coreSceneModulesPromise: Promise<CoreSceneModules> | null = null;

function loadCoreSceneModules() {
  coreSceneModulesPromise ??= Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("../lib/home-canvas-geometry"),
  ]) as Promise<CoreSceneModules>;
  return coreSceneModulesPromise;
}

export function HomeCanvasScene() {
  const t = useTranslations("introduce.qicoreHero");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const assemblyRef = useRef<ReturnType<typeof createAssemblyController> | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Start downloading the core renderer as early as possible.
  useLayoutEffect(() => {
    void loadCoreSceneModules();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = canvas?.closest<HTMLElement>("[data-home-voxel]");
    const frameRoot = canvas?.closest<HTMLElement>("[data-home-voxel-scene]") ?? root;
    const vehicleFrame = root?.querySelector<HTMLElement>("[data-home-vehicle-frame]") ?? frameRoot;
    if (!canvas || !root || !frameRoot) return;
    const homeRoot = root;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let cleanup = () => {};
    let state: CanvasSceneState = { voxels: [], preview: null, magnetic: null };
    let syncMeshes = () => {};
    let fitRestored = () => {};
    let hidesRestoredDefault = () => false;
    root.dataset.canvasMode = "view";
    delete root.dataset.threeFailed;
    delete root.dataset.threePainted;
    function syncRestoredDisplayState() {
      const savedColumns = Number(homeRoot.dataset.canvasColumns) || CANVAS_COLUMNS;
      const savedRows = Number(homeRoot.dataset.canvasRows) || CANVAS_ROWS;
      const isDefault = isUnmodifiedVehicle(state.voxels, savedColumns, savedRows);
      const isGated = homeRoot.dataset.assemblyGate === "locked";
      const hasRestoredLayout = state.voxels.length > 0 && !homeRoot.dataset.assemblySession;
      if (isGated || (hasRestoredLayout && (isDefault || homeRoot.dataset.canvasTouched !== "true"))) {
        homeRoot.dataset.homeDefaultVehicleHidden = "true";
        delete homeRoot.dataset.homeDisplayReady;
      } else if (hasRestoredLayout && !isDefault && homeRoot.dataset.canvasTouched === "true") {
        delete homeRoot.dataset.homeDefaultVehicleHidden;
        homeRoot.dataset.homeDisplayReady = "true";
      } else {
        delete homeRoot.dataset.homeDefaultVehicleHidden;
        delete homeRoot.dataset.homeDisplayReady;
      }
    }
    const sceneChange = (event: Event) => {
      state = (event as CustomEvent<CanvasSceneState>).detail;
      syncRestoredDisplayState();
      syncMeshes();
    };
    window.addEventListener("qicore:canvas-scene-change", sceneChange);
    const editorReady = () => {
      fitRestored();
      syncMeshes();
    };
    window.addEventListener("qicore:canvas-editor-ready", editorReady);

    let activate = () => {};
    const ready = new Promise<void>(resolve => { activate = resolve; });
    const boot = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !root.closest("main")?.hidden) {
        boot.disconnect();
        activate();
      }
    });
    boot.observe(root);
    void ready.then(() => loadCoreSceneModules()).then(([T, { OrbitControls }, { createModuleMesh, disposeModuleGroup }]) => {
      if (cancelled) return;
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
      cleanup = () => renderer.dispose();
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const lowPower = navigator.hardwareConcurrency <= 4 || (memory !== undefined && memory <= 4);
      const targetPixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
      // Paint the first frame at a cheap resolution, then restore the target
      // density once the scene is already visible.
      renderer.setPixelRatio(Math.min(targetPixelRatio, 1));
      renderer.setClearColor("#f2f4f4");
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = !lowPower;
      renderer.shadowMap.type = T.PCFShadowMap;
      let glassEnvironment: THREE.WebGLRenderTarget | null = null;
      cleanup = () => { glassEnvironment?.dispose(); renderer.dispose(); };
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(38, 1, 0.1, 300);
      camera.up.set(0, 0, 1);
      const controls = new OrbitControls(camera, canvas);
      cleanup = () => { controls.dispose(); glassEnvironment?.dispose(); renderer.dispose(); };
      controls.enableDamping = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minPolarAngle = 0.08;
      controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: null as unknown as THREE.MOUSE };
      const light = new T.DirectionalLight("#ffffff", 3);
      const lightHome = new T.Vector3(-12, 8, 25);
      light.position.copy(lightHome);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      Object.assign(light.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 0.1, far: 70 });
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.025;
      // The light and its target travel with the vehicle so its shadow never
      // leaves the shadow camera.
      scene.add(light, light.target, new T.HemisphereLight("#ffffff", "#a4b1af", 1.8));
      const board = new T.Group();
      const turntable = new T.Group();
      const placed = new T.Group();
      const transient = new T.Group();
      const moving = new T.Group();
      turntable.add(placed);
      scene.add(board, turntable, transient, moving);
      const meshMap = new Map<number, { key: string; mesh: THREE.Group }>();
      const movingMap = new Map<number, THREE.Group>();
      // The steering wheel and driver ride along with the vehicle.
      const cockpit = new T.Group();
      placed.add(cockpit);
      let cockpitKey = "";
      let columns = Number(root.dataset.canvasColumns) || CANVAS_COLUMNS;
      let rows = Number(root.dataset.canvasRows) || CANVAS_ROWS;
      let frame = 0;
      let visible = true;
      let fitDistance = 1;
      let previewKey = "";
      let firstSize = true;
      let contextLost = false;
      let boardKey = "";
      let fitVoxels = createVehicleBlueprint(columns, rows).map(part => part.voxel);
      let turntableRadius = 0;
      // Once built, the vehicle drives itself around the board and the camera
      // follows it. A drag sends it back to the spot where it was built; after
      // a pause it sets off again. The turntable group carries the vehicle,
      // pivoting on its center at `driveHome` plus the driver's pose.
      const driver = createVehicleDriver();
      const driveHome = new T.Vector3();
      const followOffset = new T.Vector3();
      const followStep = new T.Vector3();
      let driveFrame = 0;
      let drivePreviousTime: number | null = null;
      let driveState: "hidden" | "paused" | DriveState = "hidden";
      let wheels: WheelAssembly[] = [];
      let wheelbase = 0;
      const wheelPivot = new T.Vector3();
      const wheelOffset = new T.Vector3();
      const wheelTurn = new T.Euler(0, 0, 0, "ZYX");
      // The ground shadow fades out around the vehicle wherever it is.
      const groundFadeCenter = { value: new T.Vector2() };
      let pointerActive = false;
      let dragged = false;
      const dragStartDirection = new T.Vector3();
      const dragDirection = new T.Vector3();
      const direction = new T.Vector3(0.95, 1.3, 0.88).normalize();
      // Held WASD keys drive the vehicle by hand.
      const pressed = new Set<string>();
      // Hovering the vehicle with a mouse tells the visitor how to drive it.
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
      const raycaster = new T.Raycaster();
      const pointerNdc = new T.Vector2();
      let pointerInside = false;
      let pointerX = 0;
      let pointerY = 0;
      let hovering = false;
      let qualityUpgradeScheduled = false;
      const upgradeSceneQuality = () => {
        if (cancelled || qualityUpgradeScheduled) return;
        qualityUpgradeScheduled = true;
        const run = () => {
          if (cancelled) return;
          renderer.setPixelRatio(targetPixelRatio);
          resize();
          if (!lowPower) {
            void import("three/addons/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
              if (cancelled) return;
              const environment = new RoomEnvironment();
              const generator = new T.PMREMGenerator(renderer);
              try {
                glassEnvironment = generator.fromScene(environment, 0.04, 0.1, 100, { size: 128 });
              } finally {
                environment.dispose();
                generator.dispose();
              }
              scene.traverse(object => {
                const material = object instanceof T.Mesh
                  ? object.material
                  : object instanceof T.LineSegments ? object.material : null;
                for (const surface of Array.isArray(material) ? material : material ? [material] : []) {
                  if (surface instanceof T.MeshPhysicalMaterial) {
                    surface.envMap = glassEnvironment?.texture ?? null;
                    surface.needsUpdate = true;
                  }
                }
              });
              invalidate();
            });
          }
        };
        const idleWindow = window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        };
        if (typeof idleWindow.requestIdleCallback === "function") {
          idleWindow.requestIdleCallback(run, { timeout: 1200 });
        } else {
          window.setTimeout(run, 120);
        }
      };
      const render = () => {
        frame = 0;
        if (cancelled || contextLost || !visible || document.hidden || root.closest("main")?.hidden) return;
        renderer.render(scene, camera);
        root.dataset.threePainted = "true";
        upgradeSceneQuality();
      };
      const invalidate = () => {
        if (!frame && !cancelled && !contextLost) frame = requestAnimationFrame(render);
      };
      // Wheels roll with the distance covered and the front pair steers, each
      // hub and cap turning about its wheel's axle.
      function applyWheels() {
        const steer = getSteerAngle(driver.curvature, wheelbase);
        for (const wheel of wheels) {
          const [px, py, pz] = wheel.pivot;
          wheelPivot.set(px - columns / 2, rows / 2 - py, pz);
          wheelTurn.set(-driver.travel / wheel.radius, 0, wheel.front ? steer : 0);
          for (const voxel of wheel.members) {
            const mesh = meshMap.get(voxel.id)?.mesh;
            if (!mesh) continue;
            wheelOffset.set(voxel.x + voxel.sx / 2 - columns / 2, rows / 2 - voxel.y - voxel.sy / 2, voxel.z + voxel.sz / 2).sub(wheelPivot).applyEuler(wheelTurn);
            mesh.position.copy(wheelPivot).add(wheelOffset);
            mesh.rotation.copy(wheelTurn);
          }
        }
      }
      function applyPose() {
        const { x, y, heading } = driver.pose;
        turntable.position.set(driveHome.x + x, driveHome.y + y, 0);
        turntable.rotation.z = heading;
        light.position.set(lightHome.x + x, lightHome.y + y, lightHome.z);
        light.target.position.set(x, y, 0);
        groundFadeCenter.value.set(x, y);
        applyWheels();
      }
      // Shift the camera and its orbit target together, so the visitor's
      // chosen angle and distance survive the follow.
      function moveFollow(x: number, y: number) {
        followStep.set(x - followOffset.x, y - followOffset.y, 0);
        if (followStep.lengthSq() < 1e-12) return;
        followOffset.add(followStep);
        controls.target.add(followStep);
        camera.position.add(followStep);
        controls.update();
      }
      // Park on the build spot at once, camera included, e.g. before editing
      // or a rebuild, so the vehicle lines up with the board again.
      function parkAtHome(delay: number) {
        driver.reset(delay);
        applyPose();
        moveFollow(0, 0);
        invalidate();
      }
      function publishDriveState(next: typeof driveState) {
        if (driveState === next) return;
        driveState = next;
        homeRoot.dataset.homeDriveState = next;
      }
      const displayReady = () =>
        root.dataset.assemblyStatus === "complete" ||
        root.dataset.homeDisplayReady === "true";
      const canDrive = () =>
        visible &&
        !document.hidden &&
        !root.closest("main")?.hidden &&
        root.dataset.moduleDrawerOpen !== "true" &&
        root.dataset.assemblyDialogOpen !== "true";
      const syncDrive = () => {
        const ready = displayReady();
        // Driving by hand is the visitor's own doing, so reduced motion allows it.
        const parked = !ready || (reducedMotion.matches && driver.state !== "manual") || root.dataset.canvasMode !== "view";
        if (parked || !canDrive()) {
          if (driveFrame) cancelAnimationFrame(driveFrame);
          driveFrame = 0;
          drivePreviousTime = null;
          // A paused drive freezes where it is; building, editing and reduced
          // motion keep the vehicle on its build spot.
          if (parked) parkAtHome(ready ? DRIVE_IDLE_RESUME : DRIVE_START_DELAY);
          publishDriveState(ready ? "paused" : "hidden");
          return;
        }
        publishDriveState(driver.state);
        if (!driveFrame) driveFrame = requestAnimationFrame(stepDrive);
      };
      const stepDrive = (now: number) => {
        driveFrame = 0;
        const previous = drivePreviousTime ?? now;
        drivePreviousTime = now;
        const delta = Math.min(64, Math.max(0, now - previous));
        // The countdown to set off again waits while the pointer is held down.
        driver.tick(delta, pointerActive);
        const { x, y } = driver.pose;
        const settled = driver.state === "parked" && Math.abs(driver.curvature) < 1e-4 &&
          Math.hypot(x - followOffset.x, y - followOffset.y) < 1e-3;
        if (settled) {
          moveFollow(x, y);
        } else {
          // Parked wheels still straighten out, so keep posing until they have.
          applyPose();
          const follow = 1 - Math.exp(-delta / (driver.state === "manual" ? MANUAL_FOLLOW_LAG : FOLLOW_LAG));
          moveFollow(followOffset.x + (x - followOffset.x) * follow, followOffset.y + (y - followOffset.y) * follow);
          invalidate();
        }
        // The vehicle can drive into or out from under a resting pointer.
        if (pointerInside) syncHover();
        publishDriveState(driver.state);
        driveFrame = requestAnimationFrame(stepDrive);
      };
      // A gesture that actually turned the camera sends the vehicle home and
      // restarts its countdown on release; a plain click does not. Only the
      // view direction counts, since the follow itself moves the camera.
      const markPointerActive = () => {
        pointerActive = true;
        dragged = false;
        dragStartDirection.subVectors(camera.position, controls.target).normalize();
      };
      const markPointerMoved = () => {
        if (!pointerActive || dragged) return;
        dragDirection.subVectors(camera.position, controls.target).normalize();
        if (dragDirection.distanceToSquared(dragStartDirection) < 1e-8) return;
        dragged = true;
        driver.recall();
      };
      const markPointerInactive = () => {
        pointerActive = false;
        if (dragged) driver.recall();
      };
      controls.addEventListener("start", markPointerActive);
      controls.addEventListener("change", markPointerMoved);
      controls.addEventListener("end", markPointerInactive);
      const canDriveByHand = () =>
        meshMap.size > 0 && displayReady() && canDrive() && root.dataset.canvasMode === "view";
      // A car driven by hand roams on from where it stopped once left alone,
      // unless motion is reduced.
      const handOver = () => (reducedMotion.matches ? null : DRIVE_IDLE_RESUME);
      function vehicleUnder(clientX: number, clientY: number) {
        const rect = canvas!.getBoundingClientRect();
        pointerNdc.set((clientX - rect.left) / rect.width * 2 - 1, (rect.top - clientY) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointerNdc, camera);
        return raycaster.intersectObject(placed, true).length > 0;
      }
      // The hint follows the pointer while it rests on the vehicle, and steps
      // aside once the visitor is driving.
      function syncHover() {
        const next = pointerInside && !pointerActive && !pressed.size && finePointer.matches && canDriveByHand() &&
          vehicleUnder(pointerX, pointerY);
        const hint = hintRef.current;
        if (next && hint) {
          const rect = canvas!.getBoundingClientRect();
          hint.style.transform = `translate(${pointerX - rect.left + 14}px, ${pointerY - rect.top + 18}px)`;
        }
        if (next === hovering) return;
        hovering = next;
        if (hint) hint.hidden = !next;
      }
      function steerFromKeys() {
        const held = (key: string) => (pressed.has(key) ? 1 : 0);
        driver.setInput({
          throttle: (held("w") - held("s")) as DriveInput["throttle"],
          steer: (held("a") - held("d")) as DriveInput["steer"],
        });
        syncHover();
      }
      const pointerMove = (event: PointerEvent) => {
        pointerInside = event.pointerType === "mouse";
        pointerX = event.clientX;
        pointerY = event.clientY;
        syncHover();
      };
      const pointerLeave = () => {
        pointerInside = false;
        syncHover();
      };
      // WASD takes the wheel from wherever the vehicle is, camera following.
      const keyDown = (event: KeyboardEvent) => {
        if (isTyping(event.target)) return;
        const key = driveKey(event);
        if (!key || event.ctrlKey || event.metaKey || event.altKey || !canDriveByHand()) return;
        event.preventDefault();
        if (driver.state !== "manual") {
          driver.takeWheel(handOver());
          syncDrive();
        }
        pressed.add(key);
        steerFromKeys();
      };
      const keyUp = (event: KeyboardEvent) => {
        const key = driveKey(event);
        if (key && pressed.delete(key)) steerFromKeys();
      };
      // Keys released while the window is in the background never report it.
      const releaseKeys = () => {
        pressed.clear();
        steerFromKeys();
      };
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerleave", pointerLeave);
      // Capture first, so nothing on the page can swallow the driving keys.
      window.addEventListener("keydown", keyDown, true);
      window.addEventListener("keyup", keyUp, true);
      window.addEventListener("blur", releaseKeys);
      function position(mesh: THREE.Group, voxel: CanvasVoxel) {
        mesh.position.set(voxel.x + voxel.sx / 2 - columns / 2, rows / 2 - voxel.y - voxel.sy / 2, voxel.z + voxel.sz / 2);
      }
      function meshFor(voxel: CanvasVoxel, preview = false) {
        const mesh = createModuleMesh(voxel, preview, { lowPower, glassEnvMap: glassEnvironment?.texture });
        mesh.traverse(object => {
          if (object instanceof T.Mesh) {
            object.castShadow = !preview && voxel.moduleId !== "glassPlate";
            object.receiveShadow = !preview && voxel.moduleId !== "glassPlate" && voxel.colorKey !== "back";
          }
        });
        position(mesh, voxel);
        return mesh;
      }
      function remove(mesh: THREE.Group) { mesh.removeFromParent(); disposeModuleGroup(mesh); }
      syncMeshes = () => {
        // Apply the replay guard here, including resize/board initialization.
        // Saved data stays intact, but the first rendered scene is grid-only.
        const hidden = hidesRestoredDefault();
        const voxels = hidden ? [] : state.voxels;
        const ids = new Set(voxels.map(voxel => voxel.id));
        for (const [id, item] of meshMap) {
          if (!ids.has(id)) { remove(item.mesh); meshMap.delete(id); }
        }
        for (const voxel of voxels) {
          const key = JSON.stringify(voxel);
          const previous = meshMap.get(voxel.id);
          if (previous?.key === key) { position(previous.mesh, voxel); continue; }
          if (previous) remove(previous.mesh);
          const mesh = meshFor(voxel);
          placed.add(mesh);
          meshMap.set(voxel.id, { key, mesh });
        }
        // position() above reset every wheel to its resting pose.
        wheels = findWheelAssemblies(voxels);
        wheelbase = getWheelbase(wheels);
        applyWheels();
        syncCockpit();
        const nextPreview = JSON.stringify(hidden ? [null, null] : [state.preview, state.magnetic]);
        if (nextPreview !== previewKey) {
          disposeModuleGroup(transient);
          const voxel = hidden ? null : state.preview ?? state.magnetic;
          if (voxel) transient.add(meshFor(voxel, true));
          previewKey = nextPreview;
        }
        invalidate();
      };
      // A restored default vehicle stays off the board until the assembly replay
      // begins, so the empty grid can safely paint before the editor is ready.
      hidesRestoredDefault = () =>
        root.dataset.assemblyGate === "locked" ||
        (!root.dataset.assemblyStatus &&
          (root.dataset.canvasTouched !== "true" ||
            isUnmodifiedVehicle(state.voxels, columns, rows)));
      // The driver takes the seat the page language drives from, switching
      // seats in place, and only sits in a finished vehicle.
      function syncCockpit() {
        const side: DriverSide = root!.dataset.driverSide === "right" ? "right" : "left";
        const key = `${side}:${columns}:${rows}`;
        if (key !== cockpitKey) {
          disposeModuleGroup(cockpit);
          for (const voxel of createCockpit(side, columns, rows)) cockpit.add(meshFor(voxel));
          cockpitKey = key;
        }
        cockpit.visible = displayReady() && !hidesRestoredDefault();
        invalidate();
      }
      function measureFit() {
        const bounds = getVoxelBounds(fitVoxels);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const displayBounds = {
          minX: Math.min(bounds.minX, centerX - turntableRadius),
          minY: Math.min(bounds.minY, centerY - turntableRadius),
          minZ: Math.min(bounds.minZ, -0.05),
          maxX: Math.max(bounds.maxX, centerX + turntableRadius),
          maxY: Math.max(bounds.maxY, centerY + turntableRadius),
          maxZ: bounds.maxZ,
        };
        const center = new T.Vector3((bounds.minX + bounds.maxX) / 2 - columns / 2, rows / 2 - (bounds.minY + bounds.maxY) / 2, (bounds.minZ + bounds.maxZ) / 2);
        const temp = new T.PerspectiveCamera();
        temp.up.set(0, 0, 1);
        temp.position.copy(center).add(direction);
        temp.lookAt(center);
        const inverse = temp.quaternion.clone().invert();
        const width = Math.max(1, frameRoot!.clientWidth);
        const height = Math.max(1, frameRoot!.clientHeight);
        const vehicleWidth = Math.max(1, vehicleFrame!.clientWidth);
        const vehicleHeight = Math.max(1, vehicleFrame!.clientHeight);
        const desktop = width > 900;
        const safeVertical = Math.max(0.45, Math.min(desktop ? 0.9 : 0.76, (vehicleHeight - (desktop ? 105 : 165)) / vehicleHeight)) * vehicleHeight / height;
        const safeHorizontal = (desktop ? 0.9 : 0.73) * vehicleWidth / width;
        const tangent = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
        let distance = 1;
        for (const x of [displayBounds.minX, displayBounds.maxX]) {
          for (const y of [displayBounds.minY, displayBounds.maxY]) {
            for (const z of [displayBounds.minZ, displayBounds.maxZ]) {
              const corner = new T.Vector3(x - columns / 2, rows / 2 - y, z).sub(center).applyQuaternion(inverse);
              distance = Math.max(distance, corner.z + Math.max(Math.abs(corner.x) / (tangent * camera.aspect * safeHorizontal), Math.abs(corner.y) / (tangent * safeVertical)));
            }
          }
        }
        // Frame the vehicle where the camera is currently following it; on
        // narrow screens the camera sits closer so the vehicle reads larger.
        return { center: center.add(followOffset), distance: distance * (desktop ? 1.02 : 0.85) };
      }
      function resetView() {
        const fit = measureFit();
        fitDistance = fit.distance;
        controls.target.copy(fit.center);
        camera.position.copy(fit.center).addScaledVector(direction, fitDistance);
        controls.minDistance = Math.max(3, fitDistance * 0.3);
        controls.maxDistance = fitDistance * 3;
        controls.update();
        invalidate();
      }
      resetRef.current = resetView;
      function syncTurntableFrame() {
        const bounds = getVoxelBounds(fitVoxels);
        const centerX = (bounds.minX + bounds.maxX) / 2 - columns / 2;
        const centerY = rows / 2 - (bounds.minY + bounds.maxY) / 2;
        driveHome.set(centerX, centerY, 0);
        placed.position.set(-centerX, -centerY, 0);
        // The vehicle roams the whole board around its build spot.
        driver.setArea({
          minX: -columns / 2 - centerX, maxX: columns / 2 - centerX,
          minY: -rows / 2 - centerY, maxY: rows / 2 - centerY,
          halfWidth: (bounds.maxX - bounds.minX) / 2, halfLength: (bounds.maxY - bounds.minY) / 2,
        });
        applyPose();
        turntableRadius = Math.max(4.5, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.62);
      }
      function resize() {
        const width = frameRoot!.clientWidth;
        const height = frameRoot!.clientHeight;
        if (!width || !height) return;
        columns = Number(root!.dataset.canvasColumns) || CANVAS_COLUMNS;
        rows = Number(root!.dataset.canvasRows) || CANVAS_ROWS;
        renderer.setSize(width, height, false);
        const sceneRect = frameRoot!.getBoundingClientRect();
        const vehicleRect = vehicleFrame!.getBoundingClientRect();
        // Offset the projection, not the canvas, so the scene continues behind the copy.
        camera.setViewOffset(
          width,
          height,
          width / 2 - (vehicleRect.left - sceneRect.left + vehicleRect.width / 2),
          height / 2 - (vehicleRect.top - sceneRect.top + vehicleRect.height / 2),
          width,
          height,
        );
        const key = `${columns}:${rows}`;
        if (key !== boardKey) {
          disposeModuleGroup(board);
          // The ground is shadow-only: ShadowMaterial never receives light, so
          // the ground always blends exactly into the page background and no
          // horizon or cove edge can appear at any camera angle. The plane is
          // deliberately huge so its far edge stays outside the view.
          const groundMaterial = new T.ShadowMaterial({ color: "#0b0d0e", opacity: 0.2 });
          // Dissolve the shadow radially so it fades out well inside the
          // shadow camera bounds and its hard rectangular edge is never visible.
          groundMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.groundFadeCenter = groundFadeCenter;
            shader.vertexShader = shader.vertexShader
              .replace("#include <common>", "#include <common>\nvarying vec3 vGroundWorldPosition;")
              .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;");
            shader.fragmentShader = shader.fragmentShader
              .replace("#include <common>", "#include <common>\nvarying vec3 vGroundWorldPosition;\nuniform vec2 groundFadeCenter;")
              .replace(
                "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );",
                "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * ( 1.0 - smoothstep(12.0, 19.0, length(vGroundWorldPosition.xy - groundFadeCenter)) ) );",
              );
          };
          const floor = new T.Mesh(new T.PlaneGeometry(2000, 2000), groundMaterial);
          floor.position.z = -0.025;
          floor.receiveShadow = true;
          board.add(floor);
          const points: number[] = [];
          for (let x = 0; x <= columns; x += 1) points.push(x - columns / 2, -rows / 2, 0, x - columns / 2, rows / 2, 0);
          for (let y = 0; y <= rows; y += 1) points.push(-columns / 2, y - rows / 2, 0, columns / 2, y - rows / 2, 0);
          const grid = new T.BufferGeometry();
          grid.setAttribute("position", new T.Float32BufferAttribute(points, 3));
          board.add(new T.LineSegments(grid, new T.LineBasicMaterial({ color: "#bfc9cd", transparent: true, opacity: 0.3 })));
          boardKey = key;
          previewKey = "";
          syncMeshes();
        }
        syncTurntableFrame();
        if (firstSize) { resetView(); firstSize = false; }
        else {
          const fit = measureFit();
          camera.position.sub(controls.target).multiplyScalar(fit.distance / fitDistance).add(fit.center);
          controls.target.copy(fit.center);
          fitDistance = fit.distance;
          controls.minDistance = Math.max(3, fitDistance * 0.3);
          controls.maxDistance = fitDistance * 3;
          controls.update();
        }
        invalidate();
      }
      fitRestored = () => {
        if (state.voxels.length && !root.dataset.assemblySession) {
          syncRestoredDisplayState();
          fitVoxels = state.voxels;
          syncTurntableFrame();
          resize();
          resetView();
        }
      };
      const easings: Record<VehicleEase, (t: number) => number> = {
        glide: t => 1 - Math.pow(1 - t, 3.2),
        // Overshoots slightly and clicks into place.
        snap: t => 1 - Math.pow(1 - t, 3) * (1 - 0.28 * Math.sin(t * Math.PI)),
        // Accelerates like a falling plate, then rebounds a little and settles.
        fall: t => t < 0.8 ? (t / 0.8) ** 2 : 1 - 0.05 * Math.sin((t - 0.8) / 0.2 * Math.PI),
      };
      const flightStart = new T.Vector3();
      const flightControl = new T.Vector3();
      const flightEnd = new T.Vector3();
      // Every part flies on its own quadratic Bézier curve from its takeoff
      // point to the spot where it lands, matching the mapping in position().
      function flightFrame(flights: AssemblyFlight[]) {
        const flying = new Set<number>();
        for (const { batch, progress } of flights) {
          for (const part of batch.parts) {
            const { voxel } = part;
            flying.add(voxel.id);
            let mesh = movingMap.get(voxel.id);
            if (!mesh) {
              mesh = meshFor(voxel);
              moving.add(mesh);
              movingMap.set(voxel.id, mesh);
            }
            const [ex, ey, ez] = part.entry;
            const [vx, vy, vz] = part.via;
            // Blueprint offsets point toward the rear along +y; the scene's y axis points forward.
            flightEnd.set(voxel.x + voxel.sx / 2 - columns / 2, rows / 2 - voxel.y - voxel.sy / 2, voxel.z + voxel.sz / 2);
            flightStart.set(flightEnd.x + ex, flightEnd.y - ey, flightEnd.z + ez);
            flightControl.set(flightEnd.x + vx, flightEnd.y - vy, flightEnd.z + vz);
            const t = easings[part.ease](progress);
            const inv = 1 - t;
            mesh.position.set(
              inv * inv * flightStart.x + 2 * inv * t * flightControl.x + t * t * flightEnd.x,
              inv * inv * flightStart.y + 2 * inv * t * flightControl.y + t * t * flightEnd.y,
              inv * inv * flightStart.z + 2 * inv * t * flightControl.z + t * t * flightEnd.z,
            );
            const curved = Math.abs(vx - ex / 2) + Math.abs(vy - ey / 2) + Math.abs(vz - ez / 2) > 1e-6;
            if (part.roll) {
              // A tire turns about its axle in step with the ground it covers.
              mesh.rotation.set((flightEnd.y - mesh.position.y) / (Math.min(voxel.sy, voxel.sz) / 2), 0, 0);
            } else if (curved && !lowPower) {
              // Bank gently into curved flights; straight insertions and slides stay level.
              const bank = 0.035 * Math.sin(progress * Math.PI);
              mesh.rotation.set(
                (flightStart.y - flightEnd.y) * bank,
                (flightEnd.x - flightStart.x) * bank,
                (flightStart.x - flightEnd.x) * 0.6 * bank,
              );
            } else {
              mesh.rotation.set(0, 0, 0);
            }
            // Body panels grow into place layer by layer and quick fittings pop in.
            const base = part.stage === "body" ? 0.55 : part.ease === "snap" ? 0.75 : 1;
            mesh.scale.setScalar(base + (1 - base) * Math.min(1, t));
          }
        }
        for (const [id, mesh] of movingMap) {
          if (!flying.has(id)) {
            remove(mesh);
            movingMap.delete(id);
          }
        }
        invalidate();
      }

      const syncControls = () => {
        controls.enabled = visible && !root.closest("main")?.hidden && root.dataset.moduleDrawerOpen !== "true" && root.dataset.assemblyDialogOpen !== "true" && root.dataset.canvasMode === "view";
        invalidate();
      };
      const mutations = new MutationObserver(() => {
        syncControls();
        syncDrive();
        syncCockpit();
        if (boardKey !== `${root.dataset.canvasColumns}:${root.dataset.canvasRows}`) resize();
      });
      mutations.observe(root, { attributes: true, attributeFilter: ["data-module-drawer-open", "data-assembly-dialog-open", "data-canvas-mode", "data-canvas-active", "data-canvas-columns", "data-canvas-rows", "data-assembly-status", "data-home-display-ready", "data-driver-side"] });
      const main = root.closest("main");
      if (main) mutations.observe(main, { attributes: true, attributeFilter: ["hidden"] });
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncControls();
        syncDrive();
      });
      intersection.observe(root);
      const observer = new ResizeObserver(resize);
      observer.observe(frameRoot);
      if (vehicleFrame !== frameRoot) observer.observe(vehicleFrame!);
      controls.addEventListener("change", invalidate);
      document.addEventListener("visibilitychange", syncDrive);
      reducedMotion.addEventListener("change", syncDrive);
      const lost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        root.dataset.threeFailed = "true";
        delete root.dataset.threeReady;
        delete root.dataset.threePainted;
        assemblyRef.current?.dispose();
        assemblyRef.current = null;
        setFailed(true);
      };
      canvas.addEventListener("webglcontextlost", lost);
      try {
        if (root.dataset.voxelState) state = { ...state, voxels: JSON.parse(root.dataset.voxelState) };
        if (state.voxels.length) fitVoxels = state.voxels;
        syncRestoredDisplayState();
      } catch { /* Keep the default framing when saved data is unavailable. */ }
      cleanup = () => {
        assemblyRef.current?.dispose();
        assemblyRef.current = null;
        delete root.dataset.threeReady;
        delete root.dataset.threePainted;
        delete root.dataset.homeDisplayReady;
        delete root.dataset.homeDefaultVehicleHidden;
        delete root.dataset.homeDriveState;
        if (hintRef.current) hintRef.current.hidden = true;
        resetRef.current = () => {};
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerleave", pointerLeave);
        window.removeEventListener("keydown", keyDown, true);
        window.removeEventListener("keyup", keyUp, true);
        window.removeEventListener("blur", releaseKeys);
        if (frame) cancelAnimationFrame(frame);
        if (driveFrame) cancelAnimationFrame(driveFrame);
        observer.disconnect();
        intersection.disconnect();
        mutations.disconnect();
        document.removeEventListener("visibilitychange", syncDrive);
        canvas.removeEventListener("webglcontextlost", lost);
        controls.dispose();
        for (const group of [turntable, transient, board, moving]) disposeModuleGroup(group);
        glassEnvironment?.dispose();
        light.shadow.map?.dispose();
        renderer.dispose();
        reducedMotion.removeEventListener("change", syncDrive);
      };
      resize();
      syncMeshes();
      syncControls();
      syncDrive();
      assemblyRef.current = createAssemblyController(root, {
        onChange: () => syncDrive(),
        onStart: parts => {
          parkAtHome(DRIVE_START_DELAY);
          fitVoxels = parts.map(part => part.voxel);
          syncTurntableFrame();
          resetView();
        },
        onFrame: flightFrame,
        onReset: () => {
          // Back on the home route: clear the board and park the camera at its
          // first-visit framing, ready to replay the prompt and build.
          parkAtHome(DRIVE_START_DELAY);
          fitVoxels = createVehicleBlueprint(columns, rows).map(part => part.voxel);
          syncTurntableFrame();
          resetView();
          syncRestoredDisplayState();
          syncMeshes();
          // The drawing buffer still holds the finished car from before the
          // route change, so repaint now rather than flashing it for a frame.
          if (!cancelled && !contextLost) renderer.render(scene, camera);
        },
      });
      root.dataset.threeReady = "true";
    }).catch(() => {
      cleanup();
      cleanup = () => {};
      if (!cancelled) {
        try {
          const saved = JSON.parse(root.dataset.voxelState || "[]") as CanvasVoxel[];
          const columns = Number(root.dataset.canvasColumns) || CANVAS_COLUMNS;
          const rows = Number(root.dataset.canvasRows) || CANVAS_ROWS;
          if (saved.length && isUnmodifiedVehicle(saved, columns, rows)) root.dataset.homeDefaultVehicleHidden = "true";
        } catch { /* Keep the empty fallback when saved data is unavailable. */ }
        root.dataset.threeFailed = "true";
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      boot.disconnect();
      window.removeEventListener("qicore:canvas-scene-change", sceneChange);
      window.removeEventListener("qicore:canvas-editor-ready", editorReady);
      cleanup();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} tabIndex={0} onPointerDown={event => event.currentTarget.focus({ preventScroll: true })} data-home-three-surface aria-label={t("sceneLabel")} className="absolute inset-0 z-10 h-full w-full [touch-action:pan-y_pinch-zoom] cursor-grab active:cursor-grabbing" />
      <div ref={hintRef} hidden aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-30 flex items-center gap-2 whitespace-nowrap rounded-full bg-zinc-900/85 py-1.5! pr-3! pl-2! text-xs text-white shadow-md">
        {t.rich("testDrive", {
          keys: () => (
            <span className="flex gap-0.5">
              {["W", "A", "S", "D"].map(key => (
                <kbd key={key} className="grid size-5 place-items-center rounded border border-white/30 bg-white/15 font-sans text-[11px] leading-none">{key}</kbd>
              ))}
            </span>
          ),
        })}
      </div>
      {failed && <p role="status" className="absolute left-4 top-24 z-20 bg-white px-3! py-2! text-sm">{t("sceneUnavailable")}</p>}
    </>
  );
}
