/**
 * OAuth authorization code flow with PKCE. The code is exchanged by the
 * worker, which returns a signed claim bound to the wallet address.
 */

import { PROVIDERS, type Claim, type ProviderName } from "@shared/membership";

import { api } from "./api";
import { config } from "./config";
import { rememberEmail } from "./email";

const AUTHORIZE: Partial<Record<ProviderName, { url: string; scope: string }>> =
  {
    discord: {
      url: "https://discord.com/oauth2/authorize",
      scope: "identify email guilds.members.read",
    },
    github: {
      url: "https://github.com/login/oauth/authorize",
      scope: "read:user user:email",
    },
  };

const PENDING_KEY = "oauth:pending";
const CLAIMS_KEY = "oauth:claims";

interface Pending {
  provider: ProviderName;
  state: string;
  codeVerifier: string;
  address: string;
  returnTo: string;
}

export interface StoredClaim {
  claim: Claim;
  token: string;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export function redirectUri(provider: ProviderName): string {
  const { origin } = window.location;
  return `${origin}${import.meta.env.BASE_URL}oauth/callback/${provider}`;
}

/** Providers the worker is configured for, in the contract's order. */
export function enabledProviders(): ProviderName[] {
  return PROVIDERS.filter((provider) => Boolean(config().oauth[provider]));
}

/** Providers encode scopes separated by %20, not +. */
export function authorizeUrl(
  provider: ProviderName,
  params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
  },
): string {
  const target = AUTHORIZE[provider];
  if (!target) throw new Error(`${provider} accounts cannot be verified`);
  const { url, scope } = target;
  const query = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${url}?${query}&scope=${encodeURIComponent(scope)}`;
}

/** Leave the app to authorize with the provider. */
export async function startOAuth(
  provider: ProviderName,
  address: string,
  returnTo: string,
): Promise<void> {
  const clientId = config().oauth[provider];
  if (!clientId) throw new Error(`${provider} is not configured`);

  const pending: Pending = {
    provider,
    state: randomString(),
    codeVerifier: randomString(48),
    address,
    returnTo,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  window.location.assign(
    authorizeUrl(provider, {
      clientId,
      redirectUri: redirectUri(provider),
      state: pending.state,
      codeChallenge: await codeChallenge(pending.codeVerifier),
    }),
  );
}

/** Exchange the code received on the callback. Returns where to go next. */
export async function completeOAuth(
  provider: ProviderName,
  search: URLSearchParams,
): Promise<{ claim: Claim; returnTo: string }> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as Pending) : null;

  const error = search.get("error_description") ?? search.get("error");
  if (error) throw new Error(error);
  const code = search.get("code");
  if (
    !pending ||
    !code ||
    pending.provider !== provider ||
    pending.state !== search.get("state")
  ) {
    throw new Error("The verification expired, please try again.");
  }

  const stored = await api.exchange(provider, {
    code,
    codeVerifier: pending.codeVerifier,
    redirectUri: redirectUri(provider),
    address: pending.address,
  });
  saveClaim(stored);
  return { claim: stored.claim, returnTo: pending.returnTo };
}

function readClaims(): StoredClaim[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLAIMS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp: number };
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function saveClaim(stored: StoredClaim) {
  if (stored.claim.email && stored.claim.emailHash) {
    rememberEmail(stored.claim.emailHash, stored.claim.email);
  }
  const others = readClaims().filter(
    (c) =>
      !(
        c.claim.address === stored.claim.address &&
        c.claim.provider === stored.claim.provider
      ),
  );
  sessionStorage.setItem(CLAIMS_KEY, JSON.stringify([...others, stored]));
  window.dispatchEvent(new Event("claims"));
}

/** Verified accounts for an address, one per provider. */
export function claimsFor(address: string | null): StoredClaim[] {
  if (!address) return [];
  return readClaims().filter(
    (c) => c.claim.address === address && !tokenExpired(c.token),
  );
}

export function forgetClaim(address: string, provider: ProviderName) {
  sessionStorage.setItem(
    CLAIMS_KEY,
    JSON.stringify(
      readClaims().filter(
        (c) => !(c.claim.address === address && c.claim.provider === provider),
      ),
    ),
  );
  window.dispatchEvent(new Event("claims"));
}
