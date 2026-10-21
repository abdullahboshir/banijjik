import type { CreditPack } from "@banijjik/contracts/credit";
import { CREDIT_ADJUST_REASON_MAX_LENGTH } from "@banijjik/contracts/credit";
import { describe, expect, it } from "vitest";
import {
  adjustBodyOf,
  NEW_PACK_DRAFT,
  packBodyOf,
  packDraftOf,
  type PackDraft,
} from "./credit-form";

const VALID_DRAFT: PackDraft = {
  ...NEW_PACK_DRAFT,
  nameBn: "স্টার্টার",
  nameEn: "Starter",
  creditsText: "10",
  priceText: "120",
  validityDaysText: "30",
};

const PACK: CreditPack = {
  creditPackId: "pack-1",
  name: { bn: "স্টার্টার", en: "Starter" },
  credits: 10,
  price: { amount: 12000, currency: "BDT" },
  validityDays: 30,
  status: "ACTIVE",
  sortOrder: 2,
  version: 3,
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T08:00:00.000Z",
};

describe("the pack form", () => {
  it("reads into the body the API takes, with the price in minor units", () => {
    expect(packBodyOf(VALID_DRAFT, "BDT")).toEqual({
      name: { bn: "স্টার্টার", en: "Starter" },
      credits: 10,
      price: { amount: 12000, currency: "BDT" },
      validityDays: 30,
      sortOrder: 0,
    });
  });

  it("leaves the validity open when the field is empty", () => {
    expect(packBodyOf({ ...VALID_DRAFT, validityDaysText: "  " }, "BDT")).toMatchObject({
      validityDays: null,
    });
  });

  it("defaults the sort order to zero when it is empty", () => {
    expect(packBodyOf({ ...VALID_DRAFT, sortOrderText: "" }, "BDT")).toMatchObject({
      sortOrder: 0,
    });
  });

  it.each<[string, Partial<PackDraft>]>([
    ["a missing Bangla name", { nameBn: " " }],
    ["a missing English name", { nameEn: "" }],
    ["empty credits", { creditsText: "" }],
    ["zero credits", { creditsText: "0" }],
    ["fractional credits", { creditsText: "1.5" }],
    ["a negative price", { priceText: "-1" }],
    ["too many price decimals", { priceText: "12.345" }],
    ["a zero day count", { validityDaysText: "0" }],
    ["a fractional day count", { validityDaysText: "1.5" }],
    ["an unreadable sort order", { sortOrderText: "first" }],
  ])("refuses %s", (_case, change) => {
    expect(packBodyOf({ ...VALID_DRAFT, ...change }, "BDT")).toBeUndefined();
  });

  it("shows a stored pack as typed text", () => {
    expect(packDraftOf(PACK)).toEqual({
      nameBn: "স্টার্টার",
      nameEn: "Starter",
      creditsText: "10",
      priceText: "120",
      validityDaysText: "30",
      sortOrderText: "2",
    });
  });

  it("starts a new pack from the empty draft", () => {
    expect(packDraftOf(undefined)).toBe(NEW_PACK_DRAFT);
  });
});

describe("the adjustment form", () => {
  it("reads a positive or negative whole number with its reason", () => {
    expect(adjustBodyOf({ creditsText: "+5", reason: " ভালো সেবা " })).toEqual({
      credits: 5,
      reason: "ভালো সেবা",
    });
    expect(adjustBodyOf({ creditsText: "-3", reason: "ফেরত" })).toEqual({
      credits: -3,
      reason: "ফেরত",
    });
  });

  it.each<[string, { creditsText: string; reason: string }]>([
    ["an empty amount", { creditsText: "", reason: "ফেরত" }],
    ["zero", { creditsText: "0", reason: "ফেরত" }],
    ["a fraction", { creditsText: "1.5", reason: "ফেরত" }],
    ["an empty reason", { creditsText: "5", reason: " " }],
    [
      "a reason that is too long",
      { creditsText: "5", reason: "ক".repeat(CREDIT_ADJUST_REASON_MAX_LENGTH + 1) },
    ],
  ])("refuses %s", (_case, draft) => {
    expect(adjustBodyOf(draft)).toBeUndefined();
  });
});
