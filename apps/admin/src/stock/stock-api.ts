import type {
  ApprovalGrantRequest,
  ApprovalGrantResponse,
  ApproverSummary,
} from "@banijjik/contracts/iam";
import type {
  InventoryItemListItem,
  InventoryItemResponse,
  InventoryLevelRow,
  StockMovementResponse,
} from "@banijjik/contracts/inventory";
import type {
  StockAdjustmentBody,
  StockReceiptBody,
  StockTransferBody,
} from "@banijjik/validation/inventory";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

function itemsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/inventory-items${suffix}`;
}

function stockPath(organizationId: string, suffix: string): string {
  return `/orgs/${organizationId}/stock${suffix}`;
}

export async function searchInventoryItems(
  organizationId: string,
  query: string,
): Promise<InventoryItemListItem[]> {
  const params = new URLSearchParams({ q: query, limit: "8", status: "ACTIVE" });
  return (await apiFetch<InventoryItemListItem[]>(`${itemsPath(organizationId)}?${params}`)).data;
}

export async function getInventoryItem(
  organizationId: string,
  inventoryItemId: string,
): Promise<InventoryItemResponse> {
  return (await apiFetch<InventoryItemResponse>(itemsPath(organizationId, `/${inventoryItemId}`)))
    .data;
}

export async function createInventoryItem(
  organizationId: string,
  body: {
    name: string;
    sku?: string;
    baseUnitKey: string;
    lowStockThreshold?: number;
  },
): Promise<InventoryItemResponse> {
  return (
    await apiFetch<InventoryItemResponse>(itemsPath(organizationId), {
      method: "POST",
      body,
      idempotencyKey: newId(),
    })
  ).data;
}

export async function receiveStock(organizationId: string, body: StockReceiptBody): Promise<void> {
  await apiFetch(stockPath(organizationId, "/receipts"), {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
}

export async function adjustStock(
  organizationId: string,
  body: StockAdjustmentBody,
): Promise<void> {
  await apiFetch(stockPath(organizationId, "/adjustments"), {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
}

export async function transferStock(
  organizationId: string,
  body: StockTransferBody,
): Promise<void> {
  await apiFetch(stockPath(organizationId, "/transfers"), {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
}

export async function listApprovers(
  organizationId: string,
  locationId: string,
): Promise<ApproverSummary[]> {
  const params = new URLSearchParams({ locationId });
  return (
    await apiFetch<ApproverSummary[]>(`/orgs/${organizationId}/approvers?${params.toString()}`)
  ).data;
}

export async function grantApproval(
  organizationId: string,
  body: ApprovalGrantRequest,
): Promise<ApprovalGrantResponse> {
  return (
    await apiFetch<ApprovalGrantResponse>(`/orgs/${organizationId}/approvals`, {
      method: "POST",
      body,
    })
  ).data;
}

export type { InventoryLevelRow, StockMovementResponse };
