import localFont from "next/font/local"

// Shared by the introduce pages. Only the weights they use: each MiSans file is ~8 MB. The hero's 800 resolves to Heavy.
export const introduceFont = localFont({
  src: [
    { path: "./font/MiSans/MiSans-Regular.ttf", weight: "400" },
    { path: "./font/MiSans/MiSans-Medium.ttf", weight: "500" },
    { path: "./font/MiSans/MiSans-Semibold.ttf", weight: "600" },
    { path: "./font/MiSans/MiSans-Bold.ttf", weight: "700" },
    { path: "./font/MiSans/MiSans-Heavy.ttf", weight: "900" },
  ],
  variable: "--font-introduce",
  display: "swap",
})
export const introduceFontClass = `${introduceFont.variable} font-[family-name:var(--font-introduce),var(--font-sans)]`
// Screens 2–4 are laid out for a ~1585×773 (16:10) viewport. --u is one design pixel there; on larger desktops it
// grows with the viewport (≈1.3× at 2560×1440), capped at 1.5×. Tailwind spacing and named text sizes resolve
// through these theme variables, so overriding them scales the whole section evenly.
export const sectionScaleClass =
  "[--u:0.0625rem] xl:[--u:clamp(0.0625rem,min(100svh/970,100vw/1970),0.09375rem)] [--spacing:calc(4*var(--u))] [--text-xs:calc(12*var(--u))] [--text-sm:calc(14*var(--u))] [--text-base:calc(16*var(--u))] [--text-lg:calc(18*var(--u))] [--text-xl:calc(20*var(--u))] [--text-2xl:calc(24*var(--u))] [--text-4xl:calc(36*var(--u))]"
