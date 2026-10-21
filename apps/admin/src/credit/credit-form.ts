import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/catalog";
import {
  CREDIT_ADJUST_REASON_MAX_LENGTH,
  type CreditPack,
  type CreditPackCreateRequest,
} from "@banijjik/contracts/credit";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";

/** The pack form as typed: numbers stay text until the body can be read (ADR-013 for the price). */
export interface PackDraft {
  nameBn: string;
  nameEn: string;
  creditsText: string;
  priceText: string;
  validityDaysText: string;
  sortOrderText: string;
}

export const NEW_PACK_DRAFT: PackDraft = {
  nameBn: "",
  nameEn: "",
  creditsText: "",
  priceText: "",
  validityDaysText: "",
  sortOrderText: "0",
};

export function packDraftOf(pack: CreditPack | undefined): PackDraft {
  if (pack === undefined) return NEW_PACK_DRAFT;
  return {
    nameBn: pack.name.bn,
    nameEn: pack.name.en,
    creditsText: String(pack.credits),
    priceText: moneyToInputText(pack.price),
    validityDaysText: pack.validityDays === null ? "" : String(pack.validityDays),
    sortOrderText: String(pack.sortOrder),
  };
}

function wholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/u.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

interface PackNumbers {
  credits: number;
  price: Money;
  validityDays: number | null;
  sortOrder: number;
}

function packNumbersOf(draft: PackDraft, currency: CurrencyCode): PackNumbers | undefined {
  const credits = wholeNumber(draft.creditsText);
  if (credits === undefined || credits <= 0) return undefined;
  const price = moneyFromInput(draft.priceText.trim(), currency);
  if (price === undefined) return undefined;
  const validityDays =
    draft.validityDaysText.trim() === "" ? null : wholeNumber(draft.validityDaysText);
  if (validityDays === undefined || (validityDays !== null && validityDays <= 0)) {
    return undefined;
  }
  const sortOrder = draft.sortOrderText.trim() === "" ? 0 : wholeNumber(draft.sortOrderText);
  if (sortOrder === undefined) return undefined;
  return { credits, price, validityDays, sortOrder };
}

/** The body to send, or undefined when a name, the credits, the price or a day count cannot be read. */
export function packBodyOf(
  draft: PackDraft,
  currency: CurrencyCode,
): CreditPackCreateRequest | undefined {
  const nameBn = draft.nameBn.trim();
  const nameEn = draft.nameEn.trim();
  if (nameBn === "" || nameEn === "") return undefined;
  const numbers = packNumbersOf(draft, currency);
  if (numbers === undefined) return undefined;
  return { name: { bn: nameBn, en: nameEn }, ...numbers };
}

export interface AdjustDraft {
  creditsText: string;
  reason: string;
}

export const EMPTY_ADJUST_DRAFT: AdjustDraft = { creditsText: "", reason: "" };

const SIGNED_INTEGER = /^[+-]?\d+$/u;

/** The adjustment body, or undefined when the amount is not a non-zero whole number or the reason is empty. */
export function adjustBodyOf(draft: AdjustDraft): { credits: number; reason: string } | undefined {
  const creditsText = draft.creditsText.trim();
  const reason = draft.reason.trim();
  if (!SIGNED_INTEGER.test(creditsText) || reason === "") return undefined;
  const credits = Number(creditsText);
  if (!Number.isSafeInteger(credits) || credits === 0) return undefined;
  if (reason.length > CREDIT_ADJUST_REASON_MAX_LENGTH) return undefined;
  return { credits, reason };
}
