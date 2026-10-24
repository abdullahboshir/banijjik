import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";

/** Template label of a report reason; the key itself when the template no longer lists it. */
export function reasonLabelOf(
  reasons: DirectoryConfigResponse["reportReasons"],
  reasonKey: string,
  locale: Locale,
): string {
  const reason = reasons.find((entry) => entry.reasonKey === reasonKey);
  return reason === undefined ? reasonKey : reason.label[locale];
}
