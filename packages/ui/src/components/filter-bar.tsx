"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Sheet, SheetContent } from "./sheet.js";

export interface FilterChip {
  value: string;
  label: string;
  isActive: boolean;
}

export interface FilterBarProps {
  chips: FilterChip[];
  onChipSelect: (value: string) => void;
  moreLabel: string;
  sheetContent: ReactNode;
  closeLabel: string;
}

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

export function FilterSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: FilterSheetProps): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title} closeLabel={closeLabel}>
        {children}
      </SheetContent>
    </Sheet>
  );
}

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

/** URL state belongs to the app: the bar only reports which chip was selected. */
export function FilterBar({
  chips,
  onChipSelect,
  moreLabel,
  sheetContent,
  closeLabel,
}: FilterBarProps): ReactElement {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          aria-pressed={chip.isActive}
          onClick={() => onChipSelect(chip.value)}
          className={cn(
            CHIP_CLASS,
            chip.isActive
              ? "border-brand bg-brand text-on-brand"
              : "border-default bg-subtle text-primary hover:bg-surface",
          )}
        >
          {chip.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        className={cn(CHIP_CLASS, "border-default bg-surface text-primary hover:bg-subtle")}
      >
        {moreLabel}
      </button>
      <FilterSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={moreLabel}
        closeLabel={closeLabel}
      >
        {sheetContent}
      </FilterSheet>
    </div>
  );
}
