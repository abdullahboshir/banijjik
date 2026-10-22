"use client";
import { lazy, Suspense, useState, type ReactElement } from "react";
import { Button, formatMoney } from "@banijjik/ui";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { accountTree } from "./entry-form";
import { ACCOUNT_TYPE_LABEL, type BookkeepingLabels } from "./labels";
const AccountEditor = lazy(() => import("./account-editor"));
export interface AccountsProps {
  organizationId: string;
  accounts: readonly AccountResponse[];
  labels: BookkeepingLabels;
  locale: "bn" | "en";
  canCreate: boolean;
  canUpdate: boolean;
}
export function AccountsView(props: AccountsProps): ReactElement {
  const [editing, setEditing] = useState<AccountResponse | null | undefined>();
  const current =
    editing === null
      ? null
      : props.accounts.find((account) => account.accountId === editing?.accountId);
  return (
    <div className="flex flex-col gap-4">
      {props.canCreate && <Button onClick={() => setEditing(null)}>{props.labels.add}</Button>}
      {props.accounts.length === 0 && <p>{props.labels.empty}</p>}
      {accountTree(props.accounts).map(({ account, depth }) => (
        <AccountCard
          key={account.accountId}
          {...props}
          account={account}
          depth={depth}
          onEdit={() => setEditing(account)}
        />
      ))}
      {editing !== undefined && (
        <Suspense fallback={null}>
          <AccountEditor
            {...props}
            account={current ?? editing}
            onClose={() => setEditing(undefined)}
          />
        </Suspense>
      )}
    </div>
  );
}
function AccountCard(
  props: AccountsProps & { account: AccountResponse; depth: number; onEdit: () => void },
): ReactElement {
  const account = props.account;
  return (
    <article
      className="min-w-0 break-words rounded-lg border border-default p-4"
      style={{ marginInlineStart: `${Math.min(props.depth, 3)}rem` }}
    >
      <p className="text-small text-secondary">
        {props.labels[ACCOUNT_TYPE_LABEL[account.accountType]]} · {account.accountCode}
      </p>
      <h2 className="font-semibold">{account.name[props.locale]}</h2>
      <p>
        {formatMoney(account.balance ?? { amount: 0, currency: "BDT" }, { locale: props.locale })}
      </p>
      {account.isSystem && <p>{props.labels.system}</p>}
      {account.status === "ARCHIVED" && <p>{props.labels.archived}</p>}
      {props.canUpdate && (
        <Button variant="secondary" onClick={props.onEdit}>
          {props.labels.rename}
        </Button>
      )}
    </article>
  );
}
