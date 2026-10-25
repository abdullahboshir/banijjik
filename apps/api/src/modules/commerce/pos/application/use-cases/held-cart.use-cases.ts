import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  POS_HELD_CART_MAX_PER_DEVICE,
  POS_RULE_KEY,
  type PosHeldCartLine,
  type PosHeldCartPayload,
  type PosHeldCartResponse,
} from "@banijjik/contracts/pos";
import { newId, type OrganizationId, type PosHeldCartId, type UserId } from "@banijjik/ids";
import type { PosHeldCartCreateBody } from "@banijjik/validation/pos";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { posRuleError, recordNotFound, retryableConflict } from "../../domain/errors.js";
import { newPosHeldCart, type PosHeldCart } from "../../domain/pos-held-cart.entity.js";
import type { PosCaller, PosHeldCartRepository, PosUnitOfWork } from "../ports/pos-ports.js";
import type { PosDeviceContext } from "./session.use-cases.js";

function toHeldCartLine(line: PosHeldCartCreateBody["cart"]["lines"][number]): PosHeldCartLine {
  return {
    offeringId: line.offeringId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifierOptionIds,
    ...(line.manualDiscount === undefined ? {} : { manualDiscount: line.manualDiscount }),
    ...(line.performedByMemberId === undefined
      ? {}
      : { performedByMemberId: line.performedByMemberId }),
  };
}

function toHeldCartPayload(cart: PosHeldCartCreateBody["cart"]): PosHeldCartPayload {
  return {
    lines: cart.lines.map(toHeldCartLine),
    ...(cart.contactId === undefined ? {} : { contactId: cart.contactId }),
    ...(cart.orderDiscount === undefined ? {} : { orderDiscount: cart.orderDiscount }),
    ...(cart.note === undefined || cart.note === null ? {} : { note: cart.note }),
    ...(cart.customFields === undefined ? {} : { customFields: cart.customFields }),
  };
}

export function toHeldCartResponse(cart: PosHeldCart): PosHeldCartResponse {
  return {
    posHeldCartId: cart.posHeldCartId,
    posDeviceId: cart.posDeviceId,
    locationId: cart.locationId,
    heldByMemberId: cart.heldByMemberId,
    label: cart.label,
    cart: cart.cart,
    expiresAt: cart.expiresAt.toISOString(),
    version: cart.version,
    createdAt: cart.createdAt.toISOString(),
  };
}

export interface HeldCartWriteDependencies {
  readonly heldCarts: PosHeldCartRepository;
  readonly caller: PosCaller;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** `POST /pos/held-carts`: parks a basket on this device without prices or payments (plan 3.9 A2-1). */
export class CreatePosHeldCartUseCase {
  constructor(private readonly dependencies: HeldCartWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly device: PosDeviceContext;
    readonly body: PosHeldCartCreateBody;
  }): Promise<PosHeldCartResponse> {
    const { heldCarts, caller, unitOfWork, audit, clock } = this.dependencies;
    const now = clock.now();
    const heldByMemberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const cart = newPosHeldCart({
      posHeldCartId: newId<PosHeldCartId>(),
      organizationId: input.organizationId,
      locationId: input.device.locationId,
      posDeviceId: input.device.posDeviceId,
      heldByMemberId,
      label: input.body.label,
      cart: toHeldCartPayload(input.body.cart),
      actorUserId: input.actorUserId,
      now,
    });
    await unitOfWork.run(async () => {
      const activeCount = await heldCarts.countActiveByDevice(input.device.posDeviceId, now);
      if (activeCount >= POS_HELD_CART_MAX_PER_DEVICE) {
        throw posRuleError(POS_RULE_KEY.HELD_CART_LIMIT, {
          maxHeldCarts: POS_HELD_CART_MAX_PER_DEVICE,
        });
      }
      await heldCarts.insert(cart);
      await audit.record({
        action: AUDIT_ACTION.POS_HELD_CART_CREATED,
        entityType: AUDIT_ENTITY_TYPE.posHeldCart,
        entityId: cart.posHeldCartId,
        changes: {
          posDeviceId: { to: cart.posDeviceId },
          lineCount: { to: cart.cart.lines.length },
        },
      });
    });
    return toHeldCartResponse(cart);
  }
}

/** `GET /pos/held-carts`: active held carts of this device only, newest first (plan 3.9 A2-1). */
export class ListPosHeldCartsUseCase {
  constructor(
    private readonly dependencies: {
      readonly heldCarts: PosHeldCartRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly device: PosDeviceContext;
  }): Promise<readonly PosHeldCartResponse[]> {
    const rows = await this.dependencies.heldCarts.listActiveByDevice(
      input.device.posDeviceId,
      this.dependencies.clock.now(),
    );
    return rows.map(toHeldCartResponse);
  }
}

/** `DELETE /pos/held-carts/{posHeldCartId}`: removes an active held cart of this device (plan 3.9 A2-1). */
export class DeletePosHeldCartUseCase {
  constructor(
    private readonly dependencies: {
      readonly heldCarts: PosHeldCartRepository;
      readonly unitOfWork: PosUnitOfWork;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly device: PosDeviceContext;
    readonly posHeldCartId: PosHeldCartId;
    readonly version?: number | undefined;
  }): Promise<void> {
    const { heldCarts, unitOfWork, audit, clock } = this.dependencies;
    const now = clock.now();
    const existing = await heldCarts.findById(input.posHeldCartId);
    if (
      existing === undefined ||
      existing.posDeviceId !== input.device.posDeviceId ||
      existing.expiresAt.getTime() <= now.getTime()
    ) {
      throw recordNotFound();
    }
    if (input.version !== undefined && existing.version !== input.version) {
      throw retryableConflict();
    }
    await unitOfWork.run(async () => {
      const deleted = await heldCarts.deleteById({
        posHeldCartId: existing.posHeldCartId,
        posDeviceId: input.device.posDeviceId,
        expectedVersion: existing.version,
      });
      if (!deleted) throw retryableConflict();
      await audit.record({
        action: AUDIT_ACTION.POS_HELD_CART_DELETED,
        entityType: AUDIT_ENTITY_TYPE.posHeldCart,
        entityId: existing.posHeldCartId,
      });
    });
  }
}
