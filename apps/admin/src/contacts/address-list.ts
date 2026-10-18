import type { ContactAddress, ContactAddressInput } from "@banijjik/contracts/contact";

/** The inputs of the address form, as plain text and one switch. */
export interface AddressFormState {
  label: string;
  line1: string;
  area: string;
  thana: string;
  district: string;
  postalCode: string;
  isDefault: boolean;
}

export const EMPTY_ADDRESS_FORM: AddressFormState = {
  label: "",
  line1: "",
  area: "",
  thana: "",
  district: "",
  postalCode: "",
  isDefault: false,
};

export const ADDRESS_FORM_NAMES: readonly string[] = [
  "label",
  "line1",
  "area",
  "thana",
  "district",
  "postalCode",
];

export function formOfAddress(address: ContactAddress): AddressFormState {
  return {
    label: address.label,
    line1: address.line1,
    area: address.area ?? "",
    thana: address.thana ?? "",
    district: address.district ?? "",
    postalCode: address.postalCode ?? "",
    isDefault: address.isDefault,
  };
}

function optionalText(text: string): string | undefined {
  const tidy = text.trim();
  return tidy === "" ? undefined : tidy;
}

function inputOf(form: AddressFormState, addressId?: string): ContactAddressInput {
  return {
    ...(addressId === undefined ? {} : { addressId }),
    label: form.label.trim(),
    line1: form.line1.trim(),
    area: optionalText(form.area),
    thana: optionalText(form.thana),
    district: optionalText(form.district),
    postalCode: optionalText(form.postalCode),
    isDefault: form.isDefault,
  };
}

function asInput(address: ContactAddress): ContactAddressInput {
  return { ...address };
}

/** Only one address is the default: choosing one takes the mark off the others. */
function withSingleDefault(
  list: ContactAddressInput[],
  defaultIndex: number | undefined,
): ContactAddressInput[] {
  if (defaultIndex === undefined) return list;
  return list.map((address, index) => ({ ...address, isDefault: index === defaultIndex }));
}

/** The whole list after adding an address; the first address is the default even when not marked. */
export function addressesWithNew(
  current: readonly ContactAddress[],
  form: AddressFormState,
): ContactAddressInput[] {
  const list = [...current.map(asInput), inputOf({ ...form, isDefault: form.isDefault })];
  const isFirst = current.length === 0;
  return withSingleDefault(list, form.isDefault || isFirst ? list.length - 1 : undefined);
}

/** The whole list after editing one address. */
export function addressesWithEdit(
  current: readonly ContactAddress[],
  addressId: string,
  form: AddressFormState,
): ContactAddressInput[] {
  const list = current.map((address) =>
    address.addressId === addressId ? inputOf(form, addressId) : asInput(address),
  );
  const index = list.findIndex((address) => address.addressId === addressId);
  return withSingleDefault(list, form.isDefault ? index : undefined);
}

/** The whole list with this address as the default. */
export function addressesWithDefault(
  current: readonly ContactAddress[],
  addressId: string,
): ContactAddressInput[] {
  const list = current.map(asInput);
  return withSingleDefault(
    list,
    list.findIndex((address) => address.addressId === addressId),
  );
}

/** Problems found before sending: the label and the first line are required. */
export function addressErrors(form: AddressFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.label.trim() === "") errors["label"] = "validation.required";
  if (form.line1.trim() === "") errors["line1"] = "validation.required";
  return errors;
}
