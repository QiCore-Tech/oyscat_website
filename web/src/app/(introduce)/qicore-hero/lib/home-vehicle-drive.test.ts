import { describe, expect, it } from "vitest"
import { createVehicleDriver, DEFAULT_DRIVE_AREA, getPoseOverhang, MANUAL_MAX_SPEED, type DriveInput } from "./home-vehicle-drive"

// A small deterministic generator, so a failing roam can be replayed.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function driveFor(driver: ReturnType<typeof createVehicleDriver>, input: DriveInput, seconds: number) {
  driver.setInput(input)
  let worst = -Infinity
  for (let step = 0; step < seconds * 60; step += 1) {
    driver.tick(1000 / 60)
    worst = Math.max(worst, getPoseOverhang(driver.pose, DEFAULT_DRIVE_AREA))
  }
  return worst
}

describe("vehicle driver", () => {
  it("keeps a keyboard-driven car on the board and stops it at the edge", () => {
    for (const [throttle, steer] of [[1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1]] as const) {
      const driver = createVehicleDriver()
      driver.takeWheel()
      // Long enough to reach an edge and keep pushing against it.
      expect(driveFor(driver, { throttle, steer: 0 }, 6)).toBeLessThanOrEqual(1e-9)
      expect(driveFor(driver, { throttle, steer }, 40)).toBeLessThanOrEqual(1e-9)
      if (steer === 0) expect(Math.abs(driver.speed)).toBeLessThan(1e-6)
    }
  })

  it("speeds up while W is held, then cruises at the top speed", () => {
    const driver = createVehicleDriver()
    driver.takeWheel()
    driveFor(driver, { throttle: 1, steer: 0 }, 1)
    const early = driver.speed
    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(MANUAL_MAX_SPEED)
    // Still well short of the board edge after four seconds.
    for (const seconds of [1.5, 1.5]) {
      driveFor(driver, { throttle: 1, steer: 0 }, seconds)
      expect(driver.speed).toBeCloseTo(MANUAL_MAX_SPEED, 6)
    }
  })

  it("turns left on A while driving forward", () => {
    const driver = createVehicleDriver()
    driver.takeWheel()
    driveFor(driver, { throttle: 1, steer: 1 }, 1)
    expect(driver.state).toBe("manual")
    expect(driver.pose.heading).toBeGreaterThan(0.05)
    expect(driver.pose.x).toBeLessThan(0)
  })

  it("roams on from where it was driven once left standing, unless held", () => {
    const driver = createVehicleDriver(seeded(3))
    driver.takeWheel(1000)
    // Up to 8 units a second, which takes about 1.3 s to coast down from;
    // then it stands for 0.7 s of the 1 s it waits.
    driveFor(driver, { throttle: 1, steer: 0 }, 1)
    driveFor(driver, { throttle: 0, steer: 0 }, 2)
    expect(driver.state).toBe("manual")
    const stopped = driver.pose
    driveFor(driver, { throttle: 0, steer: 0 }, 1)
    expect(driver.state).toBe("roaming")
    // It sets off from where it stopped, not from the build spot.
    expect(Math.hypot(stopped.x, stopped.y)).toBeGreaterThan(3)
    expect(Math.hypot(driver.pose.x - stopped.x, driver.pose.y - stopped.y)).toBeLessThan(1)

    const held = createVehicleDriver()
    held.takeWheel()
    driveFor(held, { throttle: 0, steer: 0 }, 10)
    expect(held.state).toBe("manual")
  })

  it("roams without ever leaving the board", () => {
    // Seeds 7 and 9 used to graze past an edge on a fallback leg.
    for (let seed = 1; seed <= 10; seed += 1) {
      const driver = createVehicleDriver(seeded(seed))
      driver.reset(0)
      let worst = -Infinity
      for (let step = 0; step < 600 * 60; step += 1) {
        driver.tick(1000 / 60)
        // Send it home now and then, which plans a different kind of path.
        if (step % (45 * 60) === 0) driver.recall()
        worst = Math.max(worst, getPoseOverhang(driver.pose, DEFAULT_DRIVE_AREA))
      }
      expect(worst, `seed ${seed}`).toBeLessThanOrEqual(1e-9)
    }
  })
})
