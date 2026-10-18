import {
  BRAND_COLOR_PRESETS,
  BRANDING_RULES,
  type OrganizationProfileResponse,
} from "@banijjik/contracts";
import type { ProfileUpdateBody } from "@banijjik/validation";
import { contrastRatio, isReadablePrimaryColor, isVisibleAccentColor } from "@banijjik/validation";
import type { FieldErrors } from "../auth/field-errors";

const WHITE = "#ffffff";
const RATIO_DIGITS = 1;
export const INVALID_COLOUR_KEY = "branding.colours.invalid";
const LOW_CONTRAST_KEY = "validation.color_low_contrast";

export type ColourKind = "primary" | "accent";

/** What the form holds. A colour is the text in its box, so a half-typed code is still a state. */
export interface BrandingFormState {
  logoFileId: string | undefined;
  /** Where the logo shows in the preview: the stored logo's address, or the one just uploaded. */
  logoUrl: string | undefined;
  primaryColor: string;
  accentColor: string;
  tagline: string;
}

export type BrandingResponse = OrganizationProfileResponse["branding"];

export function brandingToFormState(
  branding: BrandingResponse,
  apiBaseUrl: string,
): BrandingFormState {
  return {
    logoFileId: branding.logoFileId,
    logoUrl: branding.logoUrl === undefined ? undefined : `${apiBaseUrl}${branding.logoUrl}`,
    primaryColor: branding.primaryColor ?? "",
    accentColor: branding.accentColor ?? "",
    tagline: branding.tagline ?? "",
  };
}

export type ColourCheck =
  | { status: "unset" }
  | { status: "invalid" }
  | { status: "ok"; ratio: string }
  | { status: "low"; ratio: string };

function isHexColour(text: string): boolean {
  return BRANDING_RULES.colorPattern.test(text);
}

/** How a colour box reads right now: empty, not a code, readable on white, or too pale (the same helper as the API). */
export function checkColour(kind: ColourKind, text: string): ColourCheck {
  const colour = text.trim();
  if (colour === "") return { status: "unset" };
  if (!isHexColour(colour)) return { status: "invalid" };
  const isAllowed =
    kind === "primary" ? isReadablePrimaryColor(colour) : isVisibleAccentColor(colour);
  const ratio = contrastRatio(colour, WHITE).toFixed(RATIO_DIGITS);
  return isAllowed ? { status: "ok", ratio } : { status: "low", ratio };
}

/** The preset whose two colours are the form's, if any, so its swatch shows as chosen. */
export function matchingPresetKey(state: BrandingFormState): string | undefined {
  const primary = state.primaryColor.trim().toLowerCase();
  const accent = state.accentColor.trim().toLowerCase();
  return BRAND_COLOR_PRESETS.find(
    (preset) => preset.primaryColor === primary && preset.accentColor === accent,
  )?.presetKey;
}

type BrandingUpdate = NonNullable<ProfileUpdateBody["branding"]>;

export type BrandingUpdateResult =
  { ok: true; branding: BrandingUpdate | undefined } | { ok: false; fieldErrors: FieldErrors };

function colourErrorKey(kind: ColourKind, text: string): string | undefined {
  const check = checkColour(kind, text);
  if (check.status === "invalid") return INVALID_COLOUR_KEY;
  return check.status === "low" ? LOW_CONTRAST_KEY : undefined;
}

function changedText(current: string, initial: string): string | null | undefined {
  const next = current.trim().toLowerCase();
  if (next === initial.trim().toLowerCase()) return undefined;
  return next === "" ? null : next;
}

function colourFieldErrors(current: BrandingFormState): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const primaryError = colourErrorKey("primary", current.primaryColor);
  const accentError = colourErrorKey("accent", current.accentColor);
  if (primaryError) fieldErrors["primaryColor"] = primaryError;
  if (accentError) fieldErrors["accentColor"] = accentError;
  return fieldErrors;
}

function changedTagline(current: string, initial: string): string | null | undefined {
  const next = current.trim();
  if (next === initial.trim()) return undefined;
  return next === "" ? null : next;
}

function changesOf(current: BrandingFormState, initial: BrandingFormState): BrandingUpdate {
  const update: BrandingUpdate = {};
  const primaryColor = changedText(current.primaryColor, initial.primaryColor);
  const accentColor = changedText(current.accentColor, initial.accentColor);
  const tagline = changedTagline(current.tagline, initial.tagline);
  if (primaryColor !== undefined) update.primaryColor = primaryColor;
  if (accentColor !== undefined) update.accentColor = accentColor;
  if (tagline !== undefined) update.tagline = tagline;
  if (current.logoFileId !== initial.logoFileId) update.logoFileId = current.logoFileId ?? null;
  return update;
}

/**
 * The `branding` of a profile update, with only the keys that changed: a value sets, `null` clears.
 * `branding: undefined` means nothing changed. A colour the API would refuse is caught here with the
 * same helper, so the person sees the message beside the box before anything is sent.
 */
export function buildBrandingUpdate(
  current: BrandingFormState,
  initial: BrandingFormState,
): BrandingUpdateResult {
  const fieldErrors = colourFieldErrors(current);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const update = changesOf(current, initial);
  return { ok: true, branding: Object.keys(update).length === 0 ? undefined : update };
}
