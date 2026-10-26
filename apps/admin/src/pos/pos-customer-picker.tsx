"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ContactListItem } from "@banijjik/contracts/contact";
import { Button, formatMoney, TextInput, type DisplayLocale } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import type { PosCustomerLabels } from "./pos-labels";
import { fetchStoreCreditBalanceMinor, searchTillCustomers } from "./pos-customer-api";
import type { TillCustomer } from "./till-customer";

export interface PosCustomerPickerProps {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosCustomerLabels;
  readonly customer: TillCustomer | null;
  readonly onChange: (customer: TillCustomer | null) => void;
}

function nameOf(contact: ContactListItem): string {
  return contact.name ?? contact.phoneE164 ?? contact.contactId;
}

function MatchList(props: {
  readonly matches: readonly ContactListItem[];
  readonly noMatchText: string;
  readonly onChoose: (contact: ContactListItem) => void;
}): ReactElement {
  const { matches, noMatchText, onChoose } = props;
  if (matches.length === 0) return <p className="text-body text-secondary">{noMatchText}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((contact) => (
        <li key={contact.contactId}>
          <Button
            variant="secondary"
            className="min-h-14 w-full justify-start"
            onClick={() => onChoose(contact)}
          >
            {nameOf(contact)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AttachedCustomer(props: {
  readonly customer: TillCustomer;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosCustomerLabels;
  readonly onRemove: () => void;
}): ReactElement {
  const { customer, currency, locale, labels, onRemove } = props;
  const balanceText = formatMoney({ amount: customer.balanceMinor, currency }, { locale });
  return (
    <div className="flex flex-col gap-2 rounded-md border border-current p-3">
      <p className="text-body font-semibold text-primary">{customer.name}</p>
      <p className="text-body text-secondary">{`${labels.balance}: ${balanceText}`}</p>
      <Button variant="secondary" className="min-h-14" onClick={onRemove}>
        {labels.remove}
      </Button>
    </div>
  );
}

/** The phone (or name) field and its Find button. */
function FindForm(props: {
  readonly labels: PosCustomerLabels;
  readonly phoneText: string;
  readonly onPhoneChange: (text: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
  const { labels, phoneText, onPhoneChange, onSubmit } = props;
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <TextInput
        type="tel"
        inputMode="tel"
        aria-label={labels.phone}
        placeholder={labels.phone}
        value={phoneText}
        onChange={(event) => onPhoneChange(event.target.value)}
        className="min-h-14 flex-1"
      />
      <Button type="submit" variant="secondary" className="min-h-14">
        {labels.find}
      </Button>
    </form>
  );
}

/**
 * Finds the customer by phone (or name) and attaches them to the sale. Their store credit balance is
 * read once when they are chosen; the server checks any credit the sale uses.
 */
export function PosCustomerPicker(props: PosCustomerPickerProps): ReactElement {
  const { organizationId, currency, locale, labels, customer, onChange } = props;
  const [phoneText, setPhoneText] = useState("");
  const [matches, setMatches] = useState<readonly ContactListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleFind(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (phoneText.trim().length === 0) return;
    setFailed(false);
    try {
      setMatches(await searchTillCustomers(organizationId, phoneText));
    } catch {
      setFailed(true);
    }
  }

  async function handleChoose(contact: ContactListItem): Promise<void> {
    setFailed(false);
    try {
      const balanceMinor = await fetchStoreCreditBalanceMinor(organizationId, contact.contactId);
      onChange({ contactId: contact.contactId, name: nameOf(contact), balanceMinor });
      setMatches(null);
    } catch {
      setFailed(true);
    }
  }

  if (customer) {
    return (
      <AttachedCustomer
        customer={customer}
        currency={currency}
        locale={locale}
        labels={labels}
        onRemove={() => onChange(null)}
      />
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-body font-semibold text-primary">{labels.title}</h3>
      <FindForm
        labels={labels}
        phoneText={phoneText}
        onPhoneChange={setPhoneText}
        onSubmit={(event) => void handleFind(event)}
      />
      {failed ? (
        <p role="alert" className="text-body text-danger">
          {labels.failed}
        </p>
      ) : null}
      {matches ? (
        <MatchList
          matches={matches}
          noMatchText={labels.noMatch}
          onChoose={(contact) => void handleChoose(contact)}
        />
      ) : null}
    </section>
  );
}
