import type { ClientSession } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { backoffDelayMs, commitWithRetry, hasErrorLabel } from "./transaction-retry.js";

function labelled(label: string): Error {
  return Object.assign(new Error(`labelled ${label}`), { errorLabels: [label] });
}

function sessionCommitting(outcomes: readonly (Error | undefined)[]): {
  session: ClientSession;
  commit: ReturnType<typeof vi.fn>;
} {
  const commit = vi.fn();
  for (const outcome of outcomes) {
    if (outcome === undefined) commit.mockResolvedValueOnce(undefined);
    else commit.mockRejectedValueOnce(outcome);
  }
  // Safe: commitWithRetry only calls commitTransaction, so the fake needs nothing else.
  return { session: { commitTransaction: commit } as unknown as ClientSession, commit };
}

describe("backoffDelayMs", () => {
  it("waits 50, 200 and then 800 ms between attempts", () => {
    expect([1, 2, 3, 4, 9].map(backoffDelayMs)).toEqual([50, 200, 800, 800, 800]);
  });
});

describe("hasErrorLabel", () => {
  it("reads labels from an array or a Set and ignores anything else", () => {
    expect(hasErrorLabel({ errorLabels: ["A"] }, "A")).toBe(true);
    expect(hasErrorLabel({ errorLabels: new Set(["A"]) }, "A")).toBe(true);
    expect(hasErrorLabel({ errorLabels: ["B"] }, "A")).toBe(false);
    expect(hasErrorLabel("text", "A")).toBe(false);
    expect(hasErrorLabel(undefined, "A")).toBe(false);
  });
});

describe("commitWithRetry", () => {
  it("commits again when the first commit result is unknown", async () => {
    const unknown = labelled("UnknownTransactionCommitResult");
    const { session, commit } = sessionCommitting([unknown, unknown, undefined]);

    await commitWithRetry(session, 3);

    expect(commit).toHaveBeenCalledTimes(3);
  });

  it("stops after the maximum number of attempts and rethrows", async () => {
    const unknown = labelled("UnknownTransactionCommitResult");
    const { session, commit } = sessionCommitting([unknown, unknown]);

    await expect(commitWithRetry(session, 2)).rejects.toThrow(
      "labelled UnknownTransactionCommitResult",
    );

    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("does not repeat a commit that failed for another reason", async () => {
    const { session, commit } = sessionCommitting([new Error("disk full")]);

    await expect(commitWithRetry(session, 3)).rejects.toThrow("disk full");

    expect(commit).toHaveBeenCalledTimes(1);
  });
});
