"use client";
import type { ReactElement } from "react";

import { STORE_CREDIT_DIRECTION } from "@banijjik/contracts/payment";
import { Button, formatMoney } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { listStoreCredit } from "./store-credit-api";
import type { StoreCreditProps } from "./store-credit-types";

export function StoreCreditHistory(props: StoreCreditProps): ReactElement {
  const [loaded, setLoaded] = useState<{
    page: number;
    entries: StoreCreditProps["entries"];
    total: number;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { t } = useTranslator();
  const page = loaded?.page ?? 1;
  const entries = loaded?.entries ?? props.entries;
  const total = loaded ? loaded.total : props.total;
  async function changePage(nextPage: number): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const result = await listStoreCredit(props.organizationId, props.contactId, nextPage);
      setLoaded({ page: nextPage, entries: result.data, total: result.meta?.total ?? 0 });
    } catch (failure) {
      if (!(failure instanceof ApiError)) throw failure;
      setError(t(knownMessageKeyOrInternal(failure.messageKey)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{props.labels.history}</h3>
      {entries.length === 0 ? (
        <p>{props.labels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <HistoryEntry key={entry.storeCreditEntryId} entry={entry} {...props} />
          ))}
        </ul>
      )}
      <HistoryError error={error} />
      <div className="flex gap-3">
        {page > 1 ? (
          <Button variant="secondary" disabled={busy} onClick={() => void changePage(page - 1)}>
            {props.labels.previous}
          </Button>
        ) : null}
        {page * 20 < total ? (
          <Button variant="secondary" disabled={busy} onClick={() => void changePage(page + 1)}>
            {props.labels.next}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function HistoryEntry(
  props: StoreCreditProps & { entry: StoreCreditProps["entries"][number] },
): ReactElement {
  const { entry } = props;
  return (
    <li className="min-w-0 rounded-lg border border-default p-3">
      <p>
        {props.labels.kinds[entry.kind]} ·{" "}
        {formatMoney(
          {
            ...entry.amount,
            amount:
              entry.direction === STORE_CREDIT_DIRECTION.DEBIT
                ? -entry.amount.amount
                : entry.amount.amount,
          },
          { locale: props.locale },
        )}
      </p>
      <time dateTime={entry.createdAt}>
        {new Intl.DateTimeFormat(props.locale, {
          dateStyle: "medium",
          timeZone: props.timeZone,
        }).format(new Date(entry.createdAt))}
      </time>
      {entry.note ? <p className="break-words">{entry.note}</p> : null}
    </li>
  );
}

function HistoryError(props: { error: string | undefined }): ReactElement | null {
  return props.error ? <p role="alert">{props.error}</p> : null;
}
