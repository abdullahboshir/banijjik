"use client";

import { SMS_OUTCOME, type SmsOutcome } from "@banijjik/contracts/sms";
import { Button, PageSection, type DisplayLocale } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { SourceBadge, type BadgeTone } from "../settings/source-badge";
import { fetchSmsLogs, type SmsLogItem, type SmsLogPage } from "./sms-api";
import type { LogLabels, SmsSettingsLabels } from "./sms-labels";

export interface SmsLogsProps {
  organizationId: string;
  labels: SmsSettingsLabels;
  locale: DisplayLocale;
  timeZone: string;
}

const OUTCOME_TONE: Record<SmsOutcome, BadgeTone> = {
  [SMS_OUTCOME.SENT]: "info",
  [SMS_OUTCOME.REFUSED]: "warning",
  [SMS_OUTCOME.SKIPPED_DAILY_LIMIT]: "warning",
  [SMS_OUTCOME.SKIPPED_MONTHLY_LIMIT]: "warning",
  [SMS_OUTCOME.NOT_CONFIGURED]: "neutral",
};

interface LogsState {
  items: SmsLogItem[];
  nextCursor: string | null;
  isLoading: boolean;
  hasFailed: boolean;
}

const EMPTY_LOGS: LogsState = { items: [], nextCursor: null, isLoading: true, hasFailed: false };

function timeTextOf(iso: string, locale: "bn" | "en", timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

function LogCard(props: {
  item: SmsLogItem;
  labels: SmsSettingsLabels;
  locale: DisplayLocale;
  timeZone: string;
}): ReactElement {
  const { item, labels, locale, timeZone } = props;
  const digitsText = fillLabel(labels.logs.digits, { digits: item.phoneLastDigits });
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small text-secondary">
          {timeTextOf(item.createdAt, locale, timeZone)}
        </span>
        <SourceBadge label={labels.outcomeNames[item.outcome]} tone={OUTCOME_TONE[item.outcome]} />
      </div>
      <p className="text-body font-semibold text-primary">{labels.purposeNames[item.purpose]}</p>
      <p className="text-small text-secondary">{digitsText}</p>
      {item.failureReason === null ? null : (
        <p className="text-small text-danger">{labels.failureNames[item.failureReason]}</p>
      )}
    </li>
  );
}

/** One page of the last sends. Each card shows the time, purpose, last three digits and outcome, never the text. */
export function SmsLogs(props: SmsLogsProps): ReactElement {
  const { organizationId, labels, locale, timeZone } = props;
  const [logs, setLogs] = useState<LogsState>(EMPTY_LOGS);
  const [isMoreLoading, setIsMoreLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    async function load(): Promise<void> {
      const next = await loadFirstPage(organizationId, () => isCurrent);
      if (next !== undefined) setLogs(next);
    }
    void load();
    return () => {
      isCurrent = false;
    };
  }, [organizationId]);

  async function loadMore(): Promise<void> {
    if (logs.nextCursor === null) return;
    setIsMoreLoading(true);
    try {
      const page = await fetchSmsLogs(organizationId, logs.nextCursor);
      setLogs((previous) => ({
        ...previous,
        items: [...previous.items, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch {
      setLogs((previous) => ({ ...previous, hasFailed: true }));
    }
    setIsMoreLoading(false);
  }

  return (
    <PageSection title={labels.logs.title} help={labels.logs.help}>
      <LogsBody logs={logs} logLabels={labels.logs} />
      <LogCards items={logs.items} labels={labels} locale={locale} timeZone={timeZone} />
      {logs.nextCursor === null || logs.isLoading ? null : (
        <Button
          variant="secondary"
          className="min-h-11 w-full"
          isLoading={isMoreLoading}
          disabled={isMoreLoading}
          onClick={() => void loadMore()}
        >
          {labels.logs.more}
        </Button>
      )}
    </PageSection>
  );
}

/** The first page, or undefined when the screen has moved on (the business changed) or the call failed. */
async function loadFirstPage(
  organizationId: string,
  isCurrent: () => boolean,
): Promise<LogsState | undefined> {
  try {
    const page = await fetchSmsLogs(organizationId, null);
    return isCurrent() ? logsFromPage(page) : undefined;
  } catch {
    return isCurrent() ? { ...EMPTY_LOGS, isLoading: false, hasFailed: true } : undefined;
  }
}

function logsFromPage(page: SmsLogPage): LogsState {
  return { items: page.items, nextCursor: page.nextCursor, isLoading: false, hasFailed: false };
}

function LogsBody(props: { logs: LogsState; logLabels: LogLabels }): ReactElement | null {
  const { logs, logLabels } = props;
  if (logs.isLoading) return <p className="text-small text-secondary">{logLabels.loading}</p>;
  if (logs.hasFailed) return <p className="text-small text-danger">{logLabels.failed}</p>;
  if (logs.items.length === 0)
    return <p className="text-small text-secondary">{logLabels.empty}</p>;
  return null;
}

function LogCards(props: {
  items: SmsLogItem[];
  labels: SmsSettingsLabels;
  locale: DisplayLocale;
  timeZone: string;
}): ReactElement | null {
  if (props.items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {props.items.map((item) => (
        <LogCard
          key={item.smsLogId}
          item={item}
          labels={props.labels}
          locale={props.locale}
          timeZone={props.timeZone}
        />
      ))}
    </ul>
  );
}
