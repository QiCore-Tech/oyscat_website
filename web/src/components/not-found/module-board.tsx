import type { CSSProperties } from "react"

/**
 * The 404 illustration: "404" set in black electronic modules on a peg board, one module short. Its slot is a
 * dashed outline and the module itself (lime, like the site's call to action) has dropped to the bottom of the
 * board. Purely decorative, so it stays a server component with no state or listeners.
 */

const INK = "#18181b"
const KNOB = "#52525b"
const LIME = "#b3f142"
const PEG = "#e4e4e7"
const SHADOW = "#e4e4e7"
const SEAT_STROKE = "#a1a1aa"

// 5×7 glyphs, one string per row; "#" is a module.
const GLYPHS: Record<string, string[]> = {
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
}
const GLYPH_W = 5
const TEXT_ROW = 1
const TEXT_COL = 1

// One empty column around and between the digits, two spare rows below them for the fallen module.
const COLS = TEXT_COL * 2 + GLYPH_W * 3 + 2
const ROWS = TEXT_ROW + 7 + 2
const PITCH = 20
const PAD = 4
const MODULE = 16
const BOARD_W = PAD * 2 + PITCH * COLS
const BOARD_H = PAD * 2 + PITCH * ROWS

const MODULES = new Set(
  [..."404"].flatMap((digit, index) =>
    GLYPHS[digit].flatMap((line, row) =>
      [...line].flatMap((cell, col) => (cell === "#" ? [`${TEXT_ROW + row}:${TEXT_COL + index * (GLYPH_W + 1) + col}`] : [])),
    ),
  ),
)

// Bottom-right module of the middle 0; it rests tilted in the spare rows below.
const SEAT = { row: 7, col: 10 }
const FALLEN = { row: 8.7, col: 11.6 }
const FALLEN_TILT = -14

function center({ row, col }: { row: number; col: number }) {
  return { cx: PAD + PITCH * col + PITCH / 2, cy: PAD + PITCH * row + PITCH / 2 }
}

function Module({ cx, cy, fill = INK, knob = KNOB }: { cx: number; cy: number; fill?: string; knob?: string }) {
  const x = cx - MODULE / 2
  const y = cy - MODULE / 2
  return (
    <g>
      <rect x={x + 1.2} y={y + 1.8} width={MODULE} height={MODULE} rx={3.5} fill={SHADOW} />
      <rect x={x} y={y} width={MODULE} height={MODULE} rx={3.5} fill={fill} />
      <circle cx={cx} cy={cy} r={2.8} fill={knob} />
    </g>
  )
}

export function ModuleBoard({ label, missing }: { label: string; missing: string }) {
  const seat = center(SEAT)
  const fallen = center(FALLEN)

  return (
    <div className="relative w-full max-w-[560px]" aria-hidden="true">
      <div className="grid gap-4 rounded-[24px] border border-zinc-200 bg-white px-[clamp(16px,5%,24px)] pt-5 pb-5 shadow-[12px_14px_0_#f4f4f5]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px] font-medium tracking-[0.14em] text-zinc-400">
          <span>{label}</span>
          <span>{missing}</span>
        </div>

        <svg className="block h-auto w-full" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}>
          {Array.from({ length: ROWS * COLS }, (_, index) => {
            const row = Math.floor(index / COLS)
            const col = index % COLS
            const key = `${row}:${col}`
            const { cx, cy } = center({ row, col })

            if (row === SEAT.row && col === SEAT.col) {
              return (
                <rect
                  key={key}
                  className="animate-[not-found-seat-march_2s_linear_infinite] motion-reduce:animate-none"
                  x={cx - MODULE / 2 + 0.6}
                  y={cy - MODULE / 2 + 0.6}
                  width={MODULE - 1.2}
                  height={MODULE - 1.2}
                  rx={3}
                  fill="#ffffff"
                  stroke={SEAT_STROKE}
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
              )
            }
            if (MODULES.has(key)) return <Module key={key} cx={cx} cy={cy} />
            return <rect key={key} x={cx - 1.5} y={cy - 1.5} width={3} height={3} rx={0.8} fill={PEG} />
          })}

          {/* Drawn last so it passes over the board; it falls once from its seat on load and comes to rest tilted. */}
          <g
            className="animate-[not-found-module-drop_1000ms_450ms_both] motion-reduce:animate-none"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: `rotate(${FALLEN_TILT}deg)`,
              "--module-from-x": `${seat.cx - fallen.cx}px`,
              "--module-from-y": `${seat.cy - fallen.cy}px`,
              "--module-tilt": `${FALLEN_TILT}deg`,
            } as CSSProperties}
          >
            <Module cx={fallen.cx} cy={fallen.cy} fill={LIME} knob={INK} />
          </g>
        </svg>
      </div>
    </div>
  )
}
