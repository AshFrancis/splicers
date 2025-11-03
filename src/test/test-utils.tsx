import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Create a new QueryClient for each test
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions,
) {
  const { queryClient, ...renderOptions } = options || {};

  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
      ),
      ...renderOptions,
    }),
  };
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { userEvent } from "@testing-library/user-event";
