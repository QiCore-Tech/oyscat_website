/**
 * In-process fixed-window limiter: each key gets `maxPerKey` slots per window, and all keys together share `maxGlobal`.
 * State lives in this process only, so it resets on restart and is not shared between instances.
 */
export function createRateLimiter({ windowMs, maxPerKey, maxGlobal, now = Date.now }) {
  const windows = new Map()
  let globalWindow = { count: 0, resetAt: 0 }

  const sweep = setInterval(() => {
    const time = now()
    for (const [key, window] of windows) {
      if (window.resetAt <= time) windows.delete(key)
    }
  }, windowMs)
  sweep.unref()

  return {
    /** Takes a slot for `key`. Returns 0 when allowed, otherwise the seconds until a retry can succeed. */
    take(key) {
      const time = now()
      let window = windows.get(key)
      if (!window || window.resetAt <= time) {
        window = { count: 0, resetAt: time + windowMs }
        windows.set(key, window)
      }
      if (window.count >= maxPerKey) return secondsUntil(window.resetAt, time)

      if (globalWindow.resetAt <= time) globalWindow = { count: 0, resetAt: time + windowMs }
      if (globalWindow.count >= maxGlobal) return secondsUntil(globalWindow.resetAt, time)

      window.count += 1
      globalWindow.count += 1
      return 0
    },
    close() {
      clearInterval(sweep)
    },
  }
}

function secondsUntil(resetAt, time) {
  return Math.max(1, Math.ceil((resetAt - time) / 1000))
}
