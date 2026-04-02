import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock all stylesheet imports (CSS/SCSS) including from node_modules
vi.mock("*.scss", () => ({}));
vi.mock("*.css", () => ({}));

// Mock Stellar Design System — its built JS files import .scss relatively,
// which breaks in vitest. Replace with simple element stubs.
vi.mock("@stellar/design-system", () => ({
  Button: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("button", null, children),
  Card: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  Code: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("code", null, children),
  Heading: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("h2", null, children),
  Icon: new Proxy(
    {},
    {
      get: () => () => React.createElement("span", null, "icon"),
    },
  ),
  Layout: {
    Header: ({
      projectTitle,
      contentRight,
    }: {
      projectTitle?: string;
      contentRight?: React.ReactNode;
    }) => React.createElement("header", null, projectTitle, contentRight),
    Content: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    Inset: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    Footer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("footer", null, children),
  },
  Notification: ({
    title,
    children,
  }: {
    title?: string;
    children?: React.ReactNode;
  }) => React.createElement("div", { role: "alert" }, title, children),
  Text: ({
    children,
    as: Tag = "span",
  }: {
    children?: React.ReactNode;
    as?: string;
  }) => React.createElement(Tag, null, children),
}));

// Mock environment variables
process.env.PUBLIC_STELLAR_NETWORK = "LOCAL";
process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE =
  "Standalone Network ; February 2017";
process.env.PUBLIC_STELLAR_RPC_URL = "http://localhost:8000/rpc";
process.env.PUBLIC_STELLAR_HORIZON_URL = "http://localhost:8000";
process.env.PUBLIC_GENE_SPLICER_CONTRACT_ID =
  "CCUXEQHSH447LROB3Z27POXMIU3WWNAAAMDD5U25ZBJ3W62IRLKDWU3M";
