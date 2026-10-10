"use client";

import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { Icon } from "../lib/icons.js";
import { useLinkComponent } from "../lib/link.js";

export const QUICK_CREATE_SLOT_KEY = "quickCreate";
export const MAX_BOTTOM_NAV_SLOTS = 5;

export interface BottomNavSlot {
  slotKey: string;
  label: string;
  href?: string;
  iconKey: string;
  onSelect?: () => void;
  badgeCount?: number;
  isActive?: boolean;
}

export interface BottomNavProps {
  slots: BottomNavSlot[];
  /** Accessible name of the navigation landmark. */
  navLabel: string;
}

const SLOT_CLASS =
  "relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-caption text-secondary transition-colors";

function SlotBadge({ count }: { count: number }): ReactElement {
  return (
    <span className="absolute right-1/4 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-caption text-on-brand">
      {count}
    </span>
  );
}

function QuickCreateButton({ slot }: { slot: BottomNavSlot }): ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center">
      <button
        type="button"
        aria-label={slot.label}
        onClick={slot.onSelect}
        className="inline-flex size-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-md transition-colors hover:bg-brand-hover"
      >
        <Icon iconKey={slot.iconKey} className="size-6" />
      </button>
    </div>
  );
}

function NavSlot({ slot }: { slot: BottomNavSlot }): ReactElement {
  const Link = useLinkComponent();
  const content = (
    <>
      <Icon iconKey={slot.iconKey} className="size-6" />
      <span>{slot.label}</span>
      {slot.badgeCount ? <SlotBadge count={slot.badgeCount} /> : null}
    </>
  );
  const className = cn(SLOT_CLASS, slot.isActive && "font-semibold text-brand");
  if (slot.href && !slot.onSelect) {
    return (
      <Link
        href={slot.href}
        aria-current={slot.isActive ? "page" : undefined}
        className={className}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={slot.onSelect} className={className}>
      {content}
    </button>
  );
}

export function BottomNav({ slots, navLabel }: BottomNavProps): ReactElement {
  return (
    <nav
      aria-label={navLabel}
      className="fixed inset-x-0 bottom-0 z-nav flex items-stretch border-t border-default bg-surface"
    >
      {slots
        .slice(0, MAX_BOTTOM_NAV_SLOTS)
        .map((slot) =>
          slot.slotKey === QUICK_CREATE_SLOT_KEY ? (
            <QuickCreateButton key={slot.slotKey} slot={slot} />
          ) : (
            <NavSlot key={slot.slotKey} slot={slot} />
          ),
        )}
    </nav>
  );
}
