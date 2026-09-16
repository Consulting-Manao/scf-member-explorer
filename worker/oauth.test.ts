import { afterEach, describe, expect, it, vi } from "vitest";

import { hashEmail } from "@shared/membership";

import type { Env } from "./env";
import { exchangeCode, OAuthError, roleFromDiscordRoles } from "./oauth";

const env = {
  DISCORD_CLIENT_ID: "discord-id",
  DISCORD_CLIENT_SECRET: "discord-secret",
  DISCORD_GUILD_ID: "guild",
  DISCORD_ROLE_MAP: JSON.stringify({ pilot: 3, navigator: 2 }),
  ROLE_SOURCE: "discord",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
} as unknown as Env;

const exchange = {
  code: "code",
  codeVerifier: "verifier",
  redirectUri: "https://members.test/oauth/callback/discord",
};

function mockFetch(routes: Record<string, () => Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = Object.keys(routes).find((prefix) =>
        url.startsWith(prefix),
      );
      if (!route) throw new Error(`Unexpected fetch ${url}`);
      return routes[route]!();
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("roleFromDiscordRoles", () => {
  it("takes the highest mapped role", () => {
    expect(
      roleFromDiscordRoles(["x", "navigator", "pilot"], env.DISCORD_ROLE_MAP),
    ).toBe(3);
    expect(roleFromDiscordRoles(["x"], env.DISCORD_ROLE_MAP)).toBe(0);
    expect(roleFromDiscordRoles([], "{}")).toBe(0);
  });
});

describe("discord", () => {
  it("returns id, handle, role and verified email hash", async () => {
    mockFetch({
      "https://discord.com/api/oauth2/token": () =>
        Response.json({ access_token: "token" }),
      "https://discord.com/api/users/@me/guilds/guild/member": () =>
        Response.json({ roles: ["navigator"] }),
      "https://discord.com/api/users/@me": () =>
        Response.json({
          id: "123",
          username: "grogu",
          email: " Grogu@Example.com ",
          verified: true,
        }),
    });

    expect(await exchangeCode("discord", env, exchange)).toEqual({
      provider: "discord",
      id: "123",
      handle: "grogu",
      role: 2,
      emailHash: await hashEmail("grogu@example.com"),
    });
  });

  it("refuses people outside the Discord server", async () => {
    mockFetch({
      "https://discord.com/api/oauth2/token": () =>
        Response.json({ access_token: "token" }),
      "https://discord.com/api/users/@me/guilds/guild/member": () =>
        new Response(null, { status: 404 }),
      "https://discord.com/api/users/@me": () =>
        Response.json({ id: "123", username: "grogu" }),
    });

    await expect(exchangeCode("discord", env, exchange)).rejects.toThrow(
      OAuthError,
    );
  });

  it("grants Verified once roles are no longer migrated", async () => {
    mockFetch({
      "https://discord.com/api/oauth2/token": () =>
        Response.json({ access_token: "token" }),
      "https://discord.com/api/users/@me/guilds/guild/member": () =>
        Response.json({ roles: ["pilot"] }),
      "https://discord.com/api/users/@me": () =>
        Response.json({ id: "123", username: "grogu", verified: false }),
    });

    const identity = await exchangeCode(
      "discord",
      { ...env, ROLE_SOURCE: "verified" },
      exchange,
    );
    expect(identity.role).toBe(0);
    expect(identity.emailHash).toBeUndefined();
  });
});

describe("github", () => {
  it("uses the numeric id and the primary verified email", async () => {
    mockFetch({
      "https://github.com/login/oauth/access_token": () =>
        Response.json({ access_token: "token" }),
      "https://api.github.com/user/emails": () =>
        Response.json([
          { email: "old@example.com", primary: false, verified: true },
          { email: "grogu@example.com", primary: true, verified: true },
        ]),
      "https://api.github.com/user": () =>
        Response.json({ id: 42, login: "grogu" }),
    });

    expect(await exchangeCode("github", env, exchange)).toEqual({
      provider: "github",
      id: "42",
      handle: "grogu",
      emailHash: await hashEmail("grogu@example.com"),
    });
  });

  it("surfaces OAuth errors", async () => {
    mockFetch({
      "https://github.com/login/oauth/access_token": () =>
        Response.json({ error: "bad_verification_code" }),
    });
    await expect(exchangeCode("github", env, exchange)).rejects.toThrow(
      "bad_verification_code",
    );
  });
});
