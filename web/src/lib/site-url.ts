import { headers } from "next/headers"

/**
 * The site's public origin, used for canonical, Open Graph, sitemap and structured-data URLs. In order:
 * OYSCAT_SITE_URL; on Vercel, the project's production domain (so preview deployments still point at
 * production); otherwise the host the request came in on (the proxy's forwarded host first).
 */
export async function getSiteUrl(): Promise<URL> {
  const configured = process.env.OYSCAT_SITE_URL?.trim()
  if (configured) return new URL(configured)

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercelProduction) return new URL(`https://${vercelProduction}`)

  const requestHeaders = await headers()
  const host = firstValue(requestHeaders.get("x-forwarded-host")) ?? requestHeaders.get("host") ?? "localhost:3100"
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host)
  const protocol = firstValue(requestHeaders.get("x-forwarded-proto")) ?? (isLocal ? "http" : "https")
  return new URL(`${protocol}://${host}`)
}

function firstValue(header: string | null) {
  return header?.split(",")[0]?.trim() || undefined
}
