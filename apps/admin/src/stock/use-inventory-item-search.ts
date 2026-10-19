"use client";

import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { useEffect, useState } from "react";
import { searchInventoryItems } from "./stock-api";

export function useInventoryItemSearch(
  organizationId: string,
  query: string,
  selected: InventoryItemListItem | undefined,
): { results: InventoryItemListItem[]; isSearching: boolean } {
  const [results, setResults] = useState<InventoryItemListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    if (selected !== undefined && trimmed === selected.name) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      async function runSearch(): Promise<void> {
        setIsSearching(true);
        try {
          const items = await searchInventoryItems(organizationId, trimmed);
          setResults(items);
        } finally {
          setIsSearching(false);
        }
      }
      void runSearch();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, organizationId, selected]);

  return { results, isSearching };
}
