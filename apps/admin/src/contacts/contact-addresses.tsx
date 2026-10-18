"use client";

import type { ContactAddress } from "@banijjik/contracts/contact";
import { Button, PageSection } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactElement } from "react";
import { addressesWithDefault } from "./address-list";
import type { AddressLabels, AddressSheetProps } from "./address-sheet";
import { updateContact } from "./contact-api";

export interface ContactAddressesLabels extends AddressLabels {
  title: string;
  help: string;
  empty: string;
  add: string;
  edit: string;
  defaultMark: string;
  makeDefault: string;
}

export interface ContactAddressesProps {
  organizationId: string;
  contactId: string;
  version: number;
  addresses: ContactAddress[];
  /** False for an archived contact or a person who may not edit: the list is read-only. */
  canEdit: boolean;
  labels: ContactAddressesLabels;
}

async function loadSheet(): Promise<ComponentType<AddressSheetProps>> {
  const sheetModule = await import("./address-sheet");
  return sheetModule.AddressSheet;
}

function lineOf(address: ContactAddress): string {
  return [address.line1, address.area, address.thana, address.district, address.postalCode]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
}

/** The sheet's target: a new address, or one being edited. */
type Target = { address?: ContactAddress };

function AddressCard(props: {
  address: ContactAddress;
  canEdit: boolean;
  labels: ContactAddressesLabels;
  onEdit: () => void;
  onMakeDefault: () => void;
}): ReactElement {
  const { address, labels } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default bg-surface p-3">
      <p className="text-body font-semibold text-primary">
        {address.label}
        {address.isDefault ? (
          <span className="ms-2 text-small font-normal text-secondary">{labels.defaultMark}</span>
        ) : null}
      </p>
      <p className="break-words text-body text-primary">{lineOf(address)}</p>
      {props.canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={props.onEdit}>
            {labels.edit}
          </Button>
          {address.isDefault ? null : (
            <Button variant="secondary" onClick={props.onMakeDefault}>
              {labels.makeDefault}
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** The addresses of a contact: add, edit and choose the default one. Requests copy a snapshot, so changes here never rewrite old ones. */
export function ContactAddresses(props: ContactAddressesProps): ReactElement {
  const { labels, addresses, canEdit } = props;
  const router = useRouter();
  const [target, setTarget] = useState<Target | undefined>(undefined);
  const Sheet = useLazyComponent(loadSheet, target !== undefined);

  async function makeDefault(addressId: string): Promise<void> {
    await updateContact(props.organizationId, props.contactId, {
      addresses: addressesWithDefault(addresses, addressId),
      version: props.version,
    });
    router.refresh();
  }

  return (
    <PageSection
      title={labels.title}
      help={labels.help}
      action={
        canEdit ? (
          <Button variant="secondary" onClick={() => setTarget({})}>
            {labels.add}
          </Button>
        ) : undefined
      }
    >
      {addresses.length === 0 ? (
        <p className="text-body text-secondary">{labels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.addressId}
              address={address}
              canEdit={canEdit}
              labels={labels}
              onEdit={() => setTarget({ address })}
              onMakeDefault={() => void makeDefault(address.addressId)}
            />
          ))}
        </ul>
      )}
      {Sheet && target ? (
        <Sheet
          organizationId={props.organizationId}
          contactId={props.contactId}
          version={props.version}
          addresses={addresses}
          {...(target.address ? { address: target.address } : {})}
          labels={labels}
          onClose={() => setTarget(undefined)}
        />
      ) : null}
    </PageSection>
  );
}
