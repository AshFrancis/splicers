import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "./test/test-utils";

// Mock modules that pull in wallet SDKs (CJS/ESM issues in test)
vi.mock("./components/ConnectAccount.tsx", () => ({
  default: () => <div data-testid="connect-account">Connect</div>,
}));
vi.mock("./components/GenomeSplicer", () => ({
  GenomeSplicer: () => <div data-testid="genome-splicer">GenomeSplicer</div>,
}));
vi.mock("./pages/Debugger.tsx", () => ({
  default: () => <div>Debugger</div>,
}));
vi.mock("./util/wallet", () => ({
  wallet: {},
  fetchBalance: vi.fn(),
}));
vi.mock("@stellar/freighter-api", () => ({}));
vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: class {},
  WalletNetwork: { STANDALONE: "Standalone Network ; February 2017" },
  allowAllModules: () => [],
  FREIGHTER_ID: "freighter",
  XBULL_ID: "xbull",
}));

// Import App after mocks are set up
const { default: App } = await import("./App");

function renderApp(initialRoute = "/") {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("renders home page at /", () => {
    renderApp("/");
    expect(screen.getByText(/Welcome to Splicers/i)).toBeInTheDocument();
  });

  it("renders debug route in dev mode", () => {
    // import.meta.env.DEV is true in vitest — debug routes are available
    renderApp("/debug");
    expect(screen.getAllByText("Debugger").length).toBeGreaterThan(0);
  });

  it("renders header with project title", () => {
    renderApp("/");
    expect(screen.getByText("Splicers")).toBeInTheDocument();
  });
});
