import { describe, expect, it } from "vitest";
import { buildCloseBody } from "./close-register";

const BASE = { version: 4, currency: "BDT" as const };

describe("close register form", () => {
  it("sends the counted cash as integer minor units with the session version", () => {
    const body = buildCloseBody({ ...BASE, countedText: "1250.50", noteText: "" });

    expect(body).toEqual({
      countedCash: { amount: 125050, currency: "BDT" },
      version: 4,
      note: null,
    });
  });

  it("accepts an empty drawer as a real count of zero", () => {
    const body = buildCloseBody({ ...BASE, countedText: "0", noteText: "" });

    expect(body?.countedCash.amount).toBe(0);
  });

  it("refuses a counted cash that is not an amount, without sending anything", () => {
    expect(buildCloseBody({ ...BASE, countedText: "abc", noteText: "" })).toBeUndefined();
    expect(buildCloseBody({ ...BASE, countedText: "", noteText: "" })).toBeUndefined();
  });

  it("keeps a trimmed note and drops a blank one", () => {
    const withNote = buildCloseBody({ ...BASE, countedText: "10", noteText: "  shift end  " });
    const blank = buildCloseBody({ ...BASE, countedText: "10", noteText: "   " });

    expect(withNote?.note).toBe("shift end");
    expect(blank?.note).toBeNull();
  });
});
