import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "../test/test-utils";
import ErrorBoundary from "./ErrorBoundary";

function ThrowingComponent({ error }: { error: Error }): React.ReactNode {
  throw error;
}

function GoodComponent() {
  return <div data-testid="good">All good</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    renderWithProviders(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("good")).toBeInTheDocument();
  });

  it("catches errors and shows fallback UI", () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(
      <ErrorBoundary>
        <ThrowingComponent error={new Error("Test error")} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
