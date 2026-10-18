"use client";

import { BRANDING_RULES } from "@banijjik/contracts";
import { LogoImage, PageSection } from "@banijjik/ui";
import type { CSSProperties, ReactElement } from "react";
import type { BrandingLabels } from "./branding-labels";
import { checkColour, type BrandingFormState } from "./branding-state";

export interface BrandingPreviewProps {
  businessName: string;
  state: BrandingFormState;
  labels: BrandingLabels;
}

/** A colour shows in the preview only when it is a code the rules accept; otherwise the platform colour stays. */
function usableColour(kind: "primary" | "accent", text: string): string | undefined {
  const check = checkColour(kind, text);
  const isUsable = check.status === "ok" && BRANDING_RULES.colorPattern.test(text.trim());
  return isUsable ? text.trim() : undefined;
}

function colourStyle(
  property: "backgroundColor" | "color",
  colour: string | undefined,
): CSSProperties | undefined {
  return colour === undefined ? undefined : { [property]: colour };
}

/**
 * A sample of what a customer-facing page will look like: the logo and name, a primary button, an
 * accent link and badge. It draws the business's colours inside the card only; the admin keeps the
 * platform colours for every business's staff (ADR-114).
 */
export function BrandingPreview({
  businessName,
  state,
  labels,
}: BrandingPreviewProps): ReactElement {
  const primary = usableColour("primary", state.primaryColor);
  const accent = usableColour("accent", state.accentColor);
  const tagline = state.tagline.trim();
  return (
    <PageSection title={labels.previewTitle} help={labels.previewHelp}>
      <div
        data-testid="branding-preview"
        className="flex flex-col gap-4 rounded-md border border-default bg-surface p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          {state.logoUrl ? (
            <LogoImage
              src={state.logoUrl}
              alt={businessName}
              className="h-12 w-auto max-w-32 object-contain"
            />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-title font-semibold text-primary">{businessName}</span>
            {tagline ? <span className="text-small text-secondary">{tagline}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            data-testid="branding-preview-button"
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-body font-semibold text-on-brand"
            style={colourStyle("backgroundColor", primary)}
          >
            {labels.previewButton}
          </span>
          <span
            data-testid="branding-preview-link"
            className="text-body font-semibold text-brand underline"
            style={colourStyle("color", accent)}
          >
            {labels.previewLink}
          </span>
          <span
            data-testid="branding-preview-badge"
            className="inline-flex items-center rounded-full border border-brand px-2.5 py-0.5 text-caption font-semibold text-brand"
            style={accent === undefined ? undefined : { color: accent, borderColor: accent }}
          >
            {labels.previewBadge}
          </span>
        </div>
      </div>
    </PageSection>
  );
}
