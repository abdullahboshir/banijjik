import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "../i18n/set-locale.action";

/** Returns the handler that switches the language: server action first, then a refresh of the server components. */
export function useLocaleChange(): (localeKey: string) => void {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (localeKey) => {
    startTransition(async () => {
      await setLocaleAction(localeKey);
      router.refresh();
    });
  };
}
