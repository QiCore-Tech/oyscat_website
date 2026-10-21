import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PUBLISHER, SITE_NAME, getSiteUrl } from "@/lib/site"
import { getRequestLocale } from "../../i18n/locale"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Resolves the relative canonical, Open Graph and Twitter URLs the pages declare.
    metadataBase: await getSiteUrl(),
    title: SITE_NAME,
    description: "Oyscat — 让创造变得简单",
    applicationName: SITE_NAME,
    authors: [{ name: PUBLISHER.legalName, url: PUBLISHER.url }],
    creator: PUBLISHER.legalName,
    publisher: PUBLISHER.legalName,
    category: "technology",
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
      <head>
        <meta name="theme-color" content="#FAFAFA" />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
