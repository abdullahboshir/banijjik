"use client";

import {
  MAX_MODIFIER_OPTIONS,
  MODIFIER_SELECTION,
  type ModifierGroupResponse,
  type ModifierSelection,
} from "@banijjik/contracts/catalog";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { describeRules } from "./add-on-rules";
import { bodyOf, draftOf, EMPTY_OPTION, rulesOf, type GroupDraft } from "./add-on-draft";
import type { AddOnsManagerProps } from "./add-ons-manager";
import { fillLabel } from "./catalog-labels";
import { ChoiceField, TextField, ToggleField } from "./editor-fields";
import type { AddOnLabels } from "./manager-labels";
import { archiveModifierGroup, createModifierGroup, updateModifierGroup } from "./record-api";
import type { RecordAction } from "./use-record-action";

type ChangeDraft = (draft: GroupDraft) => void;

function RuleSentence(props: { draft: GroupDraft; labels: AddOnLabels }): ReactElement {
  const sentence = describeRules(rulesOf(props.draft));
  return (
    <p className="text-small text-secondary">
      {fillLabel(props.labels[`addOns.rule.${sentence.key}`], sentence.values)}
    </p>
  );
}

function OptionRow(props: {
  index: number;
  draft: GroupDraft;
  labels: AddOnLabels;
  currencySymbol: string;
  onChange: ChangeDraft;
}): ReactElement {
  const { index, draft, labels } = props;
  const option = draft.options[index] ?? EMPTY_OPTION;
  const set = (patch: Partial<typeof option>): void =>
    props.onChange({
      ...draft,
      options: draft.options.map((item, at) => (at === index ? { ...item, ...patch } : item)),
    });
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-default p-2">
      <TextField
        id={`add-on-option-${index}`}
        label={labels["addOns.optionName"]}
        value={option.name}
        onChange={(name) => set({ name })}
      />
      <TextField
        id={`add-on-price-${index}`}
        label={`${labels["addOns.optionPrice"]} (${props.currencySymbol})`}
        value={option.priceText}
        inputMode="decimal"
        onChange={(priceText) => set({ priceText })}
      />
      <Button
        variant="secondary"
        disabled={draft.options.length <= 1}
        onClick={() =>
          props.onChange({ ...draft, options: draft.options.filter((_o, at) => at !== index) })
        }
      >
        {labels["addOns.removeOption"]}
      </Button>
    </div>
  );
}

function OptionRows(props: {
  draft: GroupDraft;
  labels: AddOnLabels;
  currencySymbol: string;
  onChange: ChangeDraft;
}): ReactElement {
  const { draft, labels } = props;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body font-semibold text-primary">{labels["addOns.options"]}</h3>
      {draft.options.map((_option, index) => (
        <OptionRow key={index} index={index} {...props} />
      ))}
      <Button
        variant="secondary"
        disabled={draft.options.length >= MAX_MODIFIER_OPTIONS}
        onClick={() => props.onChange({ ...draft, options: [...draft.options, EMPTY_OPTION] })}
      >
        {labels["addOns.addOption"]}
      </Button>
    </div>
  );
}

function RuleFields(props: {
  draft: GroupDraft;
  labels: AddOnLabels;
  onChange: ChangeDraft;
}): ReactElement {
  const { draft, labels, onChange } = props;
  return (
    <>
      <ChoiceField
        id="add-on-selection"
        label={labels["addOns.selection"]}
        value={draft.selection}
        options={Object.values(MODIFIER_SELECTION).map((value) => ({
          value,
          label: labels[`addOns.selection.${value}`],
        }))}
        onChange={(value) => onChange({ ...draft, selection: value as ModifierSelection })}
      />
      <ToggleField
        label={labels["addOns.required"]}
        checked={draft.isRequired}
        onChange={(isRequired) => onChange({ ...draft, isRequired })}
      />
      {draft.selection === MODIFIER_SELECTION.MULTIPLE ? (
        <>
          <TextField
            id="add-on-min"
            label={labels["addOns.minSelect"]}
            value={draft.minSelect}
            inputMode="numeric"
            onChange={(minSelect) => onChange({ ...draft, minSelect })}
          />
          <TextField
            id="add-on-max"
            label={labels["addOns.maxSelect"]}
            value={draft.maxSelect}
            inputMode="numeric"
            onChange={(maxSelect) => onChange({ ...draft, maxSelect })}
          />
        </>
      ) : null}
      <RuleSentence draft={draft} labels={labels} />
    </>
  );
}

export interface GroupFormProps {
  manager: AddOnsManagerProps;
  group: ModifierGroupResponse | undefined;
  action: RecordAction;
  onClose: () => void;
}

/** Add or change one add-on group; the plain sentence under the rules says what customers will see. */
export function GroupForm(props: GroupFormProps): ReactElement {
  const { manager, group, action } = props;
  const { labels } = manager;
  const [draft, setDraft] = useState(() => draftOf(group));

  async function save(): Promise<void> {
    const body = bodyOf(draft, manager.currency);
    if (!body) return;
    const done = await action.run(() =>
      group
        ? updateModifierGroup(manager.organizationId, {
            modifierGroupId: group.modifierGroupId,
            version: group.version,
            body,
          })
        : createModifierGroup(manager.organizationId, body),
    );
    if (done) props.onClose();
  }

  async function archive(): Promise<void> {
    if (!group) return;
    const done = await action.run(() =>
      archiveModifierGroup(manager.organizationId, {
        modifierGroupId: group.modifierGroupId,
        version: group.version,
      }),
    );
    if (done) props.onClose();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <TextField
        id="add-on-name"
        label={labels["addOns.name"]}
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
      />
      <RuleFields draft={draft} labels={labels} onChange={setDraft} />
      <OptionRows
        draft={draft}
        labels={labels}
        currencySymbol={manager.currencySymbol}
        onChange={setDraft}
      />
      <div className="flex flex-wrap gap-2">
        <Button isLoading={action.isBusy} onClick={() => void save()}>
          {labels["addOns.save"]}
        </Button>
        {group && manager.canArchive ? (
          <Button variant="secondary" disabled={action.isBusy} onClick={() => void archive()}>
            {labels["addOns.archive"]}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={props.onClose}>
          {labels["addOns.close"]}
        </Button>
      </div>
    </div>
  );
}
