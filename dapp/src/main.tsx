import "./styles.css";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { ThemedToaster } from "./components/ThemedToaster";
import { WalletProvider } from "./components/WalletProvider";
import { config, loadConfig } from "./lib/config";
import {
  MAX_AGE,
  persister,
  requestPersistentStorage,
  shouldPersist,
} from "./lib/persist";
import { notify } from "./lib/toast";
import { errorMessage } from "./lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: MAX_AGE,
      refetchOnWindowFocus: false,
    },
  },
});

requestPersistentStorage();

const updateSW = registerSW({
  onNeedRefresh() {
    notify.info("A new version is ready", undefined, {
      label: "Reload",
      onClick: () => void updateSW(true),
    });
  },
});

const root = createRoot(document.getElementById("root")!);

loadConfig()
  .then(async () => {
    // the router imports modules reading the configuration
    const { router } = await import("./router");
    root.render(
      <StrictMode>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: MAX_AGE,
            buster: config().contractId,
            dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
          }}
        >
          <WalletProvider>
            <RouterProvider router={router} />
            <ThemedToaster />
          </WalletProvider>
        </PersistQueryClientProvider>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    root.render(
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Unavailable</h1>
        <p className="mt-2 text-muted-foreground">{errorMessage(error)}</p>
      </div>,
    );
  });
