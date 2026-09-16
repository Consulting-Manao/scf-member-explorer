import "./styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { loadConfig } from "./lib/config";
import { WalletProvider } from "./components/WalletProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const root = createRoot(document.getElementById("root")!);

loadConfig()
  .then(async () => {
    // the router imports modules reading the configuration
    const { router } = await import("./router");
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <RouterProvider router={router} />
            <Toaster richColors position="bottom-right" />
          </WalletProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  })
  .catch((error: Error) => {
    root.render(
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>,
    );
  });
