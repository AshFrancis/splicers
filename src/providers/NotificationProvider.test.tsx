import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, act, waitFor } from "../test/test-utils";
import {
  NotificationProvider,
  NotificationContext,
} from "./NotificationProvider";
import type { NotificationContextType } from "./NotificationProvider";
import { use } from "react";

// Helper component to trigger notifications
function NotificationTrigger({
  onMount,
}: {
  onMount?: (ctx: NotificationContextType) => void;
}) {
  const ctx = use(NotificationContext);
  if (ctx && onMount) {
    onMount(ctx);
  }
  return <div data-testid="trigger" />;
}

describe("NotificationProvider", () => {
  it("renders children", () => {
    renderWithProviders(
      <NotificationProvider>
        <div data-testid="child">Hello</div>
      </NotificationProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides addNotification context", () => {
    let contextValue: NotificationContextType | undefined;

    renderWithProviders(
      <NotificationProvider>
        <NotificationTrigger
          onMount={(ctx) => {
            contextValue = ctx;
          }}
        />
      </NotificationProvider>,
    );

    expect(contextValue).toBeDefined();
    expect(typeof contextValue!.addNotification).toBe("function");
  });

  it("displays notification when addNotification is called", async () => {
    let addFn: NotificationContextType["addNotification"] | undefined;

    renderWithProviders(
      <NotificationProvider>
        <NotificationTrigger
          onMount={(ctx) => {
            addFn = ctx.addNotification;
          }}
        />
      </NotificationProvider>,
    );

    act(() => {
      addFn!("Test message", "success");
    });

    await waitFor(() => {
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });
  });

  it("removes notification after timeout", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let addFn: NotificationContextType["addNotification"] | undefined;

    renderWithProviders(
      <NotificationProvider>
        <NotificationTrigger
          onMount={(ctx) => {
            addFn = ctx.addNotification;
          }}
        />
      </NotificationProvider>,
    );

    act(() => {
      addFn!("Disappearing message", "primary");
    });

    expect(screen.getByText("Disappearing message")).toBeInTheDocument();

    // After 6 seconds the notification should be removed (2.5s mark + 5s filter)
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText("Disappearing message")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
