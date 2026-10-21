"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { useLocale } from "next-intl"
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { introduceFontClass, sectionScaleClass } from "./introduce-theme"
import oyscatLogo from "./images/oyscat.svg"

function FooterSocialIcon({ platform }: { platform: string }) {
  // Brand paths from Simple Icons (CC0): github.com/simple-icons/simple-icons.
  const brandPaths: Record<string, string> = {
    WeChat: "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z",
    Bilibili: "M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z",
    Xiaohongshu: "M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z",
  }
  if (platform === "Xiaohongshu") {
    return (
      <svg aria-hidden="true" data-platform={platform} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="m9 7-3 4h4m1-2-4 6h4m-5 3 5-1M13 8h5m-2.5 0v9M12 17h7" />
      </svg>
    )
  }
  if (brandPaths[platform]) {
    return <svg aria-hidden="true" data-platform={platform} viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d={brandPaths[platform]} /></svg>
  }
  const paths: Record<string, string> = {
    Facebook: "M14 22v-9h3l.5-4H14V7c0-1 .3-2 2-2h2V1.5A24 24 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9",
    Instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M17.5 6.5h.01",
    "Twitter / X": "M3 3h4l14 18h-4L3 3Z M21 3 3 21",
    YouTube: "M22 8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8Z M10 9l5 3-5 3V9Z",
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d={paths[platform]} /></svg>
}

export function IntroduceFooter() {
  const locale = useLocale()
  const en = locale === "en"
  const [email, setEmail] = useState("")
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "sending" | "success" | "rate_limited" | "error">("idle")

  async function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || subscribeStatus === "sending") return
    setSubscribeStatus("sending")
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      })
      if (response.ok) {
        setSubscribeStatus("success")
        setEmail("")
      } else {
        setSubscribeStatus(response.status === 429 ? "rate_limited" : "error")
      }
    } catch {
      setSubscribeStatus("error")
    }
  }

  const socialPlatforms = [
    { label: en ? "WeChat" : "公众号", platform: "WeChat", href: "https://mp.weixin.qq.com/s/wSbBTSHUgdm0Ayuk601eRw" },
    { label: en ? "Bilibili" : "B站", platform: "Bilibili", href: "https://space.bilibili.com/3745036743215474" },
    { label: en ? "Xiaohongshu" : "小红书", platform: "Xiaohongshu", href: "https://xhslink.cn/m/85xQ3j0HIh4" },
    { label: "Facebook", platform: "Facebook", href: "https://www.facebook.com/share/1baynW2wi6/" },
    { label: "Instagram", platform: "Instagram", href: "https://www.instagram.com/oyscat_official?srtk=MTJjcmYwOWozbDZqeQ==" },
    { label: "Twitter / X", platform: "Twitter / X", href: "https://x.com/Oyscat" },
    { label: "YouTube", platform: "YouTube", href: "https://www.youtube.com/@OyscatOfficial/videos" },
  ]

  return (
    <footer data-slot="introduce-footer" className={`${sectionScaleClass} w-full border-t border-zinc-200 bg-zinc-100 px-5 pt-10 pb-5 sm:px-7 sm:pt-12 sm:pb-6 lg:pt-14 lg:pb-20`}>
      {/* lg:pb-20 keeps the contact column's email (bottom-right from lg) clear of the global feedback button, fixed 68px deep in that corner. */}
      <div className="mx-auto max-w-[calc(1120*var(--u))]">
        <TooltipProvider delay={150}>
          {/* Three groups: brand, contact, subscribe. Stacked on phones as brand, subscribe, contact; from md, brand and contact share the left column; from lg, one column each
              (brand, subscribe, contact), content-sized, with two equal 1fr tracks between them that each hold a centred 1px divider.
              From lg the columns share three subgrid rows so they line up and end together: titles (h-8), controls (icons / Join us / input,
              centred), small print (copyright / email / disclaimer). The copyright fills the brand column's third row there, and is the bottom bar below lg.
              Explicit minmax(0,1fr) tracks: MiSans widens the email input's intrinsic size, which would stretch an auto track past a phone screen. */}
          <div className="grid grid-cols-1 gap-y-8 md:grid-cols-2 md:gap-x-12 md:gap-y-9 lg:grid-cols-[auto_minmax(calc(64*var(--u)),1fr)_calc(400*var(--u))_minmax(calc(64*var(--u)),1fr)_auto] lg:grid-rows-[auto_auto_auto] lg:gap-x-0 lg:gap-y-4">
            <div className="flex flex-col items-start gap-4 max-md:order-1 md:col-start-1 md:row-start-1 md:gap-5 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-4">
              {/* Parent-company endorsement beside the product logo ("from Meta" style). */}
              <div data-reveal className="flex h-8 min-w-0 items-center gap-2.5 sm:gap-4">
                <Image src={oyscatLogo} alt="Oyscat" width={1920} height={1080} unoptimized className="h-5 w-[70px] shrink-0 object-cover sm:h-6 sm:w-[84px]" />
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-zinc-300 sm:h-5" />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href="https://qicore.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={en ? "From QiCore, visit the QiCore website" : "来自 QiCore，访问 QiCore 官网"}
                      />
                    }
                    data-slot="qicore-link"
                    className="group inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-zinc-300 bg-white pr-2 pl-2.5 text-xs whitespace-nowrap sm:h-8 sm:gap-1.5 sm:pr-2.5 sm:pl-3 text-zinc-500 transition-[border-color,color,box-shadow] hover:border-zinc-900 hover:text-zinc-900 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                  >
                    {en ? "from" : "来自"}
                    <Image src="/brand/qicore-wordmark.svg" alt="" width={3439} height={807} unoptimized className="h-3 w-auto sm:h-3.5" />
                    <ArrowUpRight aria-hidden="true" className="size-3 transition-transform sm:size-3.5 group-hover:translate-x-px group-hover:-translate-y-px motion-reduce:transition-none" />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className={introduceFontClass}>
                    {en ? "Visit the QiCore website" : "访问 QiCore 官网"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Pulled left by the icon's inset so the glyphs line up with the logo; no gap under 360px so all seven fit on one row at 320.
                  From lg the right inset is cancelled too, so the column (and its gap) is measured from the last glyph, not its hover box.
                  Below md the row spans the full width (first and last glyph flush with the input's edges), and the vertical inset is cancelled
                  so the space around the glyphs matches the other groups' title-to-content and section gaps. */}
              <ul aria-label={en ? "Social media" : "社交媒体"} className="hidden">
                {socialPlatforms.map(({ label, platform, href }, index) => (
                  <li data-reveal data-reveal-delay={40 + index * 25} key={label}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />
                          ) : (
                            <button type="button" aria-label={`${label} · ${en ? "Coming soon" : "待开放"}`} />
                          )
                        }
                        className="flex size-10 cursor-pointer items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                      >
                        <FooterSocialIcon platform={platform} />
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8} className={introduceFontClass}>
                        {href ? label : `${label} · ${en ? "Coming soon" : "待开放"}`}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal data-reveal-delay="120" className="max-md:order-3 md:col-start-1 md:row-start-2 lg:col-start-5 lg:row-span-3 lg:row-start-1 lg:grid lg:grid-rows-subgrid">
              <h2 className="flex h-8 items-center text-sm font-semibold text-zinc-900">{en ? "Contact" : "联系我们"}</h2>
              {/* Below md, Join us sits flush right, on the same edge as the last social glyph and the subscribe input. */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 max-md:justify-between md:mt-5 lg:contents">
                <a href="mailto:info@qicore.ai" className="inline-flex items-center gap-2 lg:row-start-3 lg:self-start lg:justify-self-start rounded-sm text-sm text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500">
                  <Mail aria-hidden="true" className="size-4" />info@qicore.ai
                </a>
                <a href="https://qicore.ai/careers" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center lg:row-start-2 lg:self-center lg:justify-self-start justify-center gap-1.5 rounded-md bg-zinc-900 px-4 text-sm whitespace-nowrap sm:min-h-10 sm:gap-2 sm:px-5 font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-600">
                  {en ? "Join us" : "加入我们"} <ArrowRight aria-hidden="true" className="size-3.5 sm:size-4" />
                </a>
              </div>
            </div>
            <div data-reveal data-reveal-delay="200" className="max-md:order-2 md:col-start-2 md:row-span-2 md:row-start-1 lg:col-start-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
              <h2 className="flex h-8 items-center text-sm font-semibold text-zinc-900">{en ? "Subscribe to product updates" : "订阅产品动态"}</h2>
              <form onSubmit={handleSubscribe} className="mt-4 md:mt-5 lg:mt-0">
                <label htmlFor="introduce-subscribe-email" className="sr-only">{en ? "Email address" : "邮箱地址"}</label>
                <div className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white py-1.5 pr-1.5 pl-5 transition-colors focus-within:border-zinc-900">
                  <input
                    id="introduce-subscribe-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                  />
                  <button
                    type="submit"
                    disabled={subscribeStatus === "sending"}
                    aria-busy={subscribeStatus === "sending"}
                    aria-label={en ? "Subscribe" : "订阅"}
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </form>
              {/* The status sits outside the form so a submit grows this small-print row, not the controls row the other columns centre on. */}
              <div className="mt-3 lg:mt-0">
                {subscribeStatus === "success" ? (
                  <p role="status" className="mb-1 text-xs font-medium text-emerald-600">
                    {en ? "Thanks — you're on the list." : "已收到，感谢订阅。"}
                  </p>
                ) : subscribeStatus === "rate_limited" || subscribeStatus === "error" ? (
                  <p role="status" className="mb-1 text-xs font-medium text-red-600">
                    {subscribeStatus === "rate_limited"
                      ? en ? "Too many requests — please try again in a minute." : "提交太频繁，请 1 分钟后再试。"
                      : en ? "Couldn't subscribe right now. Please try again later." : "发送失败，请稍后重试。"}
                  </p>
                ) : null}
                <p className="text-xs leading-5 text-zinc-500 max-md:text-pretty">
                  {en ? (
                    "By subscribing you agree to receive product notifications. We will never use or sell your private information."
                  ) : (
                    <>
                      订阅即表示您同意接收产品通知。
                      {/* One sentence per line on phones, so the wrap never strands a two-character orphan. */}
                      <span className="max-md:block">我们绝不会使用或出售您的隐私信息。</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            {/* Left-aligned: below lg this is the bottom bar, and the global feedback button floats over its right end.
                Below md, pr-12 keeps the text out of that button's ~46px footprint, which it would reach under on a 320px screen. */}
            <div data-reveal className="border-t border-zinc-300 pt-5 text-xs leading-5 text-zinc-500 max-md:order-4 max-md:pr-12 md:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-3 lg:border-t-0 lg:pt-0">
              <p>© {new Date().getFullYear()} QiCore Technology. <span className="whitespace-nowrap">All rights reserved.</span></p>
            </div>
            <span aria-hidden="true" data-reveal data-reveal-delay="160" className="hidden w-px bg-zinc-300 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:block lg:justify-self-center" />
            <span aria-hidden="true" data-reveal data-reveal-delay="160" className="hidden w-px bg-zinc-300 lg:col-start-4 lg:row-span-3 lg:row-start-1 lg:block lg:justify-self-center" />
          </div>
        </TooltipProvider>
      </div>
    </footer>
  )
}
