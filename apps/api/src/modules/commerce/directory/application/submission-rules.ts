import { createHash } from "node:crypto";
import type { IndustryTemplateDirectoryBlock } from "@banijjik/contracts/directory";
import type { ListingConsentAccepted } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { consentRequired, phoneMustDiffer, underMinAge } from "../domain/errors.js";

function ageYearsAt(dateOfBirth: string, now: Date): number {
  const born = new Date(`${dateOfBirth}T00:00:00.000Z`);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const month = now.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export function consentHash(text: { readonly bn: string; readonly en: string }): string {
  return createHash("sha256").update(`${text.bn}\n${text.en}`).digest("hex");
}

function assertAgeAndPhone(input: {
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly fields: readonly CustomFieldRule[];
  readonly accountPhoneE164: string | undefined;
  readonly now: Date;
}): void {
  for (const field of input.fields) {
    if (field.minAgeYears !== undefined) {
      const value = input.customFields[field.fieldKey];
      if (typeof value !== "string" || ageYearsAt(value, input.now) < field.minAgeYears) {
        throw underMinAge(field.fieldKey);
      }
    }
    if (field.mustDifferFromAccountPhone !== true) continue;
    const value = input.customFields[field.fieldKey];
    if (
      typeof value === "string" &&
      input.accountPhoneE164 !== undefined &&
      value === input.accountPhoneE164
    ) {
      throw phoneMustDiffer(field.fieldKey);
    }
  }
}

export function assertSubmissionRules(input: {
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly fields: readonly CustomFieldRule[];
  readonly accountPhoneE164: string | undefined;
  readonly consents: readonly { readonly consentKey: string }[];
  readonly directory: IndustryTemplateDirectoryBlock | undefined;
  readonly now: Date;
}): readonly ListingConsentAccepted[] {
  assertAgeAndPhone(input);
  const required = input.directory?.consents ?? [];
  const acceptedKeys = new Set(input.consents.map((consent) => consent.consentKey));
  if (required.some((consent) => !acceptedKeys.has(consent.consentKey))) {
    throw consentRequired();
  }
  const nowIso = input.now.toISOString();
  return required
    .filter((consent) => acceptedKeys.has(consent.consentKey))
    .map((consent) => ({
      consentKey: consent.consentKey,
      textVersionHash: consentHash(consent.text),
      acceptedAt: nowIso,
    }));
}

export function finalReasonKeysOf(
  directory: IndustryTemplateDirectoryBlock | undefined,
): ReadonlySet<string> {
  return new Set(
    (directory?.rejectionReasons ?? [])
      .filter((reason) => reason.isFinal)
      .map((reason) => reason.reasonKey),
  );
}
