import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await getSiteUrl()
  return [
    {
      url: new URL("/", siteUrl).href,
      changeFrequency: "weekly",
      priority: 1,
      images: ["/og/oyscat-zh-CN.png", "/og/oyscat-en.png"].map((path) => new URL(path, siteUrl).href),
    },
  ]
}
