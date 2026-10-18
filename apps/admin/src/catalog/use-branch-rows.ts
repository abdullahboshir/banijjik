"use client";

import type { OfferingLocationResponse } from "@banijjik/contracts/catalog";
import { useEffect, useState } from "react";
import {
  branchStateOf,
  planBranchChanges,
  type BranchOperation,
  type BranchState,
} from "./branch-changes";
import type { BranchesProps } from "./editor-branches";
import { clearBranchRow, readBranchRows, saveBranchRow } from "./offering-api";

async function applyOperation(
  props: BranchesProps,
  locationId: string,
  operation: BranchOperation,
): Promise<void> {
  const { organizationId, offeringId } = props;
  const target = { offeringId, locationId, variantId: operation.variantId };
  if (operation.type === "clear") {
    await clearBranchRow(organizationId, target);
    return;
  }
  await saveBranchRow(organizationId, {
    ...target,
    isAvailable: operation.isAvailable,
    priceOverride: operation.priceOverride,
  });
}

export interface BranchRowsState {
  /** Undefined while the rows of the location are being read. */
  state: BranchState | undefined;
  setState: (state: BranchState) => void;
  invalid: readonly string[];
  message: string | undefined;
  isSaving: boolean;
  save: () => Promise<void>;
}

/** Reads the branch rows of one location and saves the differences from the defaults (ADR-005). */
export function useBranchRows(props: BranchesProps & { locationId: string }): BranchRowsState {
  const { labels, variants, locationId } = props;
  const [rows, setRows] = useState<readonly OfferingLocationResponse[]>([]);
  const [state, setState] = useState<BranchState | undefined>();
  const [invalid, setInvalid] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function load(): Promise<void> {
    const loaded = await readBranchRows(props.organizationId, props.offeringId, locationId);
    setRows(loaded);
    setState(
      branchStateOf(
        loaded,
        variants.map((variant) => variant.variantId),
      ),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(): Promise<void> {
    if (!state) return;
    const plan = planBranchChanges({ state, rows, currency: props.currency });
    setMessage(undefined);
    setInvalid(plan.ok ? [] : plan.invalidVariantIds);
    if (!plan.ok) return;
    setIsSaving(true);
    try {
      for (const operation of plan.operations) await applyOperation(props, locationId, operation);
      setMessage(labels["branches.saved"]);
      await load();
    } catch {
      setMessage(labels["error.generic"]);
    }
    setIsSaving(false);
  }

  return { state, setState, invalid, message, isSaving, save };
}
