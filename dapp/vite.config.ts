import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

// In dev, Vite proxies /api to the worker running locally (see
// ../worker/scripts/dev-api.ts, or `wrangler dev`). A build takes the worker's
// origin from VITE_API_URL, empty when served from the same one.
const API_PROXY = process.env.API_PROXY ?? "http://127.0.0.1:8787";

// The path the app is served under, its own domain unless BASE_PATH says
// otherwise. Everything absolute is built from it: the manifest here, the
// router and the OAuth redirect through import.meta.env.BASE_URL.
const BASE = process.env.BASE_PATH ?? "/";

const DAY = 24 * 60 * 60;

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL;
  // routes are serialised into the service worker, so a plain pattern:
  // anchored on the worker's origin, or on the path when it shares ours
  const api = (path: string) =>
    new RegExp(
      `^${apiUrl ? new URL(apiUrl).origin.replaceAll(".", "\\.") : "[^?#]*"}/api/${path}`,
    );
  // BASE is not in scope once a route is serialised, so it is baked in here
  const own = (path: string) =>
    new RegExp(`^[^?#]*${BASE.replaceAll(".", "\\.")}${path}`);
  return {
    base: BASE,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        manifest: {
          name: "Stellar Members",
          short_name: "Members",
          description: "Your seat in the Stellar community.",
          start_url: BASE,
          scope: BASE,
          display: "standalone",
          background_color: "#0b0b12",
          theme_color: "#0b0b12",
          icons: [
            { src: `${BASE}icon-192.png`, sizes: "192x192", type: "image/png" },
            { src: `${BASE}icon-512.png`, sizes: "512x512", type: "image/png" },
            {
              src: `${BASE}icon-maskable-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // the whole shell, so an installed app opens without the network
          globPatterns: ["index.html", "assets/*.{js,css}", "*.{svg,png}"],
          // packing a profile needs the network anyway, so it stays lazy
          globIgnores: ["**/ipfs-car-*.js"],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // profiles and pictures are content addressed
              urlPattern: ({ url }) => /\/ipfs\/[^/]+/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "ipfs",
                expiration: { maxEntries: 300, maxAgeSeconds: 30 * DAY },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: own("assets/"),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets" },
            },
            {
              urlPattern: ({ url }) =>
                url.hostname === "avatars.githubusercontent.com",
              handler: "CacheFirst",
              options: {
                cacheName: "avatars",
                expiration: { maxEntries: 1000, maxAgeSeconds: 7 * DAY },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: api("projects"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "projects",
                expiration: { maxEntries: 500, maxAgeSeconds: DAY },
              },
            },
            {
              // the app cannot render without it, and it is public
              urlPattern: api("config$"),
              handler: "NetworkFirst",
              options: {
                cacheName: "config",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 1 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
      },
    },
    test: {
      include: ["src/**/*.test.ts", "../shared/**/*.test.ts"],
      environment: "node",
    },
    server: {
      port: 5173,
      proxy: { "/api": API_PROXY },
    },
  };
});
