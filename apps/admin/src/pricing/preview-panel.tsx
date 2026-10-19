"use client";

import type { QuoteResponse } from "@banijjik/contracts/pricing";
import { Button, FormField, Select } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { previewQuote } from "./pricing-api";
import type { PromotionLabels } from "./pricing-labels";

export interface PreviewOfferingChoice {
  offeringId: string;
  name: string;
  variantId: string;
}

function PreviewResult(props: {
  labels: PromotionLabels;
  quote: QuoteResponse | undefined;
  errorKey: string | undefined;
}): ReactElement | null {
  const { t } = useTranslator();
  if (props.errorKey) {
    return (
      <p role="alert" className="text-small text-danger">
        {t(knownMessageKeyOrInternal(props.errorKey))}
      </p>
    );
  }
  if (!props.quote) return null;
  return (
    <p className="text-small text-secondary">
      {props.labels["promotions.preview.total"]}: {props.quote.totals.grandTotal.amount} ·{" "}
      {props.labels["promotions.preview.discount"]}: {props.quote.totals.discountTotal.amount}
    </p>
  );
}

function PreviewFields(props: {
  labels: PromotionLabels;
  locations: readonly { locationId: string; name: string }[];
  offerings: readonly PreviewOfferingChoice[];
  locationId: string;
  offeringKey: string;
  onLocationId: (value: string) => void;
  onOfferingKey: (value: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.labels["promotions.preview.offering"]} htmlFor="preview-offering">
        <Select
          id="preview-offering"
          value={props.offeringKey}
          onChange={(e) => props.onOfferingKey(e.target.value)}
        >
          {props.offerings.map((o) => (
            <option key={`${o.offeringId}:${o.variantId}`} value={`${o.offeringId}:${o.variantId}`}>
              {o.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={props.locations[0]?.name ?? ""} htmlFor="preview-location">
        <Select
          id="preview-location"
          value={props.locationId}
          onChange={(e) => props.onLocationId(e.target.value)}
        >
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}

export function PreviewPanel(props: {
  organizationId: string;
  locations: readonly { locationId: string; name: string }[];
  offerings: readonly PreviewOfferingChoice[];
  labels: PromotionLabels;
}): ReactElement | null {
  const { labels, organizationId, locations, offerings } = props;
  const [locationId, setLocationId] = useState(locations[0]?.locationId ?? "");
  const [offeringKey, setOfferingKey] = useState(
    offerings[0] ? `${offerings[0].offeringId}:${offerings[0].variantId}` : "",
  );
  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [errorKey, setErrorKey] = useState<string | undefined>();
  if (locations.length === 0 || offerings.length === 0) return null;
  async function run(): Promise<void> {
    const [offeringId, variantId] = offeringKey.split(":");
    if (!offeringId || !variantId || locationId === "") return;
    setErrorKey(undefined);
    try {
      setQuote(
        await previewQuote(organizationId, {
          locationId,
          lines: [{ offeringId, variantId, quantity: 1 }],
        }),
      );
    } catch (error) {
      setQuote(undefined);
      setErrorKey(error instanceof ApiError ? error.messageKey : "errors.internal");
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <p className="text-body font-semibold text-primary">{labels["promotions.preview"]}</p>
      <PreviewFields
        labels={labels}
        locations={locations}
        offerings={offerings}
        locationId={locationId}
        offeringKey={offeringKey}
        onLocationId={setLocationId}
        onOfferingKey={setOfferingKey}
      />
      <Button variant="secondary" onClick={() => void run()}>
        {labels["promotions.preview.run"]}
      </Button>
      <PreviewResult labels={labels} quote={quote} errorKey={errorKey} />
    </div>
  );
}
