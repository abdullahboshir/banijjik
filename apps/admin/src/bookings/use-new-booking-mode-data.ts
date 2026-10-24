import type { Money } from "@banijjik/contracts/catalog";
import { useEffect, useState } from "react";
import { ApiError } from "../lib/api/api-error";
import { previewQuote } from "../pricing/pricing-api";
import { listEventSessions, type EventSessionView } from "./event-session-api";
import { isPositiveWholeNumber, type NewBookingMode } from "./new-booking-mode";

/** The scheduled sessions of one event offering at one location; empty until the slot step opens. */
export function useNewBookingSessions(input: {
  mode: NewBookingMode;
  isSlotStep: boolean;
  organizationId: string;
  locationId: string;
  offeringId: string;
}): { sessions: EventSessionView[]; sessionsLoading: boolean } {
  const [sessions, setSessions] = useState<EventSessionView[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const isActive = input.mode === "EVENT" && input.isSlotStep && input.offeringId !== "";

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    async function load(): Promise<void> {
      setSessionsLoading(true);
      try {
        const rows = await listEventSessions(
          input.organizationId,
          new URLSearchParams({
            locationId: input.locationId,
            offeringId: input.offeringId,
            status: "SCHEDULED",
            limit: "100",
          }).toString(),
        );
        if (!cancelled) setSessions(rows);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isActive, input.organizationId, input.locationId, input.offeringId]);

  return { sessions, sessionsLoading };
}

/**
 * The price the quote endpoint gives for the chosen units or seats (plan 3.6b Refresh 3, item 3).
 * The browser never multiplies. A person who may not quote simply sees no price.
 */
export function useNewBookingQuote(input: {
  isEnabled: boolean;
  organizationId: string;
  locationId: string;
  offeringId: string;
  variantId: string;
  quantity: string;
}): { total: Money | null; quoteLoading: boolean } {
  const [total, setTotal] = useState<Money | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const canQuote =
    input.isEnabled &&
    input.offeringId !== "" &&
    input.variantId !== "" &&
    isPositiveWholeNumber(input.quantity);

  useEffect(() => {
    if (!canQuote) {
      setTotal(null);
      return;
    }
    let cancelled = false;
    async function load(): Promise<void> {
      setQuoteLoading(true);
      try {
        const quote = await previewQuote(input.organizationId, {
          locationId: input.locationId,
          lines: [
            {
              offeringId: input.offeringId,
              variantId: input.variantId,
              quantity: Number(input.quantity),
            },
          ],
        });
        if (!cancelled) setTotal(quote.totals.grandTotal);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (!cancelled) setTotal(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    canQuote,
    input.organizationId,
    input.locationId,
    input.offeringId,
    input.variantId,
    input.quantity,
  ]);

  return { total, quoteLoading };
}
