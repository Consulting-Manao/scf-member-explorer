import { Keypair } from "@stellar/stellar-sdk";
import { Hono, type Context, type Next } from "hono";
import { bodyLimit } from "hono/body-limit";
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
import {
  missingSettings,
  resolveNetwork,
  UnknownNetwork,
  type Env,
  type NetworkConfig,
} from "./env";
import { upload, UploadError } from "./ipfs";
import { exchangeCode, OAuthError } from "./oauth";
import { CACHE_SECONDS, getProject, searchProjects } from "./projects";

type AppEnv = { Bindings: Env; Variables: { net: NetworkConfig } };

async function rateLimit(c: Context<AppEnv>, next: Next) {
  const key = c.req.header("cf-connecting-ip") ?? "local";
  const limiter = c.env.RATE_LIMITER;
  if (limiter && !(await limiter.limit({ key })).success) {
    throw new HTTPException(429, { message: "Too many requests" });
  }
  await next();
}

/** A body this big is refused before it is read. */
const limit = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw new HTTPException(413, { message: "Body too large" });
    },
  });

async function body<T>(c: Context<AppEnv>): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw new HTTPException(400, { message: "Malformed JSON body" });
  }
}

function provider(c: Context<AppEnv>): ProviderName {
  const name = c.req.param("provider") as ProviderName;
  if (!PROVIDERS.includes(name)) {
    throw new HTTPException(404, { message: "Unknown provider" });
  }
  return name;
}

/**
 * Pick the network of the request.
 *
 * `?network=` selects a whole row of the configuration: passphrase,
 * contract, RPC and attester key always come from the same one, so a
 * request says which network it is for and can never mix two.
 */
async function withNetwork(c: Context<AppEnv>, next: Next) {
  const name = c.req.query("network");
  if (!name) {
    throw new HTTPException(400, { message: "Missing network" });
  }
  try {
    c.set("net", resolveNetwork(c.env, name));
  } catch (error) {
    if (error instanceof UnknownNetwork) {
      throw new HTTPException(400, { message: error.message });
    }
    throw error;
  }
  await next();
}

export const app = new Hono<AppEnv>().basePath("/api");

// The API is public and stateless: nothing is authenticated by the origin,
// every request that costs something is rate limited per client address.
app.use("*", cors());

/** Every API call requires a complete configuration, `/config` says why. */
app.use("*", async (c, next) => {
  const missing = missingSettings(c.env);
  if (missing.length > 0) {
    throw new HTTPException(500, {
      message: c.req.path.endsWith("/config")
        ? `Worker not configured: ${missing.join(", ")}`
        : "Worker not configured",
    });
  }
  await next();
});

app.get("/config", withNetwork, (c) => {
  const env = c.env;
  const net = c.get("net");
  const config: AppConfig = {
    network: net.network,
    networkPassphrase: net.networkPassphrase,
    rpcUrl: net.rpcUrl,
    contractId: net.contractId,
    attester: net.attesterPublic,
    ipfsGateway: env.IPFS_GATEWAY,
    roleSource: env.ROLE_SOURCE,
    oauth: { discord: env.DISCORD_CLIENT_ID, github: env.GITHUB_CLIENT_ID },
  };
  return c.json(config);
});

app.post(
  "/oauth/:provider/exchange",
  limit(4 * 1024),
  rateLimit,
  withNetwork,
  async (c) => {
    const sent = await body<{
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
      address?: string;
    }>(c);
    if (
      !sent.code ||
      !sent.codeVerifier ||
      !sent.redirectUri ||
      !sent.address
    ) {
      throw new HTTPException(400, { message: "Missing parameters" });
    }
    const identity = await exchangeCode(provider(c), c.env, {
      code: sent.code,
      codeVerifier: sent.codeVerifier,
      redirectUri: sent.redirectUri,
    });
    const claim = { ...identity, address: sent.address };
    // the claim is signed by the attester of that network, and only
    // `/attest` on the same network will accept it back
    const attester = Keypair.fromSecret(c.get("net").attesterSecret);
    return c.json({ claim, token: signClaim(claim, attester) });
  },
);

app.post("/attest", limit(64 * 1024), rateLimit, withNetwork, async (c) => {
  const sent = await body<{
    entry?: string;
    validUntilLedger?: number;
    claims?: string[];
  }>(c);
  if (
    !sent.entry ||
    typeof sent.validUntilLedger !== "number" ||
    !Array.isArray(sent.claims) ||
    sent.claims.length > PROVIDERS.length
  ) {
    throw new HTTPException(400, { message: "Missing parameters" });
  }
  const net = c.get("net");
  const attester = Keypair.fromSecret(net.attesterSecret);
  const claims = sent.claims.map((token) => {
    try {
      return verifyClaim(token, attester);
    } catch {
      throw new AttestError("Invalid or expired verification");
    }
  });

  const entry = await attest(sent.entry, sent.validUntilLedger, {
    contractId: net.contractId,
    attester,
    networkPassphrase: net.networkPassphrase,
    latestLedger: await latestLedger(net),
    claims,
    owner: (tokenId) => readOwner(net, tokenId),
    member: (tokenId) => readMember(net, tokenId),
  });
  return c.json({ entry });
});

// the CAR is base64, so 4/3 of the 5 MB the upload itself allows
app.post("/ipfs", limit(7 * 1024 * 1024), rateLimit, withNetwork, async (c) => {
  const net = c.get("net");
  const cid = await upload(
    { env: c.env, net, owner: (tokenId) => readOwner(net, tokenId) },
    await body(c),
  );
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
