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
  keywords: string[]
  slogan: string
  features: string[]
  genpiDescription: string
}

/** schema.org JSON-LD for the landing page: the company, Oyscat, GenPI, the site, the app and its FAQ. */
export function IntroduceStructuredData({
  locale,
  siteUrl,
  title,
  description,
  imageUrl,
  keywords,
  slogan,
  features,
  genpiDescription,
}: IntroduceStructuredDataProps) {
  const home = new URL("/", siteUrl).href
  const en = locale === "en"
  const ids = {
    publisher: `${PUBLISHER.url}/#organization`,
    brand: `${home}#brand`,
    genpi: `${home}#genpi`,
    software: `${home}#software`,
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
        description: en
          ? "Shenzhen QiCore Technology develops Oyscat, an AI electrified making system."
          : "深圳气核科技有限公司研发 Oyscat AI 电气化造物系统。",
        address: {
          "@type": "PostalAddress",
          addressLocality: en ? "Shenzhen" : "深圳市",
          addressRegion: en ? "Guangdong" : "广东省",
          addressCountry: "CN",
        },
        brand: { "@id": ids.brand },
      },
      {
        "@type": "Brand",
        "@id": ids.brand,
        name: SITE_NAME,
        url: home,
        logo: new URL(oyscatLogo.src, siteUrl).href,
        slogan,
        sameAs: SOCIAL_PROFILES,
      },
      {
        "@type": "CreativeWorkSeries",
        "@id": ids.genpi,
        name: "GenPI",
        description: genpiDescription,
        creator: { "@id": ids.publisher },
        inLanguage: locale,
      },
      {
        "@type": "SoftwareApplication",
        "@id": ids.software,
        name: SITE_NAME,
        url: home,
        description,
        applicationCategory: "DesignApplication",
        applicationSubCategory: en ? "AI electrified making system" : "AI 电气化造物系统",
        operatingSystem: en ? "Web browser" : "Web 浏览器",
        inLanguage: locale,
        image: imageUrl,
        publisher: { "@id": ids.publisher },
        brand: { "@id": ids.brand },
        isPartOf: { "@id": ids.genpi },
        featureList: features,
        keywords: keywords.join(", "),
      },
      {
        "@type": "WebSite",
        "@id": ids.website,
        name: SITE_NAME,
        url: home,
        inLanguage: ["zh-CN", "en"],
        publisher: { "@id": ids.publisher },
        about: { "@id": ids.brand },
      },
      {
        "@type": "WebPage",
        "@id": ids.webpage,
        url: home,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { "@id": ids.website },
        about: [{ "@id": ids.brand }, { "@id": ids.genpi }, { "@id": ids.software }],
        mainEntity: { "@id": ids.software },
        keywords: keywords.join(", "),
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
