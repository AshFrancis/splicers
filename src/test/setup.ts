import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock CSS/SCSS imports
vi.mock("*.scss", () => ({}));
vi.mock("*.css", () => ({}));

// Mock environment variables
process.env.PUBLIC_STELLAR_NETWORK = "LOCAL";
process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE =
  "Standalone Network ; February 2017";
process.env.PUBLIC_STELLAR_RPC_URL = "http://localhost:8000/rpc";
process.env.PUBLIC_STELLAR_HORIZON_URL = "http://localhost:8000";
process.env.PUBLIC_GENE_SPLICER_CONTRACT_ID =
  "CCUXEQHSH447LROB3Z27POXMIU3WWNAAAMDD5U25ZBJ3W62IRLKDWU3M";
