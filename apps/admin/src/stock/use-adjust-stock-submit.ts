"use client";

import { useMemo } from "react";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import type { AdjustLine } from "./adjust-stock-form-lib";
import { buildAdjustStockSend, postStockAdjustment } from "./build-adjust-stock-send";
import { useAdjustPinFlow } from "./use-adjust-pin-flow";

export function useAdjustStockSubmit(props: {
  organizationId: string;
  locationId: string;
  lines: AdjustLine[];
  onSuccess?: () => void;
  onClose?: () => void;
}): ReturnType<typeof useAdjustPinFlow> & { submit: ReturnType<typeof useSheetSubmit> } {
  const pin = useAdjustPinFlow({
    organizationId: props.organizationId,
    ...(props.onSuccess === undefined ? {} : { onSuccess: props.onSuccess }),
    ...(props.onClose === undefined ? {} : { onClose: props.onClose }),
  });
  const fieldNames = useMemo(
    () => [
      "locationId",
      "lines",
      ...props.lines.flatMap((_, index) => [
        `line-${index}-item`,
        `line-${index}-quantityDelta`,
        `line-${index}-reason`,
      ]),
    ],
    [props.lines],
  );
  const submit = useSheetSubmit({
    fieldNames,
    onClose: props.onClose ?? (() => undefined),
    send: () =>
      buildAdjustStockSend({
        organizationId: props.organizationId,
        locationId: props.locationId,
        lines: props.lines,
        postAdjustment: (body) => postStockAdjustment(props.organizationId, body),
        ...(props.onSuccess === undefined ? {} : { onSuccess: props.onSuccess }),
        onApprovalRequired: pin.openForApproval,
      }),
  });
  pin.bindReload(submit.reload);
  return { submit, ...pin };
}
