import { fontVariables } from "@/lib/fonts"

// Shared by the introduce pages. The families are declared in src/lib/fonts.ts and exposed on <html>;
// repeating the variables here keeps the page self-contained for portals and the 404 page.
export const introduceFontClass = `${fontVariables} font-sans`
// Screens 2–4 are laid out for a ~1585×773 (16:10) viewport. --u is one design pixel there; on larger desktops it
// grows with the viewport (≈1.3× at 2560×1440), capped at 1.5×. Tailwind spacing and named text sizes resolve
// through these theme variables, so overriding them scales the whole section evenly.
export const sectionScaleClass =
  "[--u:0.0625rem] xl:[--u:clamp(0.0625rem,min(100svh/970,100vw/1970),0.09375rem)] [--spacing:calc(4*var(--u))] [--text-xs:calc(12*var(--u))] [--text-sm:calc(14*var(--u))] [--text-base:calc(16*var(--u))] [--text-lg:calc(18*var(--u))] [--text-xl:calc(20*var(--u))] [--text-2xl:calc(24*var(--u))] [--text-4xl:calc(36*var(--u))]"
