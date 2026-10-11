"use client";

import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface ConflictNoticeProps {
  message: string;
  reloadLabel: string;
  onReload: () => void;
}

/** A 409: someone else changed the record, so the person reloads before trying again (14-API section 2). */
export function ConflictNotice({
  message,
  reloadLabel,
  onReload,
}: ConflictNoticeProps): ReactElement {
  return (
    <div role="alert" className="flex flex-col gap-2 text-small text-danger">
      <p>{message}</p>
      <Button variant="secondary" onClick={onReload}>
        {reloadLabel}
      </Button>
    </div>
  );
}
