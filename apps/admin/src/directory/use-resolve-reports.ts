"use client";

import type { ListingReportOutcome } from "@banijjik/contracts/directory";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveListingReports } from "./directory-api";
import { isStaleReportError } from "./report-resolve-state";
import { showStaleReportsToast } from "./report-stale-toast";

export interface ResolveReportsTarget {
  organizationId: string;
  listingId: string;
  /** Exactly the ids on screen: a report filed later stays open (M.7 decision 5). */
  reportIds: readonly string[];
  queueHref: string;
  staleMessage: string;
}

/** Submit state of the resolve sheet: busy, failure, and the stale-reports reload. */
export function useResolveReports(
  target: ResolveReportsTarget,
  onStale: () => void,
): {
  busy: boolean;
  failed: boolean;
  submit: (outcome: ListingReportOutcome, note: string) => Promise<void>;
} {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(outcome: ListingReportOutcome, note: string): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const trimmed = note.trim();
      await resolveListingReports(target.organizationId, target.listingId, {
        reportIds: [...target.reportIds],
        outcome,
        ...(trimmed.length === 0 ? {} : { note: trimmed }),
      });
      router.push(target.queueHref);
      router.refresh();
    } catch (error) {
      if (!isStaleReportError(error)) {
        setFailed(true);
        return;
      }
      onStale();
      await showStaleReportsToast(target.staleMessage);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return { busy, failed, submit };
}
