import { describe, expect, it } from "vitest";

import { errorMessage, httpUrl, isCancelled } from "./utils";

describe("errorMessage", () => {
  it("reads the message of wallets kit error objects", () => {
    expect(
      errorMessage({ code: -3, message: "Please set the wallet first" }),
    ).toBe("Please set the wallet first");
  });

  it("maps contract errors", () => {
    expect(errorMessage(new Error("HostError: Error(Contract, #202)"))).toBe(
      "This address already holds a membership.",
    );
  });

  it("treats a wallet refusal as a cancel, never a contract failure", () => {
    const closed = { code: -1, message: "The user closed the modal." };
    expect(isCancelled(closed)).toBe(true);
    expect(errorMessage(closed)).toBe("Request cancelled.");
    expect(isCancelled({ code: -4, message: "User declined access" })).toBe(
      true,
    );
    expect(
      isCancelled(
        new Error("HostError: cancel_recovery failed: Error(Contract, #301)"),
      ),
    ).toBe(false);
  });
});

describe("httpUrl", () => {
  it("only lets http and https through", () => {
    expect(httpUrl("https://grogu.example")).toBe("https://grogu.example");
    expect(httpUrl("http://grogu.example")).toBe("http://grogu.example");
  });

  // rendered as an href on a page anyone can open, from a profile its member
  // wrote: a scheme that runs code or reads a file must not survive
  it("refuses anything else", () => {
    for (const value of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "grogu.example",
      "",
      undefined,
    ]) {
      expect(httpUrl(value)).toBe(null);
    }
  });
});
