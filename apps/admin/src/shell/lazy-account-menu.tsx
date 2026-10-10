"use client";

import type { AccountMenuProps } from "@banijjik/ui";
import { useEffect, useState, type ComponentType, type ReactElement } from "react";

type MenuComponent = ComponentType<AccountMenuProps>;

/**
 * The account sheet (Radix dialog, focus trap, scroll lock) is only needed after a tap, so its code is fetched on
 * the first open and stays out of the initial JS budget (13-UX section 11). Server rendering stays on (ADR-010):
 * a closed sheet renders nothing on the server anyway.
 */
export function LazyAccountMenu(props: AccountMenuProps): ReactElement | null {
  const [Menu, setMenu] = useState<MenuComponent | null>(null);
  const { open } = props;

  useEffect(() => {
    if (!open || Menu) return;
    async function loadMenu(): Promise<void> {
      const uiModule = await import("@banijjik/ui");
      setMenu(() => uiModule.AccountMenu);
    }
    void loadMenu();
  }, [open, Menu]);

  return Menu ? <Menu {...props} /> : null;
}
