import { useRouter } from "next/navigation.js";
import { useTransition } from "react";

/** Returns the handler that switches the language: server action first, then a refresh of the server components. */
export function useLocaleChange(
  setLocale: (localeKey: string) => Promise<unknown>,
): (localeKey: string) => void {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (localeKey) => {
    startTransition(async () => {
      await setLocale(localeKey);
      router.refresh();
    });
  };
}
