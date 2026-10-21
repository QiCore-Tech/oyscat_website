"use client"

import { useEffect, useRef, type ReactNode } from "react"
import Image, { type StaticImageData } from "next/image"
import { useLocale } from "next-intl"
import buildAnimation from "./images/v2/1.gif"
import codeAnimationZh from "./images/v2/2-ch.gif"
import codeAnimationEn from "./images/v2/2-en.gif"
import simulateAnimation from "./images/v2/3.gif"
import assembleAnimation from "./images/v2/4.gif"

interface WorkflowCardData {
  id: string
  title: string
  subtitle: ReactNode
}

type Locale = "zh-CN" | "en"

const WORKFLOW_CARDS: Record<Locale, WorkflowCardData[]> = {
  "zh-CN": [
    {
      id: "build",
      title: "拼搭",
      subtitle: <>AI自动建模，或手动拼搭<br />不同模块自由组合</>,
    },
    {
      id: "code",
      title: "编程",
      subtitle: <>用自然语言描述期待的动作<br />AI 自动转化控制逻辑</>,
    },
    {
      id: "simulate",
      title: "仿真",
      subtitle: <>在虚拟环境中验证动作与响应<br />让反复试错留在屏幕里</>,
    },
    {
      id: "assemble",
      title: "装配",
      subtitle: <>将验证好的构想带到手中<br />按步骤轻松装配成真</>,
    },
  ],
  en: [
    {
      id: "build",
      title: "Build",
      subtitle: "AI auto-modeling or manual assembly, combining modules freely",
    },
    {
      id: "code",
      title: "Code",
      subtitle: "Describe actions in natural language, AI generates control logic",
    },
    {
      id: "simulate",
      title: "Simulate",
      subtitle: "Validate motion and responses virtually before physical assembly",
    },
    {
      id: "assemble",
      title: "Assemble",
      subtitle: "Bring validated designs to your hands and assemble with ease",
    },
  ],
}

// Cards that show a photo; it covers the card at every size.
// `tone` is how bright the media is behind the copy: dark media gets a black scrim and white text,
// light media keeps dark text with a white halo around the glyphs instead of a veil over the picture.
// `src` is a per-locale map when the media itself shows text in the interface language.
const CARD_MEDIA: Partial<Record<string, { src: StaticImageData | Record<Locale, StaticImageData>; tone: "light" | "dark" }>> = {
  build: { src: buildAnimation, tone: "light" },
  code: { src: { "zh-CN": codeAnimationZh, en: codeAnimationEn }, tone: "light" },
  simulate: { src: simulateAnimation, tone: "light" },
  assemble: { src: assembleAnimation, tone: "dark" },
}
const LIGHT_MEDIA_TEXT_HALO = "[text-shadow:0_0_4px_rgba(255,255,255,0.9),0_0_14px_rgba(255,255,255,0.9)]"

const HOLD_START = 0.04
const HOLD_END = 0.12

export function WorkflowShowcase() {
  const rawLocale = useLocale()
  const locale = rawLocale === "en" ? "en" : "zh-CN"
  const cards = WORKFLOW_CARDS[locale]

  const containerRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    if (!container || !track) return

    let currentProgress = 0
    let targetProgress = 0
    let rafId: number
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const updateTransforms = (progress: number) => {
      const viewportWidth = window.innerWidth
      const firstCard = cardRefs.current[0]
      if (!firstCard) return

      const cardWidth = firstCard.offsetWidth
      const computedGap = parseFloat(window.getComputedStyle(track).gap) || 28
      const stepDistance = cardWidth + computedGap

      // Start position: first card centered in viewport
      const startX = viewportWidth / 2 - cardWidth / 2
      // End position: last card centered in viewport
      const totalTravelX = (cards.length - 1) * stepDistance
      const currentTrackX = startX - progress * totalTravelX

      // Move track smoothly
      track.style.transform = `translate3d(${currentTrackX}px, 0, 0)`

      // Calculate optical depth hierarchy based on distance from center
      const viewportCenter = viewportWidth / 2

      cardRefs.current.forEach((cardEl, i) => {
        if (!cardEl) return
        const cardCenter = currentTrackX + i * stepDistance + cardWidth / 2
        const distFromCenter = Math.abs(cardCenter - viewportCenter)
        const normDist = distFromCenter / stepDistance

        // Center card scales to 1.02; sides scale down to ~0.91
        const scale = prefersReducedMotion ? 1 : 1.02 - Math.min(1.2, normDist) * 0.11
        // Side cards stay fully opaque: fading them over the light page veils the photos.
        cardEl.style.transform = `scale(${scale})`

        // Subtle glow & elevated shadow on centered card
        const glowOpacity = Math.max(0, 1 - normDist * 1.2)
        const glowEl = cardEl.querySelector<HTMLElement>("[data-card-glow]")
        if (glowEl) {
          glowEl.style.opacity = `${glowOpacity}`
        }
      })
    }

    const onScrollOrResize = () => {
      const rect = container.getBoundingClientRect()
      const travel = container.offsetHeight - window.innerHeight
      if (travel <= 0) {
        targetProgress = 0
      } else {
        const raw = Math.max(0, Math.min(1, -rect.top / travel))
        if (raw <= HOLD_START) {
          targetProgress = 0
        } else if (raw >= 1 - HOLD_END) {
          targetProgress = 1
        } else {
          targetProgress = (raw - HOLD_START) / (1 - HOLD_START - HOLD_END)
        }
      }
    }

    // Animation loop with Apple-style smooth damping / inertia
    const tick = () => {
      onScrollOrResize()
      if (prefersReducedMotion) {
        currentProgress = targetProgress
      } else {
        const diff = targetProgress - currentProgress
        if (Math.abs(diff) > 0.0001) {
          currentProgress += diff * 0.09
        } else {
          currentProgress = targetProgress
        }
      }

      updateTransforms(currentProgress)
      rafId = requestAnimationFrame(tick)
    }

    onScrollOrResize()
    currentProgress = targetProgress
    updateTransforms(currentProgress)
    rafId = requestAnimationFrame(tick)

    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [cards.length])

  return (
    <section
      ref={containerRef}
      aria-label={locale === "en" ? "Creation Workflow" : "造物工作流"}
      className="relative h-[400vh] w-full bg-[#f2f4f4] text-zinc-900 transition-colors duration-300"
    >
      <div
        ref={stickyRef}
        className="sticky top-0 flex h-screen w-full flex-col justify-center overflow-hidden px-0 sm:px-8 py-6 sm:py-12 select-none"
      >
        {/* Section Header: Minimalist Title Only */}
        <div className="relative z-10 mx-auto mb-4 sm:mb-8 flex w-full max-w-[1240px] flex-col items-center text-center">
          <h2 className="text-[length:calc(22*var(--u))] font-bold tracking-tight text-zinc-900 sm:text-[length:calc(30*var(--u))]">
            {locale === "en" ? "One Idea. Four Steps to Reality." : "一个想法，四步走向现实"}
          </h2>
        </div>

        {/* Horizontal Cards Stage */}
        <div className="relative z-10 flex items-center justify-start overflow-visible py-3 sm:py-6">
          <div
            ref={trackRef}
            className="flex items-center gap-4 sm:gap-8 will-change-transform"
            style={{ transform: "translate3d(0, 0, 0)" }}
          >
            {cards.map((card, index) => {
              const media = CARD_MEDIA[card.id]
              const mediaSrc = media && ("src" in media.src ? media.src : media.src[locale])
              const darkMedia = media?.tone === "dark"
              return (
                <div
                  key={card.id}
                  ref={(el) => {
                    cardRefs.current[index] = el
                  }}
                  className="group relative flex shrink-0 flex-col justify-end items-center overflow-hidden rounded-[24px] sm:rounded-[calc(30*var(--u))] border border-white/70 bg-white p-5 sm:p-8 pb-6 sm:pb-11 shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-[transform,opacity] duration-150 will-change-transform w-[70vw] min-w-[250px] max-w-[300px] sm:w-[30vw] sm:min-w-[calc(330*var(--u))] sm:max-w-[420px] lg:max-w-[calc(380*var(--u))] h-[430px] sm:h-[500px] lg:h-[min(calc(620*var(--u)),70vh)]"
                >
                  {mediaSrc && (
                    <>
                      {/* Animated GIFs are served as-is. */}
                      <Image
                        src={mediaSrc}
                        alt=""
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 420px, 300px"
                        className="pointer-events-none object-cover"
                      />
                      {darkMedia && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
                        />
                      )}
                    </>
                  )}

                  {/* Subtle glossy border & ambient lighting */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]"
                  />

                  {/* Dynamic active ambient glow for central card */}
                  <div
                    data-card-glow
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 shadow-[0_22px_55px_rgba(147,197,253,0.45)]"
                    style={{ opacity: 0 }}
                  />

                  {/* Text Content: Bottom positioned & horizontally centered, directly over gradient */}
                  <div className="relative z-10 flex w-full flex-col items-center text-center px-2">
                    {/* 主标题 (Main Title, Horizontally Centered) */}
                    <h3 className={`text-2xl font-bold tracking-tight sm:text-4xl text-center ${darkMedia ? "text-white" : "text-zinc-900"}`}>
                      {card.title}
                    </h3>

                    {/* 副标题 (Subtitle, Horizontally Centered; wraps into balanced lines when the card is too narrow).
                        The Chinese copy breaks at its clause comma instead: balancing split words (动/作, 响/应) and kept the lines narrow. */}
                    <p className={`mt-2 sm:mt-3.5 w-full text-[10px] min-[380px]:text-[11px] sm:text-sm text-center text-balance leading-normal font-normal px-1 ${darkMedia ? "text-white/85" : media ? `text-zinc-800 ${LIGHT_MEDIA_TEXT_HALO}` : "text-zinc-700/90"}`}>
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
