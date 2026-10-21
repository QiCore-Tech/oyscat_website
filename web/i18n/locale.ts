import { cookies } from "next/headers"
import { routing } from "./routing"

export type AppLocale = (typeof routing.locales)[number]

/** The interface language picked with the header switcher (NEXT_LOCALE cookie); unknown values fall back to the default. */
export async function getRequestLocale(): Promise<AppLocale> {
  const requested = (await cookies()).get("NEXT_LOCALE")?.value
  return routing.locales.find((candidate) => candidate === requested) ?? routing.defaultLocale
}
