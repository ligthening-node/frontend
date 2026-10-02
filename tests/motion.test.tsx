import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SwapIcon } from "@/components/ui/swap-icon";

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
