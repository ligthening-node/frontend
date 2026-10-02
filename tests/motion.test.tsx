import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MotionToggle } from "@/components/shell/motion-toggle";
import { SwapIcon } from "@/components/ui/swap-icon";
import { isMotionOff } from "@/lib/motion-pref";

afterEach((): void => {
  delete document.documentElement.dataset.motion;
  localStorage.clear();
});

describe("motion preference", () => {
  it("is off only for an explicit off", () => {
    expect(isMotionOff("off")).toBe(true);
    expect(isMotionOff("on")).toBe(false);
    expect(isMotionOff(null)).toBe(false);
    expect(isMotionOff(undefined)).toBe(false);
  });

  it("pauses and resumes the background and remembers the choice", async () => {
    render(<MotionToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Pause background motion" }));
    expect(document.documentElement.dataset.motion).toBe("off");
    expect(localStorage.getItem("motion")).toBe("off");
    const resume = await screen.findByRole("button", { name: "Play background motion" });
    expect(resume).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(resume);
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(localStorage.getItem("motion")).toBe("on");
  });
});

describe("SwapIcon", () => {
  it("shows one icon at a time and hides the swap from screen readers", () => {
    const { container, rerender } = render(<SwapIcon swapped={false} from={<i data-testid="a" />} to={<i data-testid="b" />} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("a").parentElement).toHaveClass("opacity-100");
    expect(screen.getByTestId("b").parentElement).toHaveClass("opacity-0");
    rerender(<SwapIcon swapped from={<i data-testid="a" />} to={<i data-testid="b" />} />);
    expect(screen.getByTestId("a").parentElement).toHaveClass("opacity-0");
    expect(screen.getByTestId("b").parentElement).toHaveClass("opacity-100");
  });
});
