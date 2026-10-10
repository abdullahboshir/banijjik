"use client";

import type { ReactElement } from "react";
import { Icon } from "../lib/icons.js";
import { Sheet, SheetContent } from "./sheet.js";

export interface QuickCreateAction {
  actionKey: string;
  label: string;
  href: string;
  iconKey: string;
}

export interface QuickCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: QuickCreateAction[];
  emptyText: string;
  closeLabel: string;
}

export function QuickCreateSheet({
  open,
  onOpenChange,
  title,
  actions,
  emptyText,
  closeLabel,
}: QuickCreateSheetProps): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title} closeLabel={closeLabel}>
        {actions.length === 0 ? (
          <p className="text-body text-secondary">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {actions.map((action) => (
              <li key={action.actionKey}>
                <a
                  href={action.href}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body text-primary transition-colors hover:bg-subtle"
                >
                  <Icon iconKey={action.iconKey} className="size-5 shrink-0 text-brand" />
                  <span>{action.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
