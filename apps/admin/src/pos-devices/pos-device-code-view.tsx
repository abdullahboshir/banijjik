"use client";

import type { PosDeviceCreatedResponse } from "@banijjik/contracts/pos";
import { Button } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { PosDeviceAddLabels } from "./pos-devices-labels";
import { deviceTimeTextOf } from "./pos-devices-view";

export interface PosDeviceCodeViewProps {
  created: PosDeviceCreatedResponse;
  labels: PosDeviceAddLabels;
  onDone: () => void;
}

/**
 * The one-time pairing code of a new till. It lives only in this view: closing the sheet unmounts it,
 * and the API never returns the code again.
 */
export function PosDeviceCodeView({
  created,
  labels,
  onDone,
}: PosDeviceCodeViewProps): ReactElement {
  const { t, locale } = useTranslator();
  const expiresText = t("posDevices.code.expires", {
    // A client view: the person reads the expiry on the screen in front of them.
    time: deviceTimeTextOf(created.pairingExpiresAt, {
      locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-secondary">{labels.codeHint}</p>
      <div className="rounded-md border border-default bg-subtle p-4 text-center">
        <p className="text-small text-secondary">{labels.codeTitle}</p>
        <p id="pos-device-code" className="font-mono text-4xl font-semibold tracking-widest">
          {created.pairingCode}
        </p>
        <p className="text-small text-secondary">{expiresText}</p>
      </div>
      <p className="text-small text-danger">{labels.codeOnce}</p>
      <Button onClick={onDone}>{labels.done}</Button>
    </div>
  );
}
