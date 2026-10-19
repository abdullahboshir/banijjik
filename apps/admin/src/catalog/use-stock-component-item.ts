"use client";

import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { useEffect, useState } from "react";
import { getInventoryItem } from "../stock/stock-api";
import type { StockComponentDraft } from "./offering-form";

export function useStockComponentItem(
  organizationId: string,
  component: StockComponentDraft,
  onChange: (component: StockComponentDraft) => void,
): InventoryItemListItem | undefined {
  const [item, setItem] = useState<InventoryItemListItem | undefined>(component.item);

  useEffect(() => {
    if (component.item !== undefined) {
      setItem(component.item);
      return;
    }
    if (component.inventoryItemId.trim() === "") return;

    let cancelled = false;
    async function load(): Promise<void> {
      const loaded = await getInventoryItem(organizationId, component.inventoryItemId);
      if (cancelled) return;
      const listItem: InventoryItemListItem = {
        inventoryItemId: loaded.inventoryItemId,
        name: loaded.name,
        baseUnitKey: loaded.baseUnitKey,
        status: loaded.status,
        ...(loaded.sku ? { sku: loaded.sku } : {}),
      };
      setItem(listItem);
      onChange({ ...component, item: listItem });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, component.inventoryItemId]);

  return item;
}
