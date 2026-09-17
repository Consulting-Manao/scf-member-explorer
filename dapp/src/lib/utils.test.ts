import { describe, expect, it } from "vitest";

import { errorMessage, isCancelled } from "./utils";

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
