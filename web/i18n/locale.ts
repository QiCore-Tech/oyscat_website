import { cookies } from "next/headers"
import { LANGUAGE_SWITCHER_ENABLED } from "../src/lib/site"
import { routing } from "./routing"

export type AppLocale = (typeof routing.locales)[number]

/** The interface language picked with the header switcher (NEXT_LOCALE cookie); unknown values fall back to the default. */
export async function getRequestLocale(): Promise<AppLocale> {
  // With the switcher hidden a saved cookie could never be changed back, so ignore it.
  if (!LANGUAGE_SWITCHER_ENABLED) return routing.defaultLocale
  const requested = (await cookies()).get("NEXT_LOCALE")?.value
  return routing.locales.find((candidate) => candidate === requested) ?? routing.defaultLocale
}
