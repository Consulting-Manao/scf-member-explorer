import { describe, expect, it } from "vitest";

import { authorizeUrl } from "./oauth";

describe("authorizeUrl", () => {
  it("separates scopes with %20 and uses S256", () => {
    const url = authorizeUrl("discord", {
      clientId: "id",
      redirectUri: "http://127.0.0.1:5173/oauth/callback/discord",
      state: "st",
      codeChallenge: "ch",
    });
    expect(url.startsWith("https://discord.com/oauth2/authorize?")).toBe(true);
    expect(url).toContain("scope=identify%20email%20guilds.members.read");
    expect(url).not.toContain("+");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain(
      "redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Foauth%2Fcallback%2Fdiscord",
    );
  });
});
