import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// With API_PROXY the worker runs elsewhere (see scripts/dev-api.ts) and
// Vite proxies /api to it instead of embedding the Cloudflare runtime.
const apiProxy = process.env.API_PROXY;

const DAY = 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(apiProxy ? [] : [cloudflare()]),
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
        // the app shell; API and RPC calls are never precached
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // profiles and pictures are content addressed
            urlPattern: ({ url }) => /\/ipfs\/[^/]+/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "ipfs",
              expiration: { maxEntries: 2000, maxAgeSeconds: 30 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
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
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/api/projects"),
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
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: apiProxy ? { "/api": apiProxy } : undefined,
  },
});
