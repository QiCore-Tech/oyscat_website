import type { MetadataRoute } from "next"
import { SITE_NAME } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI 电气化造物系统`,
    short_name: SITE_NAME,
    description: "Oyscat 是深圳气核科技（QiCore）推出的 AI 电气化造物系统，也是 GenPI 体系的首个落地实现。重构造物全链路，让任何人都能亲手实现创意。",
    lang: "zh-CN",
    start_url: "/",
    display: "browser",
    categories: ["productivity", "utilities"],
    background_color: "#ffffff",
    theme_color: "#FAFAFA",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  }
}
