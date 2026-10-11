import type { PostalAddress } from "@banijjik/contracts";

export const ADDRESS_FIELD_NAMES = ["line1", "area", "thana", "district", "postalCode"] as const;

/** The address as five text fields of a form; an unset part is an empty string. */
export type AddressFormText = Record<(typeof ADDRESS_FIELD_NAMES)[number], string>;

export function addressToText(address: PostalAddress | undefined): AddressFormText {
  const saved = address ?? {};
  return {
    line1: saved.line1 ?? "",
    area: saved.area ?? "",
    thana: saved.thana ?? "",
    district: saved.district ?? "",
    postalCode: saved.postalCode ?? "",
  };
}

/** The filled parts as an address, or undefined when the person filled none (an empty part is left out). */
export function addressFromText(text: AddressFormText): PostalAddress | undefined {
  const address: PostalAddress = {};
  for (const field of ADDRESS_FIELD_NAMES) {
    const value = text[field].trim();
    if (value !== "") address[field] = value;
  }
  return Object.keys(address).length > 0 ? address : undefined;
}
