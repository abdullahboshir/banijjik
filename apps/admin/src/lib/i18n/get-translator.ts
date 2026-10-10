import { createTranslator, type Translator } from "@banijjik/i18n";
import { env } from "../../config/env";
import { getLocale } from "./get-locale";

/** Server only. Org terms are empty until /me/config is wired (card 1.7). */
export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return createTranslator({ locale, terms: {}, brandName: env.NEXT_PUBLIC_BRAND_NAME });
}
