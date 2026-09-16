import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// With API_PROXY the worker runs elsewhere (see scripts/dev-api.ts) and
// Vite proxies /api to it instead of embedding the Cloudflare runtime.
const apiProxy = process.env.API_PROXY;

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(apiProxy ? [] : [cloudflare()])],
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
