"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import PromptBar from "./prompt-bar";
import { Alert, AlertTitle } from "./alert";
import { getMorphFrame, PROMPT_MORPH_DURATION, type MorphRect } from "../lib/home-prompt-morph";
import styles from "./home-voxel-canvas.module.css";

type Phase = "typing" | "morphing" | "sent" | "starting" | "building" | "driving" | "done";

// Stage lengths in ms once the alert has formed: the reply stays up to be
// read, then the start notice fades in and blinks twice (see the CSS), and only then
// does the build begin, shortly before the alert leaves.
const ALERT_STAGES = { read: 1500, start: 220 + 2 * 420, linger: 600, leave: 350 };
const DRIVE_HINT_STAGES = { read: 3000, leave: 350 };

// The scripted prompt only plays while the page sits at its very top. Leaving the top unmounts the
// sequence, cancelling its typing, morph and alert; coming back plays it again from the start,
// unless it had already released the build.
export function HomePromptOverlay({ atTop }: { atTop: boolean }) {
  const [run, setRun] = useState<"armed" | "released" | "spent">("armed");
  const release = useCallback(() => setRun("released"), []);
  if (!atTop && run === "released") setRun("spent");
  if (!atTop || run === "spent") return null;
  return <PromptSequence onRelease={release} />;
}

function PromptSequence({ onRelease }: { onRelease: () => void }) {
  const t = useTranslations("introduce.qicoreHero.prompt");
  const rootRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const morphRef = useRef<HTMLDivElement>(null);
  const fieldRect = useRef<MorphRect | null>(null);
  const [phase, setPhase] = useState<Phase>("typing");
  const [alertLeaving, setAlertLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const showAlert = useCallback(() => {
    setPhase("sent");
    const { read, start, linger, leave } = ALERT_STAGES;
    const later = (delay: number, run: () => void) => timers.current.push(window.setTimeout(run, delay));
    later(read, () => setPhase("starting"));
    later(read + start, () => {
      const root = rootRef.current?.closest<HTMLElement>("[data-home-voxel]");
      if (root) delete root.dataset.assemblyGate;
      onRelease();
    });
    later(read + start + linger, () => setAlertLeaving(true));
    later(read + start + linger + leave, () => {
      setAlertLeaving(false);
      setPhase("building");
    });
  }, [onRelease]);

  // The driving hint is only truthful once the 3D assembly controller reports
  // that every part has landed.
  useEffect(() => {
    if (phase !== "building") return undefined;
    const root = rootRef.current?.closest<HTMLElement>("[data-home-voxel]");
    if (!root) return undefined;
    let shown = false;
    const showDriveHint = () => {
      if (shown || root.dataset.assemblyStatus !== "complete") return;
      shown = true;
      setAlertLeaving(false);
      setPhase("driving");
      timers.current.push(window.setTimeout(() => setAlertLeaving(true), DRIVE_HINT_STAGES.read));
      timers.current.push(window.setTimeout(() => setPhase("done"), DRIVE_HINT_STAGES.read + DRIVE_HINT_STAGES.leave));
    };
    const observer = new MutationObserver(showDriveHint);
    observer.observe(root, { attributes: true, attributeFilter: ["data-assembly-status"] });
    showDriveHint();
    return () => observer.disconnect();
  }, [phase]);

  const handleSent = useCallback(() => {
    fieldRect.current = rootRef.current?.querySelector<HTMLElement>("[data-prompt-field]")?.getBoundingClientRect() ?? null;
    if (!fieldRect.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) showAlert();
    else setPhase("morphing");
  }, [showAlert]);

  // The prompt field collapses into a two-tone capsule that flies along a
  // Bézier arc to the alert and widens into it; the alert stays hidden until
  // it is formed.
  useLayoutEffect(() => {
    if (phase !== "morphing") return undefined;
    const from = fieldRect.current;
    const morph = morphRef.current;
    const target = alertRef.current?.querySelector<HTMLElement>("[data-slot='alert']");
    if (!from || !morph || !target) {
      showAlert();
      return undefined;
    }
    const to = target.getBoundingClientRect();
    const paint = (elapsed: number) => {
      const frame = getMorphFrame(from, to, elapsed);
      morph.style.width = `${frame.width}px`;
      morph.style.height = `${frame.height}px`;
      morph.style.borderRadius = `${frame.radius}px`;
      morph.style.setProperty("--capsule-tint", String(frame.tint));
      // Bank the capsule, then stretch it along the flight direction in screen space.
      morph.style.transform = `translate3d(${frame.x - frame.width / 2}px, ${frame.y - frame.height / 2}px, 0) rotate(${frame.heading}rad) scale(${frame.stretch}, ${1 / frame.stretch}) rotate(${frame.tilt - frame.heading}rad)`;
    };
    // Paint the first frame before the browser does, so the capsule never flashes at the origin.
    paint(0);
    const controls = animate(0, PROMPT_MORPH_DURATION, {
      duration: PROMPT_MORPH_DURATION / 1000,
      ease: "linear",
      onUpdate: paint,
      onComplete: showAlert,
    });
    return () => controls.stop();
  }, [phase, showAlert]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div ref={rootRef} className={styles.promptOverlay} data-home-prompt data-phase={phase}>
      {phase !== "typing" && phase !== "building" && (
        <div
          ref={alertRef}
          className={`${styles.promptAlert}${phase === "driving" ? " max-md:hidden" : ""}`}
          data-prompt-bar=""
          data-leaving={alertLeaving ? "" : undefined}
        >
          <Alert>
            <Sparkles aria-hidden="true" />
            {phase === "starting" ? (
              <AlertTitle key="start" data-prompt-start="">{t("start")}</AlertTitle>
            ) : phase === "driving" ? (
              <AlertTitle key="drive" data-prompt-drive="">{t("drive")}</AlertTitle>
            ) : (
              <AlertTitle key="reply">{t("reply")}</AlertTitle>
            )}
          </Alert>
        </div>
      )}
      {phase === "morphing" && <div ref={morphRef} className={styles.promptMorph} aria-hidden="true" />}
      <div className={styles.promptOverlayInner} data-prompt-bar="">
        {/* A mock field: the script fills it instantly, so visitors can't focus, select or click it. */}
        <div inert>
          <PromptBar
            // Fill the field before its CSS fade-in, let the entrance settle (~94% opaque at
            // 700ms), then hold the finished prompt for 400ms before sending.
            // The script is dropped once sent, so a language switch can't replay it.
            autoType={phase === "typing" ? { text: t("text"), settleDelayMs: 700, holdMs: 400 } : undefined}
            placeholder={t("placeholder")}
            sources={[]}
            commands={[]}
            models={[{ key: "deepseek-v4.1-flash", name: "deepseek-v4.1-flash" }]}
            defaultModel="deepseek-v4.1-flash"
            efforts={["Low", "Medium", "High", "Extra", "Max"]}
            defaultEffort="Medium"
            showControls={false}
            onSent={handleSent}
            background="#ffffff"
            color="#171717"
            menuBackground="#ffffff"
            width={420}
          />
        </div>
      </div>
    </div>
  );
}
