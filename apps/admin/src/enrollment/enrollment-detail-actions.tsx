"use client";
import type { EnrollmentDetailResponse } from "@banijjik/contracts/enrollment";
import { Button } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { transitionEnrollment } from "./enrollment-api";
export function EnrollmentDetailActions({
  organizationId,
  enrollment,
}: {
  organizationId: string;
  enrollment: EnrollmentDetailResponse;
}): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (action: string) => {
    setBusy(true);
    try {
      await transitionEnrollment({
        organizationId,
        enrollmentId: enrollment.enrollmentId,
        action,
        version: enrollment.version,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  const handleAction = (action: string) => {
    void run(action);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {["activate", "freeze", "unfreeze", "renew", "cancel"].map((action) => (
        <Button key={action} disabled={busy} onClick={() => handleAction(action)}>
          {action}
        </Button>
      ))}
    </div>
  );
}
