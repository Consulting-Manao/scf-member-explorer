import { describe, it, expect } from "vitest";
import { ipfsToHttp, parseDirectoryHtml } from "@/services/ipfs";

describe("ipfsToHttp", () => {
  it("converts ipfs:// URIs to a public gateway URL", () => {
    expect(ipfsToHttp("ipfs://bafytestcid")).toBe("https://ipfs.io/ipfs/bafytestcid");
  });

  it("strips a bare ipfs/ prefix", () => {
    expect(ipfsToHttp("ipfs/bafytestcid")).toBe("https://ipfs.io/ipfs/bafytestcid");
  });

  it("returns http(s) URLs unchanged", () => {
    expect(ipfsToHttp("https://example.com/foo.png")).toBe("https://example.com/foo.png");
    expect(ipfsToHttp("http://example.com/foo.png")).toBe("http://example.com/foo.png");
  });

  it("handles empty input", () => {
    expect(ipfsToHttp("")).toBe("");
  });
});

describe("parseDirectoryHtml", () => {
  const fixture = `
    <html><body>
      <table>
        <tr><td><a href="/ipfs/bafyChildA?filename=profile.json">profile.json</a></td></tr>
        <tr><td><a href="/ipfs/bafyChildB?filename=profile-image.png">profile-image.png</a></td></tr>
        <tr><td><a href="/ipfs/bafyChildC?filename=README%20file.md">README file.md</a></td></tr>
      </table>
    </body></html>
  `;

  it("extracts each entry's name and CID from the gateway HTML index", () => {
    const entries = parseDirectoryHtml(fixture);
    expect(entries).toEqual([
      { name: "profile.json", cid: "bafyChildA" },
      { name: "profile-image.png", cid: "bafyChildB" },
      { name: "README file.md", cid: "bafyChildC" },
    ]);
  });

  it("URL-decodes filenames", () => {
    const html = `<a href="/ipfs/bafyX?filename=hello%20world.txt">x</a>`;
    expect(parseDirectoryHtml(html)).toEqual([{ name: "hello world.txt", cid: "bafyX" }]);
  });

  it("deduplicates entries that appear twice (e.g. icon + filename links)", () => {
    const html = `
      <a href="/ipfs/bafyX?filename=profile.json">icon</a>
      <a href="/ipfs/bafyX?filename=profile.json">profile.json</a>
    `;
    expect(parseDirectoryHtml(html)).toEqual([{ name: "profile.json", cid: "bafyX" }]);
  });

  it("returns an empty array when the HTML has no matching anchors", () => {
    expect(parseDirectoryHtml("<html><body>nothing here</body></html>")).toEqual([]);
  });
});
