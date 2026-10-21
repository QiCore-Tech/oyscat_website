// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PromptBar from "./prompt-bar";

const PROMPT = "帮我搭建一个越野车，让它动起来";

describe("PromptBar scripted prompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fills the complete prompt immediately and sends after the settle and hold delays", () => {
    const onSent = vi.fn();

    render(
      <PromptBar
        autoType={{ text: PROMPT, settleDelayMs: 700, holdMs: 400 }}
        showControls={false}
        onSent={onSent}
      />
    );

    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(input.value).toBe(PROMPT);

    act(() => vi.advanceTimersByTime(1_099));
    expect(onSent).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith(PROMPT);
  });
});
