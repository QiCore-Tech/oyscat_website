"use client"

import { Fragment } from "react"
import { useLocale, useTranslations } from "next-intl"

const INTERFACE_LOCALES = [
  { value: "zh-CN", labelKey: "languageChinese" },
  { value: "en", labelKey: "languageEnglish" },
] as const

export interface InterfaceLanguageSwitcherProps {
  compact?: boolean
  variant?: "segmented" | "inline"
  /** Applies the saved locale in place (e.g. `router.refresh`); the page reloads when omitted. */
  onLocaleChange?: () => void
}

/** A small, shared interface-language control for pages outside the workspace. */
export function InterfaceLanguageSwitcher({
  compact = false,
  variant = "segmented",
  onLocaleChange,
}: InterfaceLanguageSwitcherProps) {
  const locale = useLocale()
  const t = useTranslations("footer")

  const selectLocale = (nextLocale: string) => {
    if (nextLocale === locale) return
    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000`
    if (onLocaleChange) onLocaleChange()
    else window.location.reload()
  }

  return (
    <div
      className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}
      role="group"
      aria-label={t("languageLabel")}
      data-testid="interface-language-switcher"
    >
      {variant !== "inline" && <span className="text-xs text-muted-foreground">{t("languageLabel")}</span>}
      <div className={variant === "inline"
        ? "inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        : "inline-flex rounded-lg border border-border bg-muted/35 p-0.5"}>
        {INTERFACE_LOCALES.map((option, index) => {
          const selected = locale === option.value
          return (
            <Fragment key={option.value}>
              {variant === "inline" && index > 0 && <span aria-hidden="true" className="h-3.5 w-px bg-zinc-300" />}
              <button
                type="button"
                data-testid={`interface-language-option-${option.value}`}
                data-locale={option.value}
                aria-pressed={selected}
                aria-label={t(option.labelKey)}
                onClick={() => selectLocale(option.value)}
                className={
                  variant === "inline"
                    ? "inline-flex h-8 cursor-pointer items-center justify-center rounded-full px-2 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-ok focus-visible:outline-offset-1 " +
                      (selected ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-900")
                    : "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                  (selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {variant === "inline" ? (option.value === "zh-CN" ? "中" : "EN") : t(option.labelKey)}
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
