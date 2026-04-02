import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "@stellar/design-system/build/styles.min.css";
import { WalletProvider } from "./providers/WalletProvider.tsx";
import { NotificationProvider } from "./providers/NotificationProvider.tsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Force dark mode - save preference so SDS respects it
localStorage.setItem("sds-theme", "dark");
document.documentElement.classList.add("sds-theme-dark");
document.documentElement.classList.remove("sds-theme-light");
document.body.classList.add("sds-theme-dark");
document.body.classList.remove("sds-theme-light");

// SDS theme is set via localStorage and class attributes above.
// If SDS overrides persist, set data attribute as a fallback.
document.documentElement.dataset.sdsTheme = "dark";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <NotificationProvider>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </QueryClientProvider>
    </NotificationProvider>
  </StrictMode>,
);
