"use client";

import type { DeliveryAttempt } from "@banijjik/contracts/sales/delivery";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLabels } from "../order-labels";

export interface DeliveryAttemptsCardProps {
  readonly attempts: readonly DeliveryAttempt[];
  readonly labels: OrderLabels;
}

export function DeliveryAttemptsCard(props: DeliveryAttemptsCardProps): ReactElement | null {
  const { attempts, labels } = props;
  if (!attempts || attempts.length === 0) return null;

  return (
    <PageSection title={labels.attempts.title}>
      <div className="rounded-card border bg-surface p-4">
        <div className="flex flex-col divide-y">
          {attempts.map((attempt) => {
            const isFailed = attempt.failedAt !== null;
            const ref = attempt.consignmentId || attempt.deliveryAssignmentId || "—";
            return (
              <div key={attempt.deliveryAttemptId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-body">
                    {labels.attempts.ordinal} #{attempt.ordinal} ({attempt.method === "COURIER" ? labels.ship.courier : labels.ship.rider})
                  </span>
                  <span className={`text-caption ${isFailed ? "text-danger" : "text-success"}`}>
                    {isFailed ? labels.attempts.failed : labels.ship.success}
                  </span>
                </div>
                <div className="text-caption text-muted flex flex-wrap gap-4">
                  <span>Ref: {ref}</span>
                  <span>
                    {labels.attempts.started}: {new Date(attempt.startedAt).toLocaleString()}
                  </span>
                  {attempt.failedAt ? (
                    <span>
                      {labels.attempts.failed}: {new Date(attempt.failedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                {attempt.reasonKey ? (
                  <div className="text-body text-danger">
                    <span>{attempt.reasonKey}</span>
                    {attempt.note ? <span className="text-muted ml-2">— {attempt.note}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </PageSection>
  );
}
