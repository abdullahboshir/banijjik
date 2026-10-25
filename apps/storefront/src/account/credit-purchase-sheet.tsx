"use client";

import type { CreditPack, CreditPaymentMethodSetting } from "@banijjik/contracts/credit";
import { newId } from "@banijjik/ids";
import type { Locale } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";

export interface CreditPurchaseSheetProps {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly packs: readonly CreditPack[];
  readonly methods: readonly CreditPaymentMethodSetting[];
}

export interface PurchaseDraft {
  readonly creditPackId: string;
  readonly method: string;
  readonly senderPhone: string;
  readonly transactionReference: string;
}

type Translate = (key: string) => string;

/**
 * Buys a pack by a mobile transfer: the customer sends the money, then gives the sender number and the
 * transfer reference. The purchase stays PENDING until staff verify it. The Idempotency-Key is kept for
 * a retry of the same submit, so a slow network does not buy twice.
 */
export function CreditPurchaseSheet(props: CreditPurchaseSheetProps): ReactElement {
  const t = translatorFor(props.locale).t;
  const [draft, setDraft] = useState<PurchaseDraft>({
    creditPackId: props.packs[0]?.creditPackId ?? "",
    method: props.methods[0]?.method ?? "",
    senderPhone: "",
    transactionReference: "",
  });
  const submit = usePurchaseSubmit(props.organizationId, t);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit.send(draft);
      }}
    >
      <PurchaseFields {...props} draft={draft} onChange={setDraft} t={t} />
      {submit.message ? (
        <p role="alert" className="text-body text-danger">
          {submit.message}
        </p>
      ) : null}
      <Button type="submit" variant="primary" isLoading={submit.isBusy}>
        {t("storefront.credits.submitPurchase")}
      </Button>
    </form>
  );
}

function PurchaseFields({
  packs,
  methods,
  locale,
  draft,
  onChange,
  t,
}: CreditPurchaseSheetProps & {
  readonly draft: PurchaseDraft;
  readonly onChange: (draft: PurchaseDraft) => void;
  readonly t: Translate;
}): ReactElement {
  return (
    <>
      <FormField label={t("storefront.credits.packLabel")} htmlFor="purchase-pack">
        <Select
          id="purchase-pack"
          name="creditPackId"
          value={draft.creditPackId}
          onChange={(event) => onChange({ ...draft, creditPackId: event.target.value })}
        >
          {packs.map((pack) => (
            <option key={pack.creditPackId} value={pack.creditPackId}>
              {localizedText(pack.name, locale)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t("storefront.credits.methodLabel")} htmlFor="purchase-method">
        <Select
          id="purchase-method"
          name="method"
          value={draft.method}
          onChange={(event) => onChange({ ...draft, method: event.target.value })}
        >
          {methods.map((method) => (
            <option key={method.method} value={method.method}>
              {method.method} · {method.accountNumber}
            </option>
          ))}
        </Select>
      </FormField>
      <TransferTextFields draft={draft} onChange={onChange} t={t} />
    </>
  );
}

/** The sender number and the transfer reference the business checks against its own statement. */
function TransferTextFields({
  draft,
  onChange,
  t,
}: {
  readonly draft: PurchaseDraft;
  readonly onChange: (draft: PurchaseDraft) => void;
  readonly t: Translate;
}): ReactElement {
  return (
    <>
      <FormField
        label={t("storefront.credits.senderPhoneLabel")}
        htmlFor="purchase-sender"
        required
      >
        <TextInput
          id="purchase-sender"
          name="senderPhone"
          type="tel"
          inputMode="tel"
          value={draft.senderPhone}
          onChange={(event) => onChange({ ...draft, senderPhone: event.target.value })}
        />
      </FormField>
      <FormField
        label={t("storefront.credits.referenceLabel")}
        htmlFor="purchase-reference"
        required
      >
        <TextInput
          id="purchase-reference"
          name="transactionReference"
          value={draft.transactionReference}
          onChange={(event) => onChange({ ...draft, transactionReference: event.target.value })}
        />
      </FormField>
    </>
  );
}

/** The submit: one Idempotency-Key per distinct draft, cleared after a success. */
function usePurchaseSubmit(organizationId: string, t: Translate) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const keyRef = useRef<{ readonly key: string; readonly fingerprint: string } | undefined>(
    undefined,
  );

  function keyFor(fingerprint: string): string {
    if (keyRef.current?.fingerprint === fingerprint) return keyRef.current.key;
    const key = newId();
    keyRef.current = { key, fingerprint };
    return key;
  }

  async function send(draft: PurchaseDraft): Promise<void> {
    setIsBusy(true);
    setMessage(undefined);
    const result = await callStorefront("POST", `/orgs/${organizationId}/credit-purchases`, {
      body: draft,
      idempotencyKey: keyFor(JSON.stringify(draft)),
    });
    setIsBusy(false);
    if (!result.ok) return setMessage(t("storefront.credits.purchaseFailed"));
    keyRef.current = undefined;
    router.push("/my/credits?purchased=1");
  }

  return { isBusy, message, send };
}
