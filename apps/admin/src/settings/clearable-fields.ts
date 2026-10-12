import type { PostalAddress } from "@banijjik/contracts";
import { addressFromText, type AddressFormText } from "./address-fields";

/**
 * What to send for an optional text field of an edit form (14-API.md section 5.1): its value, `null`
 * when it was filled and is now empty (the person cleared it), or nothing when it was empty and
 * still is, so the API leaves it alone.
 */
export function clearableText(current: string, initial: string): string | null | undefined {
  const trimmed = current.trim();
  if (trimmed !== "") return trimmed;
  return initial.trim() === "" ? undefined : null;
}

/**
 * The same for the address, which the API replaces as a whole: the filled parts, `null` when an
 * address that had parts is now empty in every part, or nothing when there was none and none was typed.
 */
export function clearableAddress(
  current: AddressFormText,
  initial: AddressFormText,
): PostalAddress | null | undefined {
  const address = addressFromText(current);
  if (address !== undefined) return address;
  return addressFromText(initial) === undefined ? undefined : null;
}
