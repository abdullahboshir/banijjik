import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { RefreshSession, USER_AGENT_MAX_LENGTH } from "./refresh-session.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function openFamily(userAgent?: string): RefreshSession {
  return RefreshSession.openFamily({
    userId: newId() as UserId,
    tokenHash: "hash-1",
    now: NOW,
    tokenTtlDays: 30,
    familyMaxDays: 90,
    userAgent,
  });
}

describe("RefreshSession", () => {
  it("opens a family that lasts 30 days, inside a family limit of 90 days", () => {
    const session = openFamily();

    expect(session.expiresAt.getTime() - NOW.getTime()).toBe(30 * DAY_MS);
    expect(session.familyExpiresAt.getTime() - NOW.getTime()).toBe(90 * DAY_MS);
    expect(session.isRotated()).toBe(false);
    expect(session.isRevoked()).toBe(false);
  });

  it("slides the expiry of the next session but keeps the family limit", () => {
    const first = openFamily();
    const later = new Date(NOW.getTime() + 20 * DAY_MS);

    const next = first.continueFamily({ tokenHash: "hash-2", now: later, tokenTtlDays: 30 });

    expect(next.familyId).toBe(first.familyId);
    expect(next.expiresAt.getTime()).toBe(later.getTime() + 30 * DAY_MS);
    expect(next.familyExpiresAt).toEqual(first.familyExpiresAt);
  });

  it("never lets a session outlive its family", () => {
    const first = openFamily();
    const nearTheEnd = new Date(NOW.getTime() + 80 * DAY_MS);

    const next = first.continueFamily({ tokenHash: "hash-2", now: nearTheEnd, tokenTtlDays: 30 });

    expect(next.expiresAt).toEqual(first.familyExpiresAt);
  });

  it("is expired at its expiry time", () => {
    const session = openFamily();

    expect(session.isExpired(new Date(NOW.getTime() + 30 * DAY_MS - 1))).toBe(false);
    expect(session.isExpired(new Date(NOW.getTime() + 30 * DAY_MS))).toBe(true);
  });

  it("keeps only the first 200 characters of the user agent", () => {
    const session = openFamily("x".repeat(500));

    expect(session.userAgent).toHaveLength(USER_AGENT_MAX_LENGTH);
  });
});
