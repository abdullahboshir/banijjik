"use client";
import { useState, type ReactElement } from "react";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { Button, Select } from "@banijjik/ui";
import { apiFetch } from "../lib/api/api-client";
import type { BookkeepingLabels } from "./labels";
interface AccountSelectProps {
  organizationId: string;
  accounts: readonly AccountResponse[];
  labels: BookkeepingLabels;
  locale: "bn" | "en";
  inputId: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}
export function AccountSelect(props: AccountSelectProps): ReactElement {
  const { choices, hasNext, error, pending, more } = useAccountChoices(props);
  return (
    <div className="flex flex-col gap-2">
      <Select
        id={props.inputId}
        name={props.name}
        value={props.value}
        defaultValue={props.defaultValue}
        required={props.required}
        onChange={(event) => props.onChange?.(event.target.value)}
      >
        <option value="">{props.required === true ? props.labels.choose : props.labels.all}</option>
        {choices
          .filter((account) => account.status === "ACTIVE" || props.required !== true)
          .map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountCode} · {account.name[props.locale]}
            </option>
          ))}
      </Select>
      {hasNext && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            void more();
          }}
        >
          {pending ? props.labels.pending : props.labels.moreAccounts}
        </Button>
      )}
      <AccountSelectError message={error} />
    </div>
  );
}

function AccountSelectError({ message }: { message: string }): ReactElement | null {
  if (message === "") return null;
  return <p role="alert">{message}</p>;
}

function useAccountChoices(props: AccountSelectProps) {
  const [choices, setChoices] = useState(props.accounts);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(props.accounts.length >= 100);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function more(): Promise<void> {
    setPending(true);
    setError("");
    try {
      const response = await apiFetch<AccountResponse[], { hasNext: boolean }>(
        `/orgs/${props.organizationId}/bookkeeping/accounts?page=${page + 1}&limit=100`,
      );
      setChoices((current) => [
        ...new Map(
          [...current, ...response.data].map((account) => [account.accountId, account]),
        ).values(),
      ]);
      setPage(page + 1);
      setHasNext(response.meta?.hasNext === true);
    } catch {
      setError(props.labels.failure);
    } finally {
      setPending(false);
    }
  }
  return { choices, hasNext, error, pending, more };
}
