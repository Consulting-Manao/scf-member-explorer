/**
 * Serve the worker API with Bun, for machines where the local Cloudflare
 * runtime cannot reach the network. Pair it with `API_PROXY` on Vite:
 *
 *   bun scripts/dev-api.ts            # http://127.0.0.1:8787
 *   API_PROXY=http://127.0.0.1:8787 bun dev
 */

import { app } from "../worker/src/index";
import { localEnv } from "./env";

const env = await localEnv();
const port = Number(process.env.PORT ?? 8787);
console.log(`API on http://127.0.0.1:${port}, contract ${env.CONTRACT_ID}`);

// `bun run` starts a server from a default export with `fetch`
export default {
  port,
  hostname: "127.0.0.1",
  fetch: (request: Request) => app.fetch(request, env),
};
