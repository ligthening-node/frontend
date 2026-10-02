import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "@/components/ui/copy-button";

const NODE_ID = "03c31cb9dcbf0555125d3ab97a6015e25264cfff9c5b2c0558dc01d8446e565f2e";

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe("CopyButton", () => {
  it("copies the full value and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyButton value={NODE_ID} label="node id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy node id" }));
    await screen.findByRole("button", { name: "Copied node id" });
    expect(writeText).toHaveBeenCalledWith(NODE_ID);
  });

  it("falls back to execCommand when the clipboard API is missing", async () => {
    vi.stubGlobal("navigator", {});
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    render(<CopyButton value={NODE_ID} label="node id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy node id" }));
    await screen.findByRole("button", { name: "Copied node id" });
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("stays quiet when copying fails", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    render(<CopyButton value={NODE_ID} label="node id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy node id" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole("button", { name: "Copy node id" })).toBeInTheDocument();
  });
});
