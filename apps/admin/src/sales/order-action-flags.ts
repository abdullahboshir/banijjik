import {
  ORDER_CANCELLABLE_STATUSES,
  ORDER_EDITABLE_STATUSES,
  ORDER_STATUS,
  type OrderStatus,
} from "@banijjik/contracts/sales";

export interface OrderDetailPermissions {
  readonly canUpdate: boolean;
  readonly canConfirm: boolean;
  readonly canCancel: boolean;
  readonly canReceive: boolean;
  readonly canReturn: boolean;
  /** Exchange needs the return and the order permission together (plan 3.5b B2). */
  readonly canExchange: boolean;
}

export interface OrderActionFlags {
  readonly canEdit: boolean;
  readonly canPlace: boolean;
  readonly canConfirm: boolean;
  readonly canPack: boolean;
  readonly canComplete: boolean;
  readonly canDeleteDraft: boolean;
  readonly canCancel: boolean;
  readonly hasActions: boolean;
}

function isCompletable(status: OrderStatus): boolean {
  return status === ORDER_STATUS.CONFIRMED || status === ORDER_STATUS.PACKED;
}

function hasAny(flags: readonly boolean[]): boolean {
  return flags.some(Boolean);
}

/** Which buttons the detail shows: the permission and the status must both allow the action. */
export function orderActionFlagsOf(
  status: OrderStatus,
  permissions: OrderDetailPermissions,
  usePacking: boolean,
): OrderActionFlags {
  const canEdit = permissions.canUpdate && ORDER_EDITABLE_STATUSES.includes(status);
  const canPlace = permissions.canUpdate && status === ORDER_STATUS.DRAFT;
  const canConfirm = permissions.canConfirm && status === ORDER_STATUS.PLACED;
  const canPack = permissions.canUpdate && usePacking && status === ORDER_STATUS.CONFIRMED;
  const canComplete = permissions.canUpdate && isCompletable(status);
  const canDeleteDraft = canPlace;
  const canCancel = permissions.canCancel && ORDER_CANCELLABLE_STATUSES.includes(status);
  const hasActions = hasAny([
    canEdit,
    canPlace,
    canConfirm,
    canPack,
    canComplete,
    canDeleteDraft,
    canCancel,
  ]);
  return {
    canEdit,
    canPlace,
    canConfirm,
    canPack,
    canComplete,
    canDeleteDraft,
    canCancel,
    hasActions,
  };
}
