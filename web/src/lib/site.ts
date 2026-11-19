// Site-wide constants. Kept free of server-only imports so client components can use them too.

export const SITE_NAME = "Oyscat"

/** The company that makes Oyscat. */
export const PUBLISHER = {
  name: "QiCore",
  legalName: "深圳气核科技有限公司",
  alternateName: ["气核科技", "深圳气核科技有限公司"],
  url: "https://qicore.ai",
  email: "info@qicore.ai",
}

// Oyscat's official accounts; keep in sync with the social links in (introduce)/introduce-footer.tsx.
export const SOCIAL_PROFILES = [
  "https://www.facebook.com/share/1baynW2wi6/",
  "https://www.instagram.com/oyscat_official?srtk=MTJjcmYwOWozbDZqeQ==",
  "https://www.youtube.com/@OyscatOfficial/videos",
  "https://x.com/Oyscat",
]

export const TWITTER_HANDLE = "@Oyscat"

/** Shows the 中/EN switcher in the headers. While it is off every visitor gets the default locale (zh-CN), whatever NEXT_LOCALE cookie they kept. */
export const LANGUAGE_SWITCHER_ENABLED = true

/** The beta sign-up form behind the hero's and the 404 page's call to action. */
export const WORKSPACE_ACCESS_FORM_URL = "https://bcn87u70v4ke.feishu.cn/share/base/form/shrcnqbRzoBUSCmsBy7YhvdDTin"
