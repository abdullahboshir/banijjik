"use client";

import type { ContactAddress } from "@banijjik/contracts/contact";
import { Button, Checkbox, Sheet, SheetContent } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { SettingsTextField } from "../settings/settings-text-field";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { updateContact } from "./contact-api";
import {
  ADDRESS_FORM_NAMES,
  addressErrors,
  addressesWithEdit,
  addressesWithNew,
  EMPTY_ADDRESS_FORM,
  formOfAddress,
  type AddressFormState,
} from "./address-list";

export interface AddressLabels {
  addTitle: string;
  editTitle: string;
  close: string;
  save: string;
  conflict: string;
  reload: string;
  label: string;
  line1: string;
  area: string;
  thana: string;
  district: string;
  postalCode: string;
  isDefault: string;
}

export interface AddressSheetProps {
  organizationId: string;
  contactId: string;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
  addresses: ContactAddress[];
  /** The address being edited; absent when the sheet adds one. */
  address?: ContactAddress;
  labels: AddressLabels;
  onClose: () => void;
}

const TEXT_FIELDS = ["label", "line1", "area", "thana", "district", "postalCode"] as const;

function inputModeOf(name: (typeof TEXT_FIELDS)[number]): "numeric" | undefined {
  return name === "postalCode" ? "numeric" : undefined;
}

/** The address form of the detail page; it sends the whole list with the one change (ADR-110). Loaded on the first tap. */
export function AddressSheet(props: AddressSheetProps): ReactElement {
  const { labels, address } = props;
  const [form, setForm] = useState<AddressFormState>(
    address ? formOfAddress(address) : EMPTY_ADDRESS_FORM,
  );
  const state = useSheetSubmit({
    fieldNames: ADDRESS_FORM_NAMES,
    onClose: props.onClose,
    send: async () => {
      const fieldErrors = addressErrors(form);
      if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
      const addresses = address
        ? addressesWithEdit(props.addresses, address.addressId, form)
        : addressesWithNew(props.addresses, form);
      await updateContact(props.organizationId, props.contactId, {
        addresses,
        version: props.version,
      });
      return { ok: true };
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={address ? labels.editTitle : labels.addTitle} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {TEXT_FIELDS.map((name) => (
            <SettingsTextField
              key={name}
              fieldId={`address-${name}`}
              label={labels[name]}
              value={form[name]}
              errorKey={state.errors[name]}
              inputMode={inputModeOf(name)}
              isRequired={name === "label" || name === "line1"}
              onChange={(value) => setForm({ ...form, [name]: value })}
            />
          ))}
          <Checkbox
            label={labels.isDefault}
            checked={form.isDefault}
            onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
          />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
