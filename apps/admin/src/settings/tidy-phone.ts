import { normalizePhoneToE164 } from "@banijjik/validation";
import { formatPhoneForDisplay } from "@banijjik/ui";

/** What a phone field shows after the person leaves it: `01712-345678` when it is a valid number. */
export function tidyPhone(input: string): string {
  const normalized = normalizePhoneToE164(input);
  return normalized === undefined ? input : formatPhoneForDisplay(normalized);
}
