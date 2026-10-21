import type { MetadataRoute } from "next"
import { SITE_NAME } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI 电气化造物系统`,
    short_name: SITE_NAME,
    description: "专注你想造什么，而不是你会什么。Oyscat 是深圳气核科技有限公司（QiCore）推出的 AI 电气化造物系统。",
    lang: "zh-CN",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#FAFAFA",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  }
}
