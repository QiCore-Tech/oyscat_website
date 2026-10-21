import { headers } from "next/headers"

export const SITE_NAME = "Oyscat"

/** The company that makes Oyscat. */
export const PUBLISHER = {
  name: "QiCore",
  legalName: "深圳气核科技有限公司",
  alternateName: ["气核科技", "深圳气核科技有限公司"],
  url: "https://qicore.ai",
  email: "info@qicore.ai",
}

// Oyscat's official accounts; keep in sync with the social links in (introduce)/introduce-footer.tsx.
export const SOCIAL_PROFILES = [
  "https://mp.weixin.qq.com/s/wSbBTSHUgdm0Ayuk601eRw",
  "https://space.bilibili.com/3745036743215474",
  "https://xhslink.cn/m/85xQ3j0HIh4",
  "https://www.facebook.com/share/1baynW2wi6/",
  "https://www.instagram.com/oyscat_official",
  "https://x.com/Oyscat",
  "https://www.youtube.com/@OyscatOfficial",
]

export const TWITTER_HANDLE = "@Oyscat"

/**
 * The site's public origin, used for canonical, Open Graph, sitemap and structured-data URLs.
 * Set OYSCAT_SITE_URL in production; without it the origin comes from the request (the proxy's forwarded host first).
 */
export async function getSiteUrl(): Promise<URL> {
  const configured = process.env.OYSCAT_SITE_URL?.trim()
  if (configured) return new URL(configured)

  const requestHeaders = await headers()
  const host = firstValue(requestHeaders.get("x-forwarded-host")) ?? requestHeaders.get("host") ?? "localhost:3100"
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host)
  const protocol = firstValue(requestHeaders.get("x-forwarded-proto")) ?? (isLocal ? "http" : "https")
  return new URL(`${protocol}://${host}`)
}

function firstValue(header: string | null) {
  return header?.split(",")[0]?.trim() || undefined
}
