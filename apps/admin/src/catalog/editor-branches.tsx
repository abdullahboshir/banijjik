"use client";

import type { Money } from "@banijjik/contracts/catalog";
import { Button, PageSection } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { BranchState } from "./branch-changes";
import { useBranchRows } from "./use-branch-rows";
import { fillLabel, type EditorLabels } from "./catalog-labels";
import { ChoiceField, TextField, ToggleField } from "./editor-fields";

export interface BranchesProps {
  organizationId: string;
  offeringId: string;
  locations: readonly { locationId: string; name: string }[];
  variants: readonly { variantId: string; name: string }[];
  currency: Money["currency"];
  labels: EditorLabels;
  isReadOnly: boolean;
}

function VariantBranchRow(props: {
  variant: { variantId: string; name: string };
  state: BranchState["variants"][number];
  labels: EditorLabels;
  isReadOnly: boolean;
  hasError: boolean;
  onChange: (patch: Partial<BranchState["variants"][number]>) => void;
}): ReactElement {
  const { variant, state, labels, isReadOnly } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3">
      <p className="text-body font-semibold text-primary">{variant.name}</p>
      <ToggleField
        label={labels["branches.available"]}
        checked={state.isAvailable}
        disabled={isReadOnly}
        onChange={(isAvailable) => props.onChange({ isAvailable })}
      />
      <TextField
        id={`branch-price-${variant.variantId}`}
        label={fillLabel(labels["branches.variantPrice"], { name: variant.name })}
        value={state.priceText}
        inputMode="decimal"
        hint={labels["branches.priceOverrideHint"]}
        error={props.hasError ? labels["error.generic"] : undefined}
        disabled={isReadOnly}
        onChange={(priceText) => props.onChange({ priceText })}
      />
    </li>
  );
}

function BranchForm(props: BranchesProps & { locationId: string }): ReactElement {
  const { labels, variants, isReadOnly } = props;
  const { state, setState, invalid, message, isSaving, save } = useBranchRows(props);
  if (state === undefined) {
    return <p className="text-small text-secondary">{labels["editor.loading"]}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleField
        label={labels["branches.available"]}
        checked={state.isAvailable}
        disabled={isReadOnly}
        onChange={(isAvailable) => setState({ ...state, isAvailable })}
      />
      <ul className="flex flex-col gap-2">
        {variants.map((variant, index) => {
          const variantState = state.variants[index];
          if (!variantState) return null;
          return (
            <VariantBranchRow
              key={variant.variantId}
              variant={variant}
              state={variantState}
              labels={labels}
              isReadOnly={isReadOnly}
              hasError={invalid.includes(variant.variantId)}
              onChange={(patch) =>
                setState({
                  ...state,
                  variants: state.variants.map((item, at) =>
                    at === index ? { ...item, ...patch } : item,
                  ),
                })
              }
            />
          );
        })}
      </ul>
      {message ? (
        <p role="status" className="text-small text-secondary">
          {message}
        </p>
      ) : null}
      {isReadOnly ? null : (
        <Button isLoading={isSaving} onClick={() => void save()}>
          {labels["branches.save"]}
        </Button>
      )}
    </div>
  );
}

/** Per branch: turn the offering off, or give a variant its own price (ADR-005). Shown with two or more branches. */
export function EditorBranches(props: BranchesProps): ReactElement | null {
  const { labels, locations } = props;
  const [locationId, setLocationId] = useState(locations[0]?.locationId ?? "");
  if (locations.length < 2) return null;
  return (
    <PageSection title={labels["section.branches.title"]} help={labels["section.branches.help"]}>
      <ChoiceField
        id="branch-location"
        label={labels["section.branches.title"]}
        value={locationId}
        options={locations.map((location) => ({
          value: location.locationId,
          label: location.name,
        }))}
        onChange={setLocationId}
      />
      <BranchForm key={locationId} {...props} locationId={locationId} />
    </PageSection>
  );
}
