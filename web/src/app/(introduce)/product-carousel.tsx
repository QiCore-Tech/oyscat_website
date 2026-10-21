"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import "./product-carousel.css"

interface ProductCarouselProps {
  children: ReactNode
  label: string
}

interface ScrollMetrics {
  maxScroll: number
  scrollLeft: number
  thumbLeft: number
  thumbWidth: number
}

interface ScrollDrag {
  pointerId: number
  startScrollLeft: number
  startX: number
}

const EMPTY_METRICS: ScrollMetrics = {
  maxScroll: 0,
  scrollLeft: 0,
  thumbLeft: 0,
  thumbWidth: 0,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function ProductCarousel({ children, label }: ProductCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ScrollDrag | null>(null)
  const [metrics, setMetrics] = useState<ScrollMetrics>(EMPTY_METRICS)
  const viewportId = useId()

  const syncScrollbar = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const viewportWidth = viewport.clientWidth
    const scrollWidth = viewport.scrollWidth
    const maxScroll = Math.max(0, scrollWidth - viewportWidth)
    const thumbWidth = scrollWidth > 0
      ? Math.min(viewportWidth, Math.max(36, (viewportWidth * viewportWidth) / scrollWidth))
      : viewportWidth
    const thumbLeft = maxScroll > 0
      ? (viewport.scrollLeft / maxScroll) * Math.max(0, viewportWidth - thumbWidth)
      : 0

    setMetrics((previous) => {
      if (
        Math.abs(previous.maxScroll - maxScroll) < 0.5
        && Math.abs(previous.scrollLeft - viewport.scrollLeft) < 0.5
        && Math.abs(previous.thumbLeft - thumbLeft) < 0.5
        && Math.abs(previous.thumbWidth - thumbWidth) < 0.5
      ) return previous
      return { maxScroll, scrollLeft: viewport.scrollLeft, thumbLeft, thumbWidth }
    })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    let frame = 0
    const scheduleSync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncScrollbar)
    }

    syncScrollbar()
    const resizeObserver = new ResizeObserver(scheduleSync)
    resizeObserver.observe(viewport)
    viewport.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      viewport.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
    }
  }, [syncScrollbar])

  const onScrollbarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const scrollbar = scrollbarRef.current
    if (!viewport || !scrollbar || metrics.maxScroll <= 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const trackRect = scrollbar.getBoundingClientRect()
    const thumb = event.currentTarget.querySelector<HTMLElement>("[data-carousel-thumb]")
    const isThumb = thumb?.contains(event.target as Node)

    if (!isThumb) {
      const thumbTravel = Math.max(1, trackRect.width - metrics.thumbWidth)
      const targetLeft = clamp(event.clientX - trackRect.left - metrics.thumbWidth / 2, 0, thumbTravel)
      viewport.scrollLeft = (targetLeft / thumbTravel) * metrics.maxScroll
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startScrollLeft: viewport.scrollLeft,
      startX: event.clientX,
    }
  }

  const onScrollbarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const viewport = viewportRef.current
    const scrollbar = scrollbarRef.current
    if (!drag || drag.pointerId !== event.pointerId || !viewport || !scrollbar) return

    const thumbTravel = Math.max(1, scrollbar.clientWidth - metrics.thumbWidth)
    const scrollPerPixel = metrics.maxScroll / thumbTravel
    viewport.scrollLeft = clamp(
      drag.startScrollLeft + (event.clientX - drag.startX) * scrollPerPixel,
      0,
      metrics.maxScroll,
    )
  }

  const onScrollbarPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onScrollbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || metrics.maxScroll <= 0) return

    const page = viewport.clientWidth * 0.85
    let next: number | undefined
    if (event.key === "ArrowLeft") next = viewport.scrollLeft - page
    if (event.key === "ArrowRight") next = viewport.scrollLeft + page
    if (event.key === "Home") next = 0
    if (event.key === "End") next = metrics.maxScroll
    if (next === undefined) return

    event.preventDefault()
    viewport.scrollTo({ left: clamp(next, 0, metrics.maxScroll), behavior: "smooth" })
  }

  const percent = metrics.maxScroll > 0
    ? Math.round((metrics.scrollLeft / metrics.maxScroll) * 100)
    : 0

  return (
    <div className="relative mx-auto w-full max-w-[calc(430*var(--u))] lg:max-w-[calc(1120*var(--u))]">
      <div
        ref={viewportRef}
        id={viewportId}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="introduce-product-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain rounded-[calc(16*var(--u))] outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 sm:gap-[calc(32*var(--u))] lg:justify-center lg:overflow-visible"
      >
        {children}
      </div>
      {metrics.maxScroll > 0 && (
        <div
          ref={scrollbarRef}
          role="scrollbar"
          aria-controls={viewportId}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-orientation="horizontal"
          tabIndex={0}
          className="group relative mt-3 hidden h-4 w-full cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 lg:block"
          onKeyDown={onScrollbarKeyDown}
          onPointerDown={onScrollbarPointerDown}
          onPointerMove={onScrollbarPointerMove}
          onPointerUp={onScrollbarPointerEnd}
          onPointerCancel={onScrollbarPointerEnd}
          onLostPointerCapture={onScrollbarPointerEnd}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200" />
          <div
            data-carousel-thumb
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-400 transition-colors group-hover:bg-zinc-500"
            style={{ left: `${metrics.thumbLeft}px`, width: `${metrics.thumbWidth}px` }}
          />
        </div>
      )}
    </div>
  )
}
