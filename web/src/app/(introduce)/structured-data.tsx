import type { AppLocale } from "../../../i18n/locale"
import { PUBLISHER, SITE_NAME, SOCIAL_PROFILES } from "@/lib/site"
import { INTRODUCE_FAQ } from "./faq-content"
import oyscatLogo from "./images/oyscat.svg"

interface IntroduceStructuredDataProps {
  locale: AppLocale
  siteUrl: URL
  title: string
  description: string
  imageUrl: string
}

/** schema.org JSON-LD for the landing page: the company, the Oyscat brand, the site, this page and its FAQ. */
export function IntroduceStructuredData({ locale, siteUrl, title, description, imageUrl }: IntroduceStructuredDataProps) {
  const home = new URL("/", siteUrl).href
  const en = locale === "en"
  const ids = {
    publisher: `${PUBLISHER.url}/#organization`,
    brand: `${home}#organization`,
    website: `${home}#website`,
    webpage: `${home}#webpage`,
  }

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ids.publisher,
        name: PUBLISHER.name,
        legalName: PUBLISHER.legalName,
        alternateName: PUBLISHER.alternateName,
        url: PUBLISHER.url,
        email: PUBLISHER.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: en ? "Shenzhen" : "深圳市",
          addressRegion: en ? "Guangdong" : "广东省",
          addressCountry: "CN",
        },
      },
      {
        "@type": "Organization",
        "@id": ids.brand,
        name: SITE_NAME,
        url: home,
        logo: new URL(oyscatLogo.src, siteUrl).href,
        sameAs: SOCIAL_PROFILES,
        parentOrganization: { "@id": ids.publisher },
      },
      {
        "@type": "WebSite",
        "@id": ids.website,
        name: SITE_NAME,
        url: home,
        inLanguage: ["zh-CN", "en"],
        publisher: { "@id": ids.publisher },
      },
      {
        "@type": "WebPage",
        "@id": ids.webpage,
        url: home,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { "@id": ids.website },
        about: { "@id": ids.brand },
        primaryImageOfPage: { "@type": "ImageObject", url: imageUrl, width: 1200, height: 630 },
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        inLanguage: locale,
        isPartOf: { "@id": ids.webpage },
        mainEntity: INTRODUCE_FAQ[locale].map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer.join("\n") },
        })),
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      // Escaping "<" keeps any text in the data from closing the script element early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  )
}
