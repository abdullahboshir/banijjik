import { MODULE_KEY } from "@banijjik/contracts";
import { notFound } from "next/navigation";
import type { Translator } from "@banijjik/i18n";
import type { OrgAccess } from "../shell/org-access";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { bookkeepingLabels, type BookkeepingLabels } from "./labels";
export interface BookkeepingPageProps {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}
export function queryText(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export async function bookkeepingAccess(
  orgSlug: string,
): Promise<{ translator: Translator; access: OrgAccess; labels: BookkeepingLabels }> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  if (!access.config.modules.includes(MODULE_KEY.BOOKKEEPING)) notFound();
  return { translator, access, labels: bookkeepingLabels(translator.t) };
}
