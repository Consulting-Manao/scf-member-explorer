import { describe, it, expect } from "vitest";
import { ipfsToHttp } from "@/services/ipfs";

describe("ipfsToHttp", () => {
  it("converts ipfs:// URIs to a public gateway URL", () => {
    expect(ipfsToHttp("ipfs://bafytestcid")).toBe("https://ipfs.io/ipfs/bafytestcid");
  });

  it("returns http(s) URLs unchanged", () => {
    expect(ipfsToHttp("https://example.com/foo.png")).toBe("https://example.com/foo.png");
  });

  it("handles empty input", () => {
    expect(ipfsToHttp("")).toBe("");
  });
});
