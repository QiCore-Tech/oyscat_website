import type { Metadata, Viewport } from "next"
import { NextIntlClientProvider } from "next-intl"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PUBLISHER, SITE_NAME } from "@/lib/site"
import { getSiteUrl } from "@/lib/site-url"
import { getRequestLocale } from "../../i18n/locale"
import "./globals.css"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAFA",
  colorScheme: "light",
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Resolves the relative canonical, Open Graph and Twitter URLs the pages declare.
    metadataBase: await getSiteUrl(),
    title: { default: `${SITE_NAME} — AI 电气化造物系统`, template: `%s | ${SITE_NAME}` },
    description: "Oyscat 是深圳气核科技（QiCore）推出的 AI 电气化造物系统，也是 GenPI 体系的首个落地实现。",
    applicationName: SITE_NAME,
    authors: [{ name: PUBLISHER.legalName, url: PUBLISHER.url }],
    creator: PUBLISHER.legalName,
    publisher: PUBLISHER.legalName,
    category: "technology",
    formatDetection: { telephone: false, address: false, email: false },
    referrer: "origin-when-cross-origin",
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BAIDU_SITE_VERIFICATION
        ? { "baidu-site-verification": process.env.BAIDU_SITE_VERIFICATION }
        : {},
    },
    // Tells Baidu the same page serves desktop and mobile, so it doesn't transcode it.
    other: { "applicable-device": "pc,mobile" },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getRequestLocale()
  const messages = (await import(`../../messages/${locale}.json`)).default

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
