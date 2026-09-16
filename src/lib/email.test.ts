import { beforeEach, describe, expect, it, vi } from "vitest";

import { knownEmail, rememberEmail } from "./email";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  clear: () => store.clear(),
});

describe("email memory", () => {
  beforeEach(() => store.clear());

  it("reads back a remembered email", () => {
    rememberEmail("ab".repeat(32), "grogu@example.com");
    expect(knownEmail("ab".repeat(32))).toBe("grogu@example.com");
  });

  it("knows nothing about other hashes", () => {
    expect(knownEmail("cd".repeat(32))).toBeNull();
    expect(knownEmail(null)).toBeNull();
  });
});
