import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getRequestLocale } from "../../../i18n/locale"
import { SITE_NAME, TWITTER_HANDLE, getSiteUrl } from "@/lib/site"
import { IntroduceStructuredData } from "./structured-data"

const OG_LOCALE = { "zh-CN": "zh_CN", en: "en_US" } as const

// The language comes from a cookie, so both versions share "/"; crawlers without the cookie index the Chinese one.
async function getPageSeo() {
  const locale = await getRequestLocale()
  const t = await getTranslations({ locale, namespace: "introduce" })
  return {
    locale,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("metaKeywords").split(/\s*,\s*/),
    image: { url: `/og/oyscat-${locale}.png`, width: 1200, height: 630, alt: t("ogImageAlt") },
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, title, description, keywords, image } = await getPageSeo()
  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: SITE_NAME,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter((value) => value !== OG_LOCALE[locale]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
  }
}

export default async function IntroduceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ locale, title, description, image }, siteUrl] = await Promise.all([getPageSeo(), getSiteUrl()])
  return (
    <>
      {children}
      <IntroduceStructuredData
        locale={locale}
        siteUrl={siteUrl}
        title={title}
        description={description}
        imageUrl={new URL(image.url, siteUrl).href}
      />
    </>
  )
}
