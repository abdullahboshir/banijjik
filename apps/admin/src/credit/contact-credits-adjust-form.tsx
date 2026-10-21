"use client";

import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { AdjustDraft } from "./credit-form";
import type { ContactCreditsLabels } from "./credit-labels";

export interface ContactCreditsLocation {
  locationId: string;
  name: string;
}

export interface AdjustFormProps {
  labels: ContactCreditsLabels;
  draft: AdjustDraft;
  onDraft: (draft: AdjustDraft) => void;
  needsApproval: boolean;
  locations: readonly ContactCreditsLocation[];
  locationId: string;
  onLocation: (locationId: string) => void;
  isBusy: boolean;
  errorMessage: string | undefined;
  notice: string | undefined;
  onSubmit: () => void;
}

function ApprovalLocationField(props: {
  labels: ContactCreditsLabels;
  locations: readonly ContactCreditsLocation[];
  locationId: string;
  onLocation: (locationId: string) => void;
}): ReactElement {
  return (
    <FormField
      label={props.labels.location}
      htmlFor="credit-adjust-location"
      hint={props.labels.locationHelp}
    >
      <Select
        id="credit-adjust-location"
        value={props.locationId}
        onChange={(event) => props.onLocation(event.target.value)}
      >
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function AdjustFeedback(props: {
  errorMessage: string | undefined;
  notice: string | undefined;
}): ReactElement | null {
  if (props.errorMessage) {
    return (
      <p role="alert" className="text-small text-danger">
        {props.errorMessage}
      </p>
    );
  }
  if (props.notice) {
    return (
      <p role="status" className="text-small text-success">
        {props.notice}
      </p>
    );
  }
  return null;
}

export function AdjustForm(props: AdjustFormProps): ReactElement {
  const { labels, draft, onDraft } = props;
  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-default p-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <h3 className="text-body font-semibold text-primary">{labels.adjust}</h3>
      <FormField
        label={labels.adjustCredits}
        htmlFor="credit-adjust-amount"
        hint={labels.adjustHint}
      >
        <TextInput
          id="credit-adjust-amount"
          inputMode="text"
          value={draft.creditsText}
          onChange={(event) => onDraft({ ...draft, creditsText: event.target.value })}
        />
      </FormField>
      <FormField label={labels.adjustReason} htmlFor="credit-adjust-reason">
        <TextInput
          id="credit-adjust-reason"
          value={draft.reason}
          onChange={(event) => onDraft({ ...draft, reason: event.target.value })}
        />
      </FormField>
      {props.needsApproval ? (
        <ApprovalLocationField
          labels={labels}
          locations={props.locations}
          locationId={props.locationId}
          onLocation={props.onLocation}
        />
      ) : null}
      <AdjustFeedback errorMessage={props.errorMessage} notice={props.notice} />
      <div>
        <Button type="submit" isLoading={props.isBusy}>
          {labels.adjustSubmit}
        </Button>
      </div>
    </form>
  );
}
