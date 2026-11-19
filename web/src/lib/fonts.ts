import localFont from "next/font/local"

// English body copy.
export const objectivity = localFont({
  src: [
    { path: "../../font/Objectivity/objectivity-light-6.otf", weight: "300", style: "normal" },
    { path: "../../font/Objectivity/objectivity-medium-8.otf", weight: "500", style: "normal" },
    { path: "../../font/Objectivity/objectivity-bold-4.otf", weight: "700", style: "normal" },
    { path: "../../font/Objectivity/objectivity-black-3.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-objectivity",
  display: "swap",
  adjustFontFallback: false,
})

// Chinese copy for every role.
export const harmonySans = localFont({
  src: [
    { path: "../../font/HarmonyOS Sans/HarmonyOS_Sans_SC/HarmonyOS_Sans_SC_Regular.ttf", weight: "400", style: "normal" },
    { path: "../../font/HarmonyOS Sans/HarmonyOS_Sans_SC/HarmonyOS_Sans_SC_Medium.ttf", weight: "500", style: "normal" },
    { path: "../../font/HarmonyOS Sans/HarmonyOS_Sans_SC/HarmonyOS_Sans_SC_Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-harmony",
  display: "swap",
  adjustFontFallback: false,
})

// English headings: titles, subtitles, section and block titles, navigation.
export const outfit = localFont({
  src: [{ path: "../../font/outfit/Outfit-VariableFont_wght.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-outfit",
  display: "swap",
  adjustFontFallback: false,
})

// Labels and annotation text.
export const geistMono = localFont({
  src: [{ path: "../../font/geist_mono/GeistMono-VariableFont_wght.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
})

/** Class that exposes every font variable; apply it once on <html>. */
export const fontVariables = [objectivity.variable, harmonySans.variable, outfit.variable, geistMono.variable].join(" ")
