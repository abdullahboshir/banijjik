"use client";

import type { CreditEntry } from "@banijjik/contracts/credit";
import { formatNumber, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import type { ContactCreditsLabels } from "./credit-labels";

function dateTextOf(iso: string, locale: DisplayLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(iso));
}

function signedCreditsOf(credits: number, locale: DisplayLocale): string {
  const text = formatNumber(Math.abs(credits), { locale });
  return credits < 0 ? `−${text}` : `+${text}`;
}

function EntryRow(props: {
  entry: CreditEntry;
  labels: ContactCreditsLabels;
  locale: DisplayLocale;
  timeZone: string;
}): ReactElement {
  const { entry, labels, locale, timeZone } = props;
  const occurred = dateTextOf(entry.occurredAt, locale, timeZone);
  const dates =
    entry.expiresOn === null
      ? occurred
      : `${occurred} · ${fillLabel(labels.expiresOn, {
          date: dateTextOf(entry.expiresOn, locale, timeZone),
        })}`;
  return (
    <li className="flex flex-col gap-1 rounded-md border border-default p-3">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body text-primary">{labels.entry[entry.type]}</span>
        <span
          className={`text-body font-semibold ${entry.credits < 0 ? "text-danger" : "text-success"}`}
        >
          {signedCreditsOf(entry.credits, locale)}
        </span>
      </span>
      <span className="text-small text-secondary">{dates}</span>
      {entry.reason ? <span className="text-small text-secondary">{entry.reason}</span> : null}
    </li>
  );
}

export function CreditEntryList(props: {
  entries: readonly CreditEntry[];
  labels: ContactCreditsLabels;
  locale: DisplayLocale;
  timeZone: string;
}): ReactElement {
  if (props.entries.length === 0) {
    return <p className="text-body text-secondary">{props.labels.empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {props.entries.map((entry) => (
        <EntryRow
          key={entry.creditEntryId}
          entry={entry}
          labels={props.labels}
          locale={props.locale}
          timeZone={props.timeZone}
        />
      ))}
    </ul>
  );
}
