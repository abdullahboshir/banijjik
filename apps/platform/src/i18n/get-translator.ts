import { getLocale } from "@banijjik/web-client/server";
import { PLATFORM_SCREEN_CATALOGS, createTranslator, type Translator } from "@banijjik/i18n";
import { env } from "../config/env";

/**
 * Server only. It also knows the platform screen catalogs, which never reach the browser: client components
 * get their text as props from the server (the same mechanism as the admin screens, 13-UX section 11).
 */
export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return createTranslator({
    locale,
    terms: {},
    catalogs: PLATFORM_SCREEN_CATALOGS,
    brandName: env.NEXT_PUBLIC_BRAND_NAME,
  });
}
