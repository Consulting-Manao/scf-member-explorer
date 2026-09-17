import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

// In dev, Vite proxies /api to the worker running locally (see
// ../scripts/dev-api.ts, or `wrangler dev`). A build takes the worker's
// origin from VITE_API_URL, empty when served from the same one.
const API_PROXY = process.env.API_PROXY ?? "http://127.0.0.1:8787";

const DAY = 24 * 60 * 60;

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL;
  // routes are serialised into the service worker, so a plain pattern: a
  // cross-origin one must match from the start, a same-origin one anywhere
  const projects = apiUrl
    ? new RegExp(
        `^${new URL(apiUrl).origin.replaceAll(".", "\\.")}/api/projects`,
      )
    : /\/api\/projects/;
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        manifest: {
          name: "Stellar Members",
          short_name: "Members",
          description: "Your seat in the Stellar community.",
          start_url: "/",
          display: "standalone",
          background_color: "#0b0b12",
          theme_color: "#0b0b12",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // the shell only: lazy chunks stay lazy, fonts and pictures are
          // cached as they load
          globPatterns: [
            "index.html",
            "assets/index-*.{js,css}",
            "*.{svg,png}",
          ],
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
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/assets/"),
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
              urlPattern: projects,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "projects",
                expiration: { maxEntries: 500, maxAgeSeconds: DAY },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: { include: ["src/**/*.test.ts"], environment: "node" },
    server: {
      port: 5173,
      proxy: { "/api": API_PROXY },
    },
  };
});
