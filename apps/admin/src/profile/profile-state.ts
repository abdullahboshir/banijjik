import type { OrganizationProfileResponse, PreferredLocale } from "@banijjik/contracts";
import { formatPhoneForDisplay } from "@banijjik/ui";
import { addressToText, type AddressFormText } from "../settings/address-fields";

/** Every field of the profile form as the person sees it: plain text, empty when not set. */
export interface ProfileFormState extends AddressFormText {
  name: string;
  defaultLocale: PreferredLocale;
  legalName: string;
  legalType: string;
  businessPhone: string;
  businessEmail: string;
  tradeLicenseNumber: string;
}

/** The saved profile as form text; the phone is shown the way people write it (`01712-345678`). */
export function profileToFormState(response: OrganizationProfileResponse): ProfileFormState {
  const { profile } = response;
  return {
    ...addressToText(profile.address),
    name: response.name,
    defaultLocale: response.defaultLocale,
    legalName: profile.legalName ?? "",
    legalType: profile.legalType ?? "",
    businessPhone: profile.phoneE164 ? formatPhoneForDisplay(profile.phoneE164) : "",
    businessEmail: profile.email ?? "",
    tradeLicenseNumber: profile.tradeLicenseNumber ?? "",
  };
}

/** The form's field names, to tell which API field errors belong to the form. */
export const PROFILE_FIELD_NAMES: readonly (keyof ProfileFormState)[] = [
  "name",
  "defaultLocale",
  "legalName",
  "legalType",
  "businessPhone",
  "businessEmail",
  "line1",
  "area",
  "thana",
  "district",
  "postalCode",
  "tradeLicenseNumber",
];
