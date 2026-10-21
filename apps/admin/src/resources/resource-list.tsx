"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { ReactElement } from "react";
import { ResourceFormButton } from "./resource-form-button";
import type { ResourceFormSheetProps } from "./resource-form-sheet";

export function ResourceList(props: {
  orgSlug: string;
  organizationId: string;
  resources: readonly ResourceResponse[];
  offerings: readonly OfferingResponse[];
  labels: {
    name: string;
    type: string;
    status: string;
    edit: string;
    empty: string;
  };
  sheetLabels: ResourceFormSheetProps["labels"];
  weekdayLabel: (weekday: number) => string;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {props.resources.map((resource) => (
        <li
          key={resource.resourceId}
          className="flex flex-col gap-2 rounded-md border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-body font-semibold text-primary">{resource.name}</p>
            <p className="text-small text-secondary">
              {props.labels.type}: {resource.resourceTypeKey}
            </p>
          </div>
          <ResourceFormButton
            label={props.labels.edit}
            sheetProps={{
              organizationId: props.organizationId,
              locationId: resource.locationId,
              resourceTypeKey: resource.resourceTypeKey,
              offerings: props.offerings,
              existing: resource,
              labels: props.sheetLabels,
              weekdayLabel: props.weekdayLabel,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
