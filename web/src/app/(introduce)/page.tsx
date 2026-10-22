"use client"

import { WorkflowShowcase } from "./workflow-showcase"
import { ProductCarousel } from "./product-carousel"
import { QiCoreHero } from "./qicore-hero/qicore-hero"
import { FlipCard } from "./flip-card"
import { IntroduceFooter } from "./introduce-footer"
import { INTRODUCE_FAQ } from "./faq-content"
import { introduceFontClass, sectionScaleClass } from "./introduce-theme"
import workspacePreview from "./images/5.png"
import moduleLibraryPreview from "./images/6.png"
import communityPreview from "./images/9.png"
import oyscatLogo from "./images/oyscat.svg"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Box, Cable, Check, ChevronDown, Cpu, Play, Pointer, Rotate3d } from "lucide-react"
import { Accordion } from "@base-ui/react/accordion"
import { InterfaceLanguageSwitcher } from "@/components/chrome/interface-language-switcher"
import { LANGUAGE_SWITCHER_ENABLED } from "@/lib/site"

const CARD_PREVIEWS = [workspacePreview, moduleLibraryPreview, communityPreview]
const CARD_ACCENTS = [
  { bar: "bg-emerald-500", icon: "text-emerald-500" },
  { bar: "bg-cyan-500", icon: "text-cyan-500" },
  { bar: "bg-lime-500", icon: "text-lime-600" },
]
// English copy runs about twice as long as the Chinese, so its card backs use tighter type to fit the fixed card height.
const CARD_BACK_TYPE = {
  en: {
    face: "p-5 sm:p-6",
    title: "mt-3 text-lg leading-tight sm:mt-4 sm:text-xl",
    list: "mt-3 gap-1.5 sm:mt-4 sm:gap-2.5",
    item: "gap-2 text-[length:calc(12*var(--u))] leading-[1.4] sm:text-[length:calc(13*var(--u))] sm:leading-normal",
    icon: "mt-[calc(1.5*var(--u))] size-3.5 sm:mt-0.75",
  },
  "zh-CN": {
    face: "p-7 sm:p-8",
    title: "mt-5 text-2xl",
    list: "mt-6 gap-4",
    item: "gap-3 text-[length:calc(15*var(--u))] leading-relaxed",
    icon: "mt-1 size-4",
  },
}

function useViewportAnimations(pageRef: { current: HTMLDivElement | null }, locale: string) {
  useEffect(() => {
    const page = pageRef.current
    if (!page || !("IntersectionObserver" in window)) return
    const elements = new Set<HTMLElement>()
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
    const originalTransitions = new Map<HTMLElement, string>()
    let observer: IntersectionObserver | undefined

    const clearTimer = (element: HTMLElement) => {
      clearTimeout(timers.get(element))
      timers.delete(element)
    }
    const show = (element: HTMLElement) => {
      clearTimer(element)
      element.style.transition = originalTransitions.get(element) ?? ""
      element.style.opacity = "1"
      element.style.translate = "0 0"
      element.dataset.revealState = "visible"
    }
    const reset = (element: HTMLElement) => {
      clearTimer(element)
      element.style.transition = "none"
      element.style.opacity = "0"
      element.style.translate = `0 ${element.dataset.revealDistance ?? "20"}px`
      element.dataset.revealState = "hidden"
    }
    const configure = () => {
      observer?.disconnect()
      elements.forEach(show)
      if (preference.matches) return
      elements.forEach(reset)
      observer = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
          const element = target as HTMLElement
          if (!elements.has(element) || !page.contains(element)) return
          if (!isIntersecting) {
            if (!element.contains(document.activeElement)) reset(element)
            return
          }
          const threshold = Number(element.dataset.revealThreshold ?? 0.08)
          if (intersectionRatio < threshold || element.dataset.revealState !== "hidden") return
          element.dataset.revealState = "entering"
          const delay = Number(element.dataset.revealDelay ?? 0)
          // Commit the hidden pose before transitioning; no cancellable animation promises.
          void element.offsetWidth
          const transition = `650ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
          const original = originalTransitions.get(element)
          element.style.transition = `${original ? `${original}, ` : ""}opacity ${transition}, translate ${transition}`
          element.style.opacity = "1"
          element.style.translate = "0 0"
          timers.set(element, setTimeout(() => show(element), 650 + delay))
        })
      }, { threshold: [0, 0.08, 0.2], rootMargin: "0px 0px -24px 0px" })
      elements.forEach((element) => observer?.observe(element))
    }
    // Keep keyboard-focused controls visible even before their entry animation.
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      elements.forEach((element) => {
        if (element.contains(event.target as Element)) show(element)
      })
    }
    configure()
    const register = (root: Element) => {
      const candidates = [
        ...(root.matches("[data-reveal]") ? [root] : []),
        ...root.querySelectorAll("[data-reveal]"),
      ]
      candidates.forEach((candidate) => {
        if (!(candidate instanceof HTMLElement) || elements.has(candidate)) return
        elements.add(candidate)
        originalTransitions.set(candidate, candidate.style.transition)
        if (preference.matches) {
          show(candidate)
        } else {
          reset(candidate)
          observer?.observe(candidate)
        }
      })
    }
    register(page)
    // React can replace card nodes during updates; register the new DOM, not just the initial render.
    const mutations = new MutationObserver((records) => {
      elements.forEach((element) => {
        if (page.contains(element)) return
        observer?.unobserve(element)
        show(element)
        elements.delete(element)
        originalTransitions.delete(element)
      })
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element && page.contains(node)) register(node)
        })
      })
    })
    mutations.observe(page, { childList: true, subtree: true })
    preference.addEventListener("change", configure)
    page.addEventListener("focusin", onFocus)
    return () => {
      observer?.disconnect()
      mutations.disconnect()
      preference.removeEventListener("change", configure)
      page.removeEventListener("focusin", onFocus)
      elements.forEach(show)
    }
  }, [pageRef, locale])
}

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true })
  return () => window.removeEventListener("scroll", onChange)
}

function getScrollSnapshot() {
  return window.scrollY > 0
}

function getServerScrollSnapshot() {
  return false
}

function IntroduceFaq() {
  const locale = useLocale() === "en" ? "en" : "zh-CN"
  return (
    <section aria-labelledby="faq-title" data-slot="faq" className="w-full bg-[#f7f8f8] px-5 py-16 sm:px-7 sm:py-24">
      <div data-slot="faq-container" className="mx-auto grid max-w-[calc(1120*var(--u))] grid-cols-1 gap-8 sm:gap-10">
        <div className="text-center">
          <h2 data-reveal id="faq-title" className="text-[length:calc(22*var(--u))] leading-[1.4] font-semibold text-balance sm:text-[length:calc(30*var(--u))]">
            {locale === "en" ? "About Oyscat" : "关于 Oyscat"}
          </h2>
          <p data-reveal data-reveal-delay="80" className="mt-4 text-sm leading-7 text-zinc-500 sm:text-base">
            {locale === "en" ? "From your first idea to your next creation." : "从第一个想法，到下一次造物。"}
          </p>
        </div>
        <Accordion.Root defaultValue={[]} className="min-w-0 border-t border-zinc-200" data-slot="faq-list">
          {INTRODUCE_FAQ[locale].map((item, index) => (
            <Accordion.Item data-reveal data-reveal-delay={index * 50} key={item.id} value={item.id} className="border-b border-zinc-200" data-slot="faq-item">
              <Accordion.Header>
                <Accordion.Trigger data-slot="faq-question" className="group flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-base leading-7 font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 sm:py-6 sm:text-lg">
                  <span className="min-w-0 break-words">{item.question}</span>
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition-transform duration-300 group-data-panel-open:rotate-180 motion-reduce:transition-none" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel data-slot="faq-answer" className="h-(--accordion-panel-height) overflow-hidden opacity-100 transition-[height,opacity] duration-300 ease-out data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 motion-reduce:transition-none">
                <div className="space-y-4 pb-6 pr-3 text-sm leading-7 text-zinc-600 sm:pr-8 sm:text-[length:calc(15*var(--u))]">
                  {item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  )
}

export default function IntroducePage() {
  const t = useTranslations("introduce")
  const locale = useLocale()
  const router = useRouter()
  const pageRef = useRef<HTMLDivElement>(null)
  useViewportAnimations(pageRef, locale)
  const scrolled = useSyncExternalStore(subscribeToScroll, getScrollSnapshot, getServerScrollSnapshot)
  const backType = CARD_BACK_TYPE[locale === "en" ? "en" : "zh-CN"]
  const product = locale === "en"
    ? {
        title: "From screen to reality, bring creations to life with ease",
        cards: [
          {
            title: "Oyscat Workspace",
            paragraphs: [
              "AI auto-modeling: describe your idea in one sentence and generate the creation model you want.",
              "Manual modeling: intuitive drag-and-drop and building-block assembly give you the freedom to create.",
              "All-in-one workspace: automatically write control programs and simulate in real time, closing the loop before you assemble the physical build.",
            ],
            imageLabel: "Oyscat Workspace image placeholder",
          },
          {
            title: "Oyscat Electronic Modules",
            paragraphs: [
              "Plug-and-play module library: actuators, lights, displays and power - combine freely with no barriers.",
              "In-house microkernel: ultra-low-latency coordination, programs that can be rewritten repeatedly, and modules that drop straight into your next creation.",
              "Auto-recognition and pairing: modules are discovered on connection - just rotate or flash them to pair.",
            ],
            imageLabel: "Oyscat Electronic Modules image placeholder",
          },
          {
            title: "Oyscat Creation Community",
            paragraphs: [
              "Share your ideas and meet more people who love to create.",
              "More than sharing inspiration, order with a single tap and bring your favorite creations home.",
            ],
            imageLabel: "Oyscat Creation Community image placeholder",
          },
        ],
      }
    : {
        title: "从屏幕到现实，轻松完成造物",
        cards: [
          {
            title: "Oyscat 工作台",
            paragraphs: [
              "AI 自动建模：一句话生成你想要的造物模型",
              "手动建模：直观的拖拽与积木式拼搭，赋予用户自由造物体验",
              "一站式工作台：自动编写控制程序并实时仿真，实现组装实物前的全流程闭环验证",
            ],
            imageLabel: "Oyscat 工作台静态图占位",
          },
          {
            title: "Oyscat 电子模块",
            paragraphs: [
              "即插即用的模块库：覆盖动作、灯光、显示与供电，自由组合无门槛",
              "自研微内核：实现超低延时协同，程序支持反复擦写，拆下的模块可随时拼进下一个造物",
              "自动识别绑定：连接后自动发现模块，转动或闪灯即可完成配对",
            ],
            imageLabel: "Oyscat 电子模块静态图占位",
          },
          {
            title: "Oyscat 造物社区",
            paragraphs: [
              "分享你的奇思妙想，遇见更多热爱造物的人",
              "不止分享灵感，更能一键下单，把喜欢的创意直接带回家",
            ],
            imageLabel: "Oyscat 造物社区静态图占位",
          },
        ],
      }

  return (
    <div ref={pageRef} className={`${introduceFontClass} min-h-screen bg-white text-zinc-900 tracking-normal [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-ok [&_a:focus-visible]:outline-offset-5`}>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none ${
          scrolled
            ? "bg-white/85 backdrop-blur-md shadow-[0_1px_10px_rgba(0,0,0,0.06)] border-b border-zinc-200/50"
            : "bg-transparent"
        }`}
      >
        <div data-reveal data-reveal-distance="0" className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-5 px-5 py-2 sm:px-7 [&_a]:inline-flex [&_a]:items-center [&_a]:justify-center [&_a]:gap-2 [&_a:hover]:text-ok">
          <Link href="/" aria-label={t("homeLabel")}>
            <Image src={oyscatLogo} alt="Oyscat" priority unoptimized className="h-7 w-[100px] object-cover" />
          </Link>
          {/* Refresh in place: a reload would replay the hero's vehicle build. */}
          {LANGUAGE_SWITCHER_ENABLED && <InterfaceLanguageSwitcher variant="inline" onLocaleChange={() => router.refresh()} />}
        </div>
      </header>

      <main id="main-content">
        <QiCoreHero atTop={!scrolled} />

        <div className={sectionScaleClass}>
          {/* Every viewport uses the same one-screen horizontal product stage. */}
          <section className="flex min-h-svh w-full flex-col justify-center bg-[#f7f8f8] px-5 py-12 sm:px-7 sm:py-16 xl:py-24" aria-labelledby="overview-title">
            <div className="mx-auto w-full max-w-[calc(1120*var(--u))]">
              <h2 data-reveal id="overview-title" className="text-center text-[length:calc(22*var(--u))] leading-[1.5] font-semibold text-balance sm:text-[length:calc(30*var(--u))]">
                {product.title}
              </h2>
              <div data-reveal data-reveal-delay="80" className="mt-8 sm:mt-12">
                <ProductCarousel
                  label={locale === "en" ? "Oyscat product cards" : "Oyscat 产品卡片"}
                >
                  {product.cards.map((card, index) => (
                    <div
                      key={card.title}
                      className="aspect-[370/480] w-[calc(100%-4rem)] shrink-0 snap-start sm:w-[calc(370*var(--u))] lg:w-auto lg:min-w-0 lg:max-w-[calc(370*var(--u))] lg:flex-1"
                    >
                      <FlipCard
                        ariaLabel={card.title}
                        width="100%"
                        height="100%"
                        radius="calc(16 * var(--u))"
                        hoverScale={1.02}
                        tiltMax={8}
                        glareOpacity={0.3}
                        glareColor="color-mix(in srgb, #B1F33F 40%, white)"
                        background="#ffffff"
                        color="#18181b"
                        shadowOpacity={0.22}
                        flipOnHover
                        className="introduce-product-card"
                        front={
                          <>
                            <Image
                              src={CARD_PREVIEWS[index]}
                              alt={card.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 480px"
                              className="object-cover"
                              priority
                            />
                            {/* Light veil so the product photo stays bright; the title carries its own soft shadow for contrast instead. */}
                            <div className="pointer-events-none absolute inset-0 bg-black/15" />
                            <div className="absolute inset-x-0 top-0 flex justify-center px-5 pt-12 sm:px-6 sm:pt-16">
                              <h3
                                className="text-center text-2xl font-bold tracking-tight text-balance text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35),0_0_16px_rgba(0,0,0,0.28)]"
                              >
                                {card.title}
                              </h3>
                            </div>
                            {/* Desktop cue; hidden on mobile in product-carousel.css. */}
                            <span aria-hidden="true" className="flip-card__hint absolute bottom-5 left-1/2 -translate-x-1/2 text-xs">
                              <Rotate3d className="flip-card__hint-icon" />
                              <span className="flip-card__hint-gesture">
                                <span className="flip-card__hint-trail" />
                                <Pointer className="flip-card__hint-hand" />
                              </span>
                            </span>
                          </>
                        }
                        back={
                          <div className={`flex h-full flex-col border border-zinc-200 rounded-[inherit] ${backType.face}`}>
                            <span className={`h-1 w-10 shrink-0 rounded-full ${CARD_ACCENTS[index].bar}`} />
                            <h3 className={`${backType.title} font-bold tracking-tight text-zinc-900`}>{card.title}</h3>
                            <ul className={`${backType.list} flex flex-col`}>
                              {card.paragraphs.map((paragraph) => (
                                <li key={paragraph} className={`flex ${backType.item} text-zinc-600`}>
                                  <Check aria-hidden="true" className={`${backType.icon} shrink-0 ${CARD_ACCENTS[index].icon}`} />
                                  <span>{paragraph}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        }
                      />
                    </div>
                  ))}
                </ProductCarousel>
              </div>
            </div>
          </section>
          <WorkflowShowcase />
          <IntroduceFaq />
        </div>
      </main>
      <IntroduceFooter />
    </div>
  )
}
