"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { CreditPack } from "@banijjik/contracts/credit";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { RecordAction } from "../catalog/use-record-action";
import { archiveCreditPack, createCreditPack, updateCreditPack } from "./credit-api";
import { packBodyOf, packDraftOf, type PackDraft } from "./credit-form";
import type { CreditPackLabels } from "./credit-labels";

export interface PackFormManager {
  organizationId: string;
  currency: CurrencyCode;
  currencySymbol: string;
  canArchive: boolean;
  labels: CreditPackLabels;
}

export interface PackFormProps {
  manager: PackFormManager;
  pack: CreditPack | undefined;
  action: RecordAction;
  onClose: () => void;
}

function PackNameFields(props: {
  labels: CreditPackLabels;
  draft: PackDraft;
  onDraft: (draft: PackDraft) => void;
}): ReactElement {
  const { labels, draft, onDraft } = props;
  return (
    <>
      <FormField label={labels.nameBn} htmlFor="credit-pack-name-bn">
        <TextInput
          id="credit-pack-name-bn"
          value={draft.nameBn}
          onChange={(event) => onDraft({ ...draft, nameBn: event.target.value })}
        />
      </FormField>
      <FormField label={labels.nameEn} htmlFor="credit-pack-name-en">
        <TextInput
          id="credit-pack-name-en"
          value={draft.nameEn}
          onChange={(event) => onDraft({ ...draft, nameEn: event.target.value })}
        />
      </FormField>
    </>
  );
}

function PackValueFields(props: {
  labels: CreditPackLabels;
  currencySymbol: string;
  draft: PackDraft;
  onDraft: (draft: PackDraft) => void;
}): ReactElement {
  const { labels, draft, onDraft } = props;
  return (
    <>
      <FormField label={labels.credits} htmlFor="credit-pack-credits">
        <TextInput
          id="credit-pack-credits"
          inputMode="numeric"
          value={draft.creditsText}
          onChange={(event) => onDraft({ ...draft, creditsText: event.target.value })}
        />
      </FormField>
      <FormField label={`${labels.price} (${props.currencySymbol})`} htmlFor="credit-pack-price">
        <TextInput
          id="credit-pack-price"
          inputMode="decimal"
          value={draft.priceText}
          onChange={(event) => onDraft({ ...draft, priceText: event.target.value })}
        />
      </FormField>
      <FormField
        label={labels.validityDays}
        htmlFor="credit-pack-validity"
        hint={labels.validityHint}
      >
        <TextInput
          id="credit-pack-validity"
          inputMode="numeric"
          value={draft.validityDaysText}
          onChange={(event) => onDraft({ ...draft, validityDaysText: event.target.value })}
        />
      </FormField>
      <FormField label={labels.sortOrder} htmlFor="credit-pack-sort" hint={labels.sortOrderHint}>
        <TextInput
          id="credit-pack-sort"
          inputMode="numeric"
          value={draft.sortOrderText}
          onChange={(event) => onDraft({ ...draft, sortOrderText: event.target.value })}
        />
      </FormField>
    </>
  );
}

function PackFormActions(props: {
  labels: CreditPackLabels;
  isBusy: boolean;
  canArchive: boolean;
  onSave: () => void;
  onArchive: () => void;
  onClose: () => void;
}): ReactElement {
  const { labels } = props;
  return (
    <div className="flex flex-wrap gap-2">
      <Button isLoading={props.isBusy} onClick={props.onSave}>
        {labels.save}
      </Button>
      {props.canArchive ? (
        <Button variant="secondary" disabled={props.isBusy} onClick={props.onArchive}>
          {labels.archive}
        </Button>
      ) : null}
      <Button variant="secondary" onClick={props.onClose}>
        {labels.close}
      </Button>
    </div>
  );
}

async function savePack(input: {
  manager: PackFormManager;
  pack: CreditPack | undefined;
  action: RecordAction;
  draft: PackDraft;
  setShowInvalid: (show: boolean) => void;
  onSaved: () => void;
}): Promise<void> {
  const body = packBodyOf(input.draft, input.manager.currency);
  if (body === undefined) {
    input.setShowInvalid(true);
    return;
  }
  input.setShowInvalid(false);
  const done = await input.action.run(() =>
    input.pack === undefined
      ? createCreditPack(input.manager.organizationId, body)
      : updateCreditPack(input.manager.organizationId, {
          creditPackId: input.pack.creditPackId,
          version: input.pack.version,
          body,
        }),
  );
  if (done) input.onSaved();
}

async function archivePack(input: {
  manager: PackFormManager;
  pack: CreditPack | undefined;
  action: RecordAction;
  onSaved: () => void;
}): Promise<void> {
  const { pack } = input;
  if (pack === undefined) return;
  const done = await input.action.run(() =>
    archiveCreditPack(input.manager.organizationId, {
      creditPackId: pack.creditPackId,
      version: pack.version,
    }),
  );
  if (done) input.onSaved();
}

export function PackForm(props: PackFormProps): ReactElement {
  const { manager, pack, action } = props;
  const { labels } = manager;
  const [draft, setDraft] = useState<PackDraft>(() => packDraftOf(pack));
  const [showInvalid, setShowInvalid] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <PackNameFields labels={labels} draft={draft} onDraft={setDraft} />
      <PackValueFields
        labels={labels}
        currencySymbol={manager.currencySymbol}
        draft={draft}
        onDraft={setDraft}
      />
      {showInvalid ? (
        <p role="alert" className="text-small text-danger">
          {labels.invalid}
        </p>
      ) : null}
      <PackFormActions
        labels={labels}
        isBusy={action.isBusy}
        canArchive={pack !== undefined && manager.canArchive}
        onSave={() =>
          void savePack({
            manager,
            pack,
            action,
            draft,
            setShowInvalid,
            onSaved: props.onClose,
          })
        }
        onArchive={() => void archivePack({ manager, pack, action, onSaved: props.onClose })}
        onClose={props.onClose}
      />
    </div>
  );
}
