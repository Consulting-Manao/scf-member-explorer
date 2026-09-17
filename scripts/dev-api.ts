/**
 * Serve the worker API with Bun on http://127.0.0.1:8787, where Vite
 * proxies /api in dev. `bun run --cwd worker dev` runs it under the
 * Cloudflare runtime instead, when that runtime can reach the network.
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
