"use client";

import { useEffect, useRef } from "react";
import localFont from "next/font/local";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKSPACE_ACCESS_FORM_URL } from "@/lib/site";
import { HomeCanvasScene } from "./components/home-canvas-scene";
import { HomePromptOverlay } from "./components/home-prompt-overlay";
import styles from "./components/home-voxel-canvas.module.css";
import { CANVAS_COLUMNS, CANVAS_ROWS } from "./lib/home-vehicle-assembly";
import { mountVoxelStore } from "./voxel-store";

// Alibaba PuHuiTi, subset to the hero copy only.
const heroFont = localFont({
  src: [
    { path: "./fonts/alibaba-puhuiti-hero-400.woff", weight: "400" },
    { path: "./fonts/alibaba-puhuiti-hero-500.woff", weight: "500" },
    { path: "./fonts/alibaba-puhuiti-hero-800.woff", weight: "800" },
  ],
  variable: "--font-qicore-hero",
  display: "swap",
  adjustFontFallback: false,
});

export function QiCoreHero({ atTop }: { atTop: boolean }) {
  const t = useTranslations("introduce.qicoreHero");
  const lang = useLocale() === "en" ? "en" : "zh";
  const rootRef = useRef<HTMLElement>(null);
  const title = t("title");
  // Narrow screens break the title after its first clause and drop that comma (see the CSS).
  const titleComma = title.match(/[，,]\s*/);

  // Mounted after the scene's effects, so its listeners see the first events.
  useEffect(() => mountVoxelStore(rootRef.current!), []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="qicore-hero-title"
      data-home-voxel
      data-assembly-gate="locked"
      data-canvas-columns={CANVAS_COLUMNS}
      data-canvas-rows={CANVAS_ROWS}
      data-driver-side={lang === "en" ? "right" : "left"}
      className={`${styles.canvas} ${heroFont.variable}`}
    >
      <div className={styles.heroLayout}>
        <div data-home-voxel-scene className={styles.scenePane}>
          <div data-home-grid-placeholder aria-hidden="true" className={styles.gridPlaceholder} />
          <HomeCanvasScene />
        </div>
        <div data-home-vehicle-frame aria-hidden="true" className={styles.vehicleFrame} />
        <HomePromptOverlay atTop={atTop} />
        <div data-home-hero-copy className={styles.copyPane}>
          <div className={styles.copyContent}>
            <h1 id="qicore-hero-title" className={styles.heroTitle}>
              <span data-lang={lang}>
                {titleComma?.index === undefined ? title : (
                  <>
                    {title.slice(0, titleComma.index)}
                    <span className={styles.heroTitleComma}>{titleComma[0]}</span>
                    <span className={styles.heroTitleTail}>{title.slice(titleComma.index + titleComma[0].length)}</span>
                  </>
                )}
              </span>
            </h1>
            <p data-lang={lang} className={styles.heroSubtitle}>
              {t("subtitle")}
            </p>
            <Button
              nativeButton={false}
              render={<a href={WORKSPACE_ACCESS_FORM_URL} target="_blank" rel="noopener noreferrer" />}
              variant="outline"
              className={styles.heroButton}
            >
              <span data-lang={lang}>{t("enterWorkspace")}</span>
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
