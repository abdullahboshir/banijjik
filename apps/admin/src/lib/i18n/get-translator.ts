import { getLocale } from "@banijjik/web-client/server";
import { createTranslator, SCREEN_CATALOGS, type Translator } from "@banijjik/i18n";
import { env } from "../../config/env";

/**
 * Server only. It also knows the screen catalogs that never reach the browser. Org terms are empty until
 * the settings module (card 2.4); the menu applies the ones it is given.
 */
export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return createTranslator({
    locale,
    terms: {},
    catalogs: SCREEN_CATALOGS,
    brandName: env.NEXT_PUBLIC_BRAND_NAME,
  });
}
