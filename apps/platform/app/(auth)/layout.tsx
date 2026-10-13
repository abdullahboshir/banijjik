import { LanguageSwitch } from "@banijjik/web-client/client";
import type { ReactElement, ReactNode } from "react";
import { setLocaleAction } from "../../src/i18n/set-locale.action";
import { BrandLogo } from "../../src/shell/brand-logo";

/** A centred single column for sign-in: the brand, the language switch, then the form. */
export default function AuthLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 md:justify-center">
      <header className="flex items-center justify-between gap-3">
        <BrandLogo />
        <LanguageSwitch buttonClassName="px-2 sm:px-4" setLocale={setLocaleAction} />
      </header>
      {children}
    </main>
  );
}
