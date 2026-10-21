"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import type { ResourceFormState } from "./resource-form";

export function ResourceFormOfferingsField(props: {
  offerings: readonly OfferingResponse[];
  form: ResourceFormState;
  label: string;
  onFormChange: (update: (current: ResourceFormState) => ResourceFormState) => void;
}): ReactElement {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small text-secondary">{props.label}</legend>
      {props.offerings.map((offering) => (
        <label key={offering.offeringId} className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={props.form.offeringIds.includes(offering.offeringId)}
            onChange={(event) => {
              props.onFormChange((current) => ({
                ...current,
                offeringIds: event.target.checked
                  ? [...current.offeringIds, offering.offeringId]
                  : current.offeringIds.filter((id) => id !== offering.offeringId),
              }));
            }}
          />
          <span>{offering.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
