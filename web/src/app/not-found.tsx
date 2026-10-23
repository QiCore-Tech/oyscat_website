import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react"
import { getRequestLocale } from "../../i18n/locale"
import { InterfaceLanguageSwitcher } from "@/components/chrome/interface-language-switcher"
import { ModuleBoard } from "@/components/not-found/module-board"
import { LANGUAGE_SWITCHER_ENABLED, PUBLISHER, WORKSPACE_ACCESS_FORM_URL } from "@/lib/site"
import { introduceFontClass } from "./(introduce)/introduce-theme"
import oyscatLogo from "./(introduce)/images/oyscat.svg"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: await getRequestLocale(), namespace: "notFound" })
  // Next adds <meta name="robots" content="noindex"> to not-found responses itself.
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    robots: { index: false, follow: true },
  }
}

/** Every unmatched URL renders this inside the root layout, with a 404 status. */
export default async function NotFound() {
  const locale = await getRequestLocale()
  const [t, tHero, tIntro] = await Promise.all([
    getTranslations({ locale, namespace: "notFound" }),
    getTranslations({ locale, namespace: "introduce.qicoreHero" }),
    getTranslations({ locale, namespace: "introduce" }),
  ])

  return (
    <div className={`${introduceFontClass} flex min-h-screen flex-1 flex-col bg-white text-zinc-900 tracking-normal`}>
      <header>
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-5 px-5 py-2 sm:px-7 [&_a]:inline-flex [&_a]:items-center [&_a]:justify-center [&_a]:gap-2 [&_a:hover]:text-ok [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-ok [&_a:focus-visible]:outline-offset-5">
          <Link href="/" aria-label={tIntro("homeLabel")}>
            <Image src={oyscatLogo} alt="Oyscat" unoptimized className="h-7 w-[100px] object-cover" />
          </Link>
          {/* No refresh callback: the switcher reloads the page, which re-renders this 404 in the new language. */}
          {LANGUAGE_SWITCHER_ENABLED && <InterfaceLanguageSwitcher variant="inline" />}
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <section
          aria-labelledby="not-found-title"
          className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-5 py-12 sm:px-7 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16"
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.16em] text-zinc-400">{t("eyebrow")}</p>
            <h1 id="not-found-title" className="mt-4 text-3xl leading-tight font-bold tracking-tight text-balance text-zinc-900 sm:text-4xl lg:text-[44px]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-pretty text-zinc-500">{t("description")}</p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#b3f142] px-6 text-[15px] text-[#111] transition-colors hover:bg-[#a5de3d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111]"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("backHome")}
              </Link>
              <a
                href={WORKSPACE_ACCESS_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-zinc-300 bg-white px-6 text-[15px] text-zinc-900 transition-colors hover:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-600"
              >
                {tHero("enterWorkspace")}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </div>

            <p className="mt-12 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-200 pt-6 text-sm text-zinc-500">
              {t("contactPrompt")}
              <a
                href={`mailto:${PUBLISHER.email}`}
                className="inline-flex items-center gap-1.5 rounded-sm text-zinc-700 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
              >
                <Mail aria-hidden="true" className="size-4" />
                {PUBLISHER.email}
              </a>
            </p>
          </div>

          <div className="flex max-lg:order-first lg:justify-end">
            <ModuleBoard label={t("boardLabel")} missing={t("boardMissing")} />
          </div>
        </section>
      </main>
    </div>
  )
}
