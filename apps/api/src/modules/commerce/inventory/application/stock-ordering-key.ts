export function stockOrderingKey(locationId: string, inventoryItemId: string): string {
  return `stock:${locationId}:${inventoryItemId}`;
}
