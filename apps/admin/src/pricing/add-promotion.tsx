"use client";

import type { CategoryResponse } from "@banijjik/contracts/catalog";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { RecordAction } from "../catalog/use-record-action";
import { createPromotion } from "./pricing-api";
import type { PromotionLabels } from "./pricing-labels";
import { ratePercentToBasisPoints } from "./tax-classes-manager";

interface PromotionDraft {
  name: string;
  priority: string;
  scope: "ALL" | "CATEGORY";
  categoryId: string;
  percent: string;
}

function TargetFields(props: {
  labels: PromotionLabels;
  categories: readonly CategoryResponse[];
  draft: PromotionDraft;
  onChange: (patch: Partial<PromotionDraft>) => void;
}): ReactElement {
  const { labels, categories, draft, onChange } = props;
  return (
    <>
      <FormField label={labels["promotions.target"]} htmlFor="new-promotion-target">
        <Select
          id="new-promotion-target"
          value={draft.scope}
          onChange={(event) => onChange({ scope: event.target.value as "ALL" | "CATEGORY" })}
        >
          <option value="ALL">{labels["promotions.target.ALL"]}</option>
          <option value="CATEGORY">{labels["promotions.target.CATEGORY"]}</option>
        </Select>
      </FormField>
      {draft.scope === "CATEGORY" ? (
        <FormField label={labels["promotions.category"]} htmlFor="new-promotion-category">
          <Select
            id="new-promotion-category"
            value={draft.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value })}
          >
            {categories.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  );
}

function PromotionFields(props: {
  labels: PromotionLabels;
  categories: readonly CategoryResponse[];
  draft: PromotionDraft;
  onChange: (patch: Partial<PromotionDraft>) => void;
}): ReactElement {
  const { labels, draft, onChange } = props;
  return (
    <>
      <FormField label={labels["promotions.name"]} htmlFor="new-promotion-name">
        <TextInput
          id="new-promotion-name"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </FormField>
      <FormField label={labels["promotions.priority"]} htmlFor="new-promotion-priority">
        <TextInput
          id="new-promotion-priority"
          inputMode="numeric"
          value={draft.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        />
      </FormField>
      <TargetFields {...props} />
      <FormField label={labels["promotions.percent"]} htmlFor="new-promotion-percent">
        <TextInput
          id="new-promotion-percent"
          inputMode="decimal"
          value={draft.percent}
          onChange={(event) => onChange({ percent: event.target.value })}
        />
      </FormField>
    </>
  );
}

export function AddPromotion(props: {
  organizationId: string;
  categories: readonly CategoryResponse[];
  labels: PromotionLabels;
  action: RecordAction;
}): ReactElement {
  const { labels, organizationId, categories, action } = props;
  const [draft, setDraft] = useState<PromotionDraft>({
    name: "",
    priority: "10",
    scope: "CATEGORY",
    categoryId: categories[0]?.categoryId ?? "",
    percent: "10",
  });
  function patch(next: Partial<PromotionDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }
  async function save(): Promise<void> {
    const rate = ratePercentToBasisPoints(draft.percent);
    const priorityValue = Number(draft.priority);
    if (draft.name.trim() === "" || rate === undefined || !Number.isSafeInteger(priorityValue)) {
      return;
    }
    if (draft.scope === "CATEGORY" && draft.categoryId === "") return;
    const done = await action.run(() =>
      createPromotion(organizationId, {
        name: draft.name.trim(),
        priority: priorityValue,
        target:
          draft.scope === "ALL"
            ? { scope: "ALL", ids: [] }
            : { scope: "CATEGORY", ids: [draft.categoryId] },
        benefit: { type: "PERCENT", value: rate },
        isStackable: false,
        locationIds: [],
      }),
    );
    if (done) setDraft((current) => ({ ...current, name: "", percent: "10" }));
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <PromotionFields labels={labels} categories={categories} draft={draft} onChange={patch} />
      <Button onClick={() => void save()}>{labels["promotions.save"]}</Button>
    </div>
  );
}
