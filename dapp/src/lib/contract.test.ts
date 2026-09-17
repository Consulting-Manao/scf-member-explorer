import { nativeToScVal } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { memberKeyScVal, u32 } from "./contract";

// The app bulk-reads ledger entries instead of simulating calls, so it builds
// the contract's `MemberKey` keys itself. Nothing else checks that they still
// address the entries the contract writes: pin them.
describe("storage keys", () => {
  it("match the contract encoding", () => {
    const encode = (...args: Parameters<typeof memberKeyScVal>) =>
      memberKeyScVal(...args).toXdr("base64");

    expect(encode("Member", u32(7))).toBe(
      "AAAAEAAAAAEAAAACAAAADwAAAAZNZW1iZXIAAAAAAAMAAAAH",
    );
    expect(encode("Owner", u32(7))).toBe(
      "AAAAEAAAAAEAAAACAAAADwAAAAVPd25lcgAAAAAAAAMAAAAH",
    );
    expect(encode("Recovery", u32(7))).toBe(
      "AAAAEAAAAAEAAAACAAAADwAAAAhSZWNvdmVyeQAAAAMAAAAH",
    );
    expect(
      encode(
        "TokenOf",
        nativeToScVal(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          { type: "address" },
        ),
      ),
    ).toBe(
      "AAAAEAAAAAEAAAACAAAADwAAAAdUb2tlbk9mAAAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    expect(
      encode("Account", u32(1), nativeToScVal("42", { type: "string" })),
    ).toBe("AAAAEAAAAAEAAAADAAAADwAAAAdBY2NvdW50AAAAAAMAAAABAAAADgAAAAI0MgAA");
  });
});
