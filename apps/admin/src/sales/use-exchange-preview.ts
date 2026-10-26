"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { SalesExchangePreviewResponse } from "@banijjik/contracts/sales";
import type { SalesExchangeRequestBody } from "@banijjik/validation/sales";
import { useEffect, useMemo, useState } from "react";
import { previewExchange } from "./exchange-api";
import { buildExchangeBody } from "./exchange-model";
import { lineInputsOfDrafts } from "./order-lines";
import { PREVIEW_PLACEHOLDER_REASON, pickedReturnLines } from "./return-model";
import {
  bodyInputOf,
  contentOf,
  invalidLineCountOf,
  type ExchangeContent,
  type ExchangeFormState,
} from "./use-exchange-sheet";
import type { OrderResponse } from "@banijjik/contracts/sales";

/** The preview request body, or undefined while the exchange is not yet complete enough to preview. */
function previewBodyOf(content: ExchangeContent, currency: CurrencyCode) {
  const hasReturn = pickedReturnLines(content.drafts).length > 0;
  const hasNewLines = lineInputsOfDrafts(content.lines).length > 0;
  if (!hasReturn || !hasNewLines || invalidLineCountOf(content.lines) > 0) return undefined;
  const reasonKey = content.reasonKey ?? PREVIEW_PLACEHOLDER_REASON;
  return buildExchangeBody(bodyInputOf(content, currency, reasonKey));
}

export type ExchangePreviewState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly preview: SalesExchangePreviewResponse };

/** The server's numbers for the exchange as it stands; the same request shape as the submit (plan 3.5b E10). */
export function useExchangePreview(input: {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly form: ExchangeFormState;
  readonly currency: CurrencyCode;
}): ExchangePreviewState {
  const previewBody = usePreviewBody(input.form, input.currency);
  return usePreviewRequest(input.organizationId, input.order.orderId, previewBody);
}

/** The request body of the preview, rebuilt only when one of its values changes (the form object is new each render). */
function usePreviewBody(
  form: ExchangeFormState,
  currency: CurrencyCode,
): SalesExchangeRequestBody | undefined {
  const {
    drafts,
    returnDeliveryCharge,
    reasonKey,
    returnNote,
    lines,
    discount,
    orderNote,
    payments,
  } = contentOf(form);
  return useMemo(
    () =>
      previewBodyOf(
        {
          drafts,
          returnDeliveryCharge,
          reasonKey,
          returnNote,
          lines,
          discount,
          orderNote,
          payments,
        },
        currency,
      ),
    [
      drafts,
      returnDeliveryCharge,
      reasonKey,
      returnNote,
      lines,
      discount,
      orderNote,
      payments,
      currency,
    ],
  );
}

/** Asks the server for the preview whenever the body changes; a stale answer is dropped. */
function usePreviewRequest(
  organizationId: string,
  orderId: string,
  previewBody: SalesExchangeRequestBody | undefined,
): ExchangePreviewState {
  const [state, setState] = useState<ExchangePreviewState>({ status: "idle" });
  useEffect(() => {
    if (previewBody === undefined) {
      setState({ status: "idle" });
      return undefined;
    }
    const body = previewBody;
    let isCurrent = true;
    setState({ status: "loading" });
    async function loadPreview(): Promise<void> {
      try {
        const preview = await previewExchange(organizationId, orderId, body);
        if (isCurrent) setState({ status: "ready", preview });
      } catch {
        if (isCurrent) setState({ status: "failed" });
      }
    }
    void loadPreview();
    return () => {
      isCurrent = false;
    };
  }, [organizationId, orderId, previewBody]);
  return state;
}

/** The preview numbers when they are ready; undefined while loading, failed or not requested. */
export function readyPreviewOf(
  state: ExchangePreviewState,
): SalesExchangePreviewResponse | undefined {
  return state.status === "ready" ? state.preview : undefined;
}
