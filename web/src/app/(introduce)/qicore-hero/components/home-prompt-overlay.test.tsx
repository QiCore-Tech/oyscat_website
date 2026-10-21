// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../../messages/zh-CN.json";
import { HomePromptOverlay } from "./home-prompt-overlay";

describe("HomePromptOverlay", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  });

  it("shows the WASD hint only after the vehicle assembly completes", async () => {
    render(
      <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
        <div data-home-voxel>
          <HomePromptOverlay atTop />
        </div>
      </NextIntlClientProvider>
    );

    act(() => vi.advanceTimersByTime(1_100));
    expect(screen.getByText("好的，正在为你搭建一辆越野车，搭好就让它跑起来…")).toBeTruthy();

    act(() => vi.advanceTimersByTime(3_510));
    expect(screen.queryByText("现在可以用 WASD 驾驶了")).toBeNull();

    const root = document.querySelector<HTMLElement>("[data-home-voxel]")!;
    await act(async () => {
      root.setAttribute("data-assembly-status", "complete");
      await Promise.resolve();
    });
    const driveHint = screen.getByText("现在可以用 WASD 驾驶了");
    expect(driveHint.closest("[data-prompt-bar]")?.className).toContain("max-md:hidden");

    act(() => vi.advanceTimersByTime(3_350));
    expect(screen.queryByText("现在可以用 WASD 驾驶了")).toBeNull();
  });
});
