"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Select, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import {
  ACCOUNT_TYPE,
  type AccountResponse,
  type AccountType,
  type AccountStatus,
} from "@banijjik/contracts/accounting";
import { apiFetch } from "../lib/api/api-client";
import { ACCOUNT_TYPE_LABEL, type BookkeepingLabels } from "./labels";
import type { AccountsProps } from "./accounts-view";
interface EditorProps extends AccountsProps {
  account: AccountResponse | null;
  onClose: () => void;
}
interface AccountForm {
  bn: string;
  en: string;
  type: AccountType;
  parent: string;
}
function accountWrite(
  account: AccountResponse | null,
  form: AccountForm,
  status: AccountStatus | undefined,
) {
  const name = { bn: form.bn, en: form.en };
  if (account === null)
    return {
      suffix: "",
      method: "POST" as const,
      body: {
        name,
        accountType: form.type,
        ...(form.parent === "" ? {} : { parentAccountCode: form.parent }),
      },
    };
  return {
    suffix: "/" + account.accountId,
    method: "PATCH" as const,
    body: { name, version: account.version, ...(status === undefined ? {} : { status }) },
  };
}
export default function AccountEditor(props: EditorProps): ReactElement {
  const { form, setForm, pending, error, save } = useAccountEditor(props);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <SheetContent
        title={props.account === null ? props.labels.add : props.labels.rename}
        closeLabel={props.labels.close}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={pending} className="flex flex-col gap-4">
            <AccountNames form={form} onChange={setForm} labels={props.labels} />
            {props.account === null && (
              <AccountClassification {...props} form={form} onChange={setForm} />
            )}
          </fieldset>
          {error !== "" && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? props.labels.pending : props.labels.save}
          </Button>
          <AccountArchive
            account={props.account}
            pending={pending}
            labels={props.labels}
            onSave={(status) => {
              void save(status);
            }}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
}
interface AccountFieldsProps {
  form: AccountForm;
  onChange: (form: AccountForm) => void;
  labels: BookkeepingLabels;
}
function AccountNames(props: AccountFieldsProps): ReactElement {
  return (
    <>
      {(["bn", "en"] as const).map((locale) => (
        <FormField
          key={locale}
          label={locale === "bn" ? props.labels.nameBn : props.labels.nameEn}
          htmlFor={`account-${locale}`}
        >
          <TextInput
            id={`account-${locale}`}
            value={props.form[locale]}
            onChange={(event) => props.onChange({ ...props.form, [locale]: event.target.value })}
            required
            maxLength={120}
          />
        </FormField>
      ))}
    </>
  );
}
function AccountClassification(props: AccountsProps & AccountFieldsProps): ReactElement {
  return (
    <>
      <FormField label={props.labels.type} htmlFor="account-type">
        <Select
          id="account-type"
          value={props.form.type}
          onChange={(event) =>
            props.onChange({ ...props.form, type: event.target.value as AccountType, parent: "" })
          }
        >
          {Object.values(ACCOUNT_TYPE).map((value) => (
            <option key={value} value={value}>
              {props.labels[ACCOUNT_TYPE_LABEL[value]]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={props.labels.parent} htmlFor="account-parent">
        <Select
          id="account-parent"
          value={props.form.parent}
          onChange={(event) => props.onChange({ ...props.form, parent: event.target.value })}
        >
          <option value="">{props.labels.all}</option>
          {props.accounts
            .filter(
              (account) => account.accountType === props.form.type && account.status === "ACTIVE",
            )
            .map((account) => (
              <option key={account.accountId} value={account.accountCode}>
                {account.name[props.locale]}
              </option>
            ))}
        </Select>
      </FormField>
    </>
  );
}
function AccountArchive(props: {
  account: AccountResponse | null;
  pending: boolean;
  labels: BookkeepingLabels;
  onSave: (status: AccountStatus) => void;
}): ReactElement | null {
  if (props.account === null || props.account.isSystem) return null;
  const archive = props.account.status === "ACTIVE";
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={props.pending}
      onClick={() => props.onSave(archive ? "ARCHIVED" : "ACTIVE")}
    >
      {archive ? props.labels.archive : props.labels.restore}
    </Button>
  );
}

function useAccountEditor(props: EditorProps) {
  const [form, setForm] = useState<AccountForm>({
    bn: props.account?.name.bn ?? "",
    en: props.account?.name.en ?? "",
    type: "ASSET",
    parent: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function save(status?: AccountStatus): Promise<void> {
    setPending(true);
    setError("");
    const request = accountWrite(props.account, form, status);
    try {
      await apiFetch(`/orgs/${props.organizationId}/bookkeeping/accounts${request.suffix}`, {
        method: request.method,
        body: request.body,
      });
      props.onClose();
      router.refresh();
    } catch {
      setError(props.labels.failure);
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  return { form, setForm, pending, error, save };
}
