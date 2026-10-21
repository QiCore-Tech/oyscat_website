// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CanvasVoxel } from "./lib/home-canvas-geometry"
import { CANVAS_COLUMNS, CANVAS_ROWS, createVehicleBlueprint, type AssemblyCommand } from "./lib/home-vehicle-assembly"
import { mountVoxelStore } from "./voxel-store"

const send = (detail: AssemblyCommand) =>
  window.dispatchEvent(new CustomEvent("qicore:canvas-assembly-command", { detail }))

const voxelsOf = (root: HTMLElement) => JSON.parse(root.dataset.voxelState ?? "[]") as CanvasVoxel[]

describe("hero voxel store", () => {
  let root: HTMLElement
  let unmount = () => {}

  beforeEach(() => {
    root = document.createElement("section")
    root.dataset.canvasColumns = String(CANVAS_COLUMNS)
    root.dataset.canvasRows = String(CANVAS_ROWS)
    document.body.append(root)
  })

  afterEach(() => {
    unmount()
    root.remove()
  })

  it("announces an empty, ready editor on mount", () => {
    let ready = 0
    const onReady = () => { ready += 1 }
    window.addEventListener("qicore:canvas-editor-ready", onReady)
    unmount = mountVoxelStore(root)
    window.removeEventListener("qicore:canvas-editor-ready", onReady)

    expect(ready).toBe(1)
    expect(root.dataset.editorReady).toBe("true")
    expect(voxelsOf(root)).toEqual([])
  })

  it("builds the whole vehicle through one assembly session", () => {
    unmount = mountVoxelStore(root)
    const parts = createVehicleBlueprint()
    send({ action: "begin", sessionId: "s1", replace: true })
    expect(root.dataset.assemblySession).toBe("s1")
    for (const part of parts) send({ action: "place", sessionId: "s1", voxel: part.voxel })
    send({ action: "finish", sessionId: "s1" })

    const voxels = voxelsOf(root)
    expect(voxels).toHaveLength(parts.length)
    expect(voxels.every(voxel => voxel.wheelAxis)).toBe(true)
    expect(root.dataset.assemblySession).toBeUndefined()
    expect(root.dataset.canvasColumns).toBe(String(CANVAS_COLUMNS))
    expect(root.dataset.canvasRows).toBe(String(CANVAS_ROWS))
  })

  it("rejects places outside the session, the board or free space", () => {
    unmount = mountVoxelStore(root)
    const voxel: CanvasVoxel = { id: 1, x: 2, y: 2, z: 0, sx: 1, sy: 1, sz: 1, moduleId: "cube", colorKey: "white" }
    send({ action: "begin", sessionId: "s1", replace: true })
    send({ action: "place", sessionId: "other", voxel })
    send({ action: "place", sessionId: "s1", voxel: { ...voxel, x: CANVAS_COLUMNS } })
    send({ action: "place", sessionId: "s1", voxel })
    send({ action: "place", sessionId: "s1", voxel: { ...voxel, id: 2 } })
    send({ action: "place", sessionId: "s1", voxel: { ...voxel, x: 3 } })

    expect(voxelsOf(root).map(placed => placed.id)).toEqual([1])
  })
})
