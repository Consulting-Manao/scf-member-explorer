import {
  hashEmail,
  MAX_ACCOUNT_LEN,
  type Claim,
  type ProviderName,
} from "@shared/membership";

import type { Env } from "./env";

export interface CodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export type Identity = Omit<Claim, "address">;

export class OAuthError extends Error {}

const USER_AGENT = "stellar-members";
/** Discord requires this format for HTTP clients. */
const DISCORD_USER_AGENT =
  "DiscordBot (https://github.com/Consulting-Manao, 1.0)";
const DISCORD_API = "https://discord.com/api/v10";

/** Parse a provider response, keeping its error body for diagnosis. */
async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new OAuthError(`${what} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

const MAX_EMAIL_LEN = 254;

/** The normalized email and its hash, or nothing. */
async function verifiedEmail(
  email: string | null | undefined,
): Promise<Pick<Identity, "email" | "emailHash">> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_EMAIL_LEN) return {};
  return { email: normalized, emailHash: await hashEmail(normalized) };
}

function checkIdentity(identity: Identity): Identity {
  if (!identity.id || identity.id.length > MAX_ACCOUNT_LEN) {
    throw new OAuthError("Invalid account id");
  }
  return { ...identity, handle: identity.handle.slice(0, MAX_ACCOUNT_LEN) };
}

/** Highest role mapped from the member's Discord roles. */
export function roleFromDiscordRoles(roles: string[], roleMap: string): number {
  const map = JSON.parse(roleMap) as Record<string, number>;
  return roles.reduce((role, id) => Math.max(role, map[id] ?? 0), 0);
}

async function discord(env: Env, exchange: CodeExchange): Promise<Identity> {
  const token = await json<{ access_token: string }>(
    await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DISCORD_USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
        code_verifier: exchange.codeVerifier,
      }),
    }),
    "Discord token exchange",
  );
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    "User-Agent": DISCORD_USER_AGENT,
  };

  const user = await json<{
    id: string;
    username: string;
    email?: string | null;
    verified?: boolean;
  }>(await fetch(`${DISCORD_API}/users/@me`, { headers }), "Discord user");

  const memberRes = await fetch(
    `${DISCORD_API}/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`,
    { headers },
  );
  if (memberRes.status === 404) {
    throw new OAuthError("Join the Stellar Discord server first");
  }
  const guildMember = await json<{ roles: string[] }>(
    memberRes,
    "Discord server membership",
  );

  return {
    provider: "discord",
    id: user.id,
    handle: user.username,
    ...(await verifiedEmail(user.verified ? user.email : null)),
    role:
      env.ROLE_SOURCE === "discord"
        ? roleFromDiscordRoles(guildMember.roles, env.DISCORD_ROLE_MAP)
        : 0,
  };
}

async function github(env: Env, exchange: CodeExchange): Promise<Identity> {
  const token = await json<{ access_token?: string; error?: string }>(
    await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
        code_verifier: exchange.codeVerifier,
      }),
    }),
    "GitHub token exchange",
  );
  if (!token.access_token) {
    throw new OAuthError(token.error ?? "GitHub token exchange failed");
  }
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };

  const user = await json<{ id: number; login: string }>(
    await fetch("https://api.github.com/user", { headers }),
    "GitHub user",
  );
  const emails = await json<
    { email: string; primary: boolean; verified: boolean }[]
  >(
    await fetch("https://api.github.com/user/emails", { headers }),
    "GitHub emails",
  );
  const primary = emails.find((e) => e.primary && e.verified);

  return {
    provider: "github",
    id: String(user.id),
    handle: user.login,
    ...(await verifiedEmail(primary?.email)),
  };
}

async function x(env: Env, exchange: CodeExchange): Promise<Identity> {
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
    throw new OAuthError("X is not enabled");
  }
  const token = await json<{ access_token: string }>(
    await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
        code_verifier: exchange.codeVerifier,
      }),
    }),
    "X token exchange",
  );
  const user = await json<{ data: { id: string; username: string } }>(
    await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
    "X user",
  );
  return { provider: "x", id: user.data.id, handle: user.data.username };
}

const PROVIDERS: Record<
  ProviderName,
  (env: Env, exchange: CodeExchange) => Promise<Identity>
> = { discord, github, x };

/** Exchange an authorization code for the verified identity. */
export async function exchangeCode(
  provider: ProviderName,
  env: Env,
  exchange: CodeExchange,
): Promise<Identity> {
  return checkIdentity(await PROVIDERS[provider](env, exchange));
}
