import { LOCATION_TYPE, type LocationResponse, type LocationType } from "@banijjik/contracts";
import { formatPhoneForDisplay } from "@banijjik/ui";
import { addressToText, type AddressFormText } from "../settings/address-fields";

/** Every field of the location form as the person sees it: plain text, empty when not set. */
export interface LocationFormState extends AddressFormText {
  name: string;
  locationType: LocationType;
  locationPhone: string;
  /** An IANA zone, or empty for "same as the business". */
  timezone: string;
}

/** The form's field names, to tell which API field errors belong to the form. */
export const LOCATION_FIELD_NAMES: readonly (keyof LocationFormState)[] = [
  "name",
  "locationType",
  "locationPhone",
  "line1",
  "area",
  "thana",
  "district",
  "postalCode",
  "timezone",
];

/** A short list of zones, Bangladesh first; "same as the business" is the empty choice (plan 1.7d decision 4). */
export const LOCATION_TIMEZONES: readonly string[] = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
];

export const EMPTY_LOCATION_FORM: LocationFormState = {
  ...addressToText(undefined),
  name: "",
  locationType: LOCATION_TYPE.STORE,
  locationPhone: "",
  timezone: "",
};

/** The saved location as form text; the phone is shown the way people write it. */
export function locationToFormState(location: LocationResponse): LocationFormState {
  return {
    ...addressToText(location.address),
    name: location.name,
    locationType: location.locationType,
    locationPhone: location.phoneE164 ? formatPhoneForDisplay(location.phoneE164) : "",
    timezone: location.timezone ?? "",
  };
}
