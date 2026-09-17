import { Keypair } from "@stellar/stellar-sdk";
import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import {
  PROVIDERS,
  type AppConfig,
  type ProviderName,
} from "@shared/membership";

import { attest, AttestError } from "./attest";
import { latestLedger, readMember, readOwner } from "./chain";
import { signClaim, verifyClaim } from "./claims";
import { missingSettings, type Env } from "./env";
import { upload, UploadError } from "./ipfs";
import { exchangeCode, OAuthError } from "./oauth";
import { CACHE_SECONDS, getProject, searchProjects } from "./projects";

type AppEnv = { Bindings: Env };

async function rateLimit(c: Context<AppEnv>, next: Next) {
  const key = c.req.header("cf-connecting-ip") ?? "local";
  const limiter = c.env.RATE_LIMITER;
  if (limiter && !(await limiter.limit({ key })).success) {
    throw new HTTPException(429, { message: "Too many requests" });
  }
  await next();
}

function provider(c: Context<AppEnv>): ProviderName {
  const name = c.req.param("provider") as ProviderName;
  if (!PROVIDERS.includes(name)) {
    throw new HTTPException(404, { message: "Unknown provider" });
  }
  return name;
}

export const app = new Hono<AppEnv>().basePath("/api");

// The API is public and stateless: nothing is authenticated by the origin,
// every request is rate limited per address.
app.use("*", cors());

/** Every API call requires a complete configuration. */
app.use("*", async (c, next) => {
  const missing = missingSettings(c.env);
  if (missing.length > 0) {
    throw new HTTPException(500, {
      message: `Worker not configured: ${missing.join(", ")}`,
    });
  }
  await next();
});

app.get("/config", (c) => {
  const env = c.env;
  const config: AppConfig = {
    network: env.NETWORK,
    networkPassphrase: env.NETWORK_PASSPHRASE,
    rpcUrl: env.RPC_URL,
    contractId: env.CONTRACT_ID,
    attester: env.ATTESTER_PUBLIC,
    ipfsGateway: env.IPFS_GATEWAY,
    roleSource: env.ROLE_SOURCE,
    oauth: { discord: env.DISCORD_CLIENT_ID, github: env.GITHUB_CLIENT_ID },
  };
  return c.json(config);
});

app.post("/oauth/:provider/exchange", rateLimit, async (c) => {
  const body = await c.req.json<{
    code?: string;
    codeVerifier?: string;
    redirectUri?: string;
    address?: string;
  }>();
  if (!body.code || !body.codeVerifier || !body.redirectUri || !body.address) {
    throw new HTTPException(400, { message: "Missing parameters" });
  }
  const identity = await exchangeCode(provider(c), c.env, {
    code: body.code,
    codeVerifier: body.codeVerifier,
    redirectUri: body.redirectUri,
  });
  const claim = { ...identity, address: body.address };
  const attester = Keypair.fromSecret(c.env.ATTESTER_SECRET);
  return c.json({ claim, token: signClaim(claim, attester) });
});

app.post("/attest", rateLimit, async (c) => {
  const body = await c.req.json<{
    entry?: string;
    validUntilLedger?: number;
    claims?: string[];
  }>();
  if (!body.entry || !body.validUntilLedger || !Array.isArray(body.claims)) {
    throw new HTTPException(400, { message: "Missing parameters" });
  }
  const env = c.env;
  const attester = Keypair.fromSecret(env.ATTESTER_SECRET);
  const claims = body.claims.map((token) => {
    try {
      return verifyClaim(token, attester);
    } catch {
      throw new AttestError("Invalid or expired verification");
    }
  });

  const entry = await attest(body.entry, body.validUntilLedger, {
    contractId: env.CONTRACT_ID,
    attester,
    networkPassphrase: env.NETWORK_PASSPHRASE,
    latestLedger: await latestLedger(env),
    claims,
    owner: (tokenId) => readOwner(env, tokenId),
    member: (tokenId) => readMember(env, tokenId),
  });
  return c.json({ entry });
});

app.post("/ipfs", rateLimit, async (c) => {
  const cid = await upload(c.env, await c.req.json());
  return c.json({ cid });
});

const PROJECTS_CACHE = { "Cache-Control": `public, max-age=${CACHE_SECONDS}` };

app.use("/projects", rateLimit);
app.use("/projects/*", rateLimit);

app.get("/projects", async (c) =>
  c.json(
    await searchProjects(c.env, c.req.query("search") ?? ""),
    200,
    PROJECTS_CACHE,
  ),
);

app.get("/projects/:id", async (c) => {
  const project = await getProject(c.env, c.req.param("id"));
  if (!project) throw new HTTPException(404, { message: "Unknown project" });
  return c.json(project, 200, PROJECTS_CACHE);
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  if (
    error instanceof AttestError ||
    error instanceof OAuthError ||
    error instanceof UploadError
  ) {
    return c.json({ error: error.message }, 400);
  }
  console.error(error);
  return c.json({ error: "Internal error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
