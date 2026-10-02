import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { ErrorToastProvider } from "@/lib/error-toasts";
import { useAction } from "@/lib/use-action";

function FailingButton(): React.ReactElement {
  const action = useAction();
  return (
    <button
      onClick={(): void =>
        void action.run((): Promise<void> => Promise.reject(new ApiError("node_error", "Failed to create channel.")))
      }
    >
      go
    </button>
  );
}

afterEach((): void => {
  vi.useRealTimers();
});

describe("error toasts", () => {
  it("pops up when an action fails", async () => {
    render(
      <ErrorToastProvider>
        <FailingButton />
      </ErrorToastProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(await screen.findByTestId("error-toast")).toHaveTextContent("Failed to create channel.");
  });

  it("can be dismissed", async () => {
    render(
      <ErrorToastProvider>
        <FailingButton />
      </ErrorToastProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    await screen.findByTestId("error-toast");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    // It plays a 120 ms exit before it leaves.
    expect(screen.getByTestId("error-toast")).toHaveClass("toast-exit");
    await waitFor((): void => expect(screen.queryByTestId("error-toast")).toBeNull());
  });

  it("closes itself after a while", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ErrorToastProvider>
        <FailingButton />
      </ErrorToastProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    await screen.findByTestId("error-toast");
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(10_700);
    });
    expect(screen.queryByTestId("error-toast")).toBeNull();
  });
});
