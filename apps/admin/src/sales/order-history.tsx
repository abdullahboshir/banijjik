import type { AuditLogSummary } from "@banijjik/contracts";
import type { Locale } from "@banijjik/i18n";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderHistoryLabels } from "./order-labels";

function dateTimeText(occurredAt: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(occurredAt));
}

/** The audit trail of one order, newest first; a caller without the audit permission gets no section. */
export function OrderHistorySection(props: {
  readonly entries: readonly AuditLogSummary[] | undefined;
  readonly labels: OrderHistoryLabels;
  readonly locale: Locale;
  readonly timeZone: string;
}): ReactElement | null {
  if (props.entries === undefined) return null;
  const { labels } = props;
  return (
    <PageSection title={labels.title}>
      {props.entries.length === 0 ? (
        <p className="text-body text-secondary">{labels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.entries.map((entry) => (
            <li
              key={entry.auditLogId}
              className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-default px-3 py-2 text-small"
            >
              <span className="text-primary">{labels.actions[entry.action] ?? entry.action}</span>
              <span className="text-secondary">
                {dateTimeText(entry.occurredAt, props.locale, props.timeZone)}
              </span>
              {entry.systemReason === undefined ? null : (
                <span className="text-caption text-secondary">
                  {labels.system}: {entry.systemReason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}
