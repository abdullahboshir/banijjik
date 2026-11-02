import { DomainRuleError, ERROR_CODE, type LocalizedText } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/pricing";
import {
  DELIVERY_ZONE_STATUS,
  type DeliveryZone as DeliveryZoneContract,
  type DeliveryZoneStatus,
} from "@banijjik/contracts/sales/delivery";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";

const INITIAL_VERSION = 1;
const AREA_CODE_MAX_LENGTH = 50;

/** Folded storage form: trimmed and case-folded so zone matching needs no regex. */
export function normalizeDeliveryAreaCode(areaCode: string): string {
  return areaCode.trim().toLowerCase();
}

export interface NewDeliveryZoneInput {
  readonly organizationId: OrganizationId;
  readonly zoneKey: string;
  readonly name: LocalizedText;
  readonly areaCodes: readonly string[];
  readonly fee: Money;
  readonly status: DeliveryZoneStatus;
  readonly actorUserId: UserId;
  readonly now: Date;
}

export interface DeliveryZoneChanges {
  readonly name?: LocalizedText;
  readonly areaCodes?: readonly string[];
  readonly fee?: Money;
  readonly status?: DeliveryZoneStatus;
}

function duplicateAreaCodes(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.DUPLICATE,
    details: { field: "areaCodes" },
  });
}

function emptyAreaCodes(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "areaCodes", messageKey: "validation.too_small" }] },
  });
}

function areaCodeOutsideBound(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "areaCodes", messageKey: "validation.too_big" }] },
  });
}

function invalidFee(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "fee", messageKey: "validation.too_small" }] },
  });
}

function assertFee(fee: Money): void {
  if (!Number.isInteger(fee.amount) || fee.amount < 0) throw invalidFee();
}

function normalizeAreaCodes(areaCodes: readonly string[]): readonly string[] {
  const normalized = areaCodes.map(normalizeDeliveryAreaCode);
  if (normalized.length === 0 || normalized.some((code) => code.length === 0)) {
    throw emptyAreaCodes();
  }
  if (normalized.some((code) => code.length > AREA_CODE_MAX_LENGTH)) {
    throw areaCodeOutsideBound();
  }
  if (new Set(normalized).size !== normalized.length) throw duplicateAreaCodes();
  return normalized;
}

/**
 * An organization delivery zone: one ACTIVE zone may claim each area code (partial unique index).
 * `zoneKey` is immutable after create.
 */
export class DeliveryZone implements DeliveryZoneContract {
  readonly deliveryZoneId: string;
  readonly organizationId: OrganizationId;
  readonly zoneKey: string;
  readonly name: LocalizedText;
  readonly areaCodes: readonly string[];
  readonly fee: Money;
  readonly status: DeliveryZoneStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  private constructor(
    props: DeliveryZoneContract & {
      readonly organizationId: OrganizationId;
      readonly createdByUserId: UserId;
      readonly updatedByUserId: UserId;
    },
  ) {
    this.deliveryZoneId = props.deliveryZoneId;
    this.organizationId = props.organizationId;
    this.zoneKey = props.zoneKey;
    this.name = props.name;
    this.areaCodes = props.areaCodes;
    this.fee = props.fee;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewDeliveryZoneInput): DeliveryZone {
    assertFee(input.fee);
    return new DeliveryZone({
      deliveryZoneId: newId(),
      organizationId: input.organizationId,
      zoneKey: input.zoneKey,
      name: input.name,
      areaCodes: normalizeAreaCodes(input.areaCodes),
      fee: input.fee,
      status: input.status,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static restore(
    props: DeliveryZoneContract & {
      readonly organizationId: OrganizationId;
      readonly createdByUserId: UserId;
      readonly updatedByUserId: UserId;
    },
  ): DeliveryZone {
    return new DeliveryZone(props);
  }

  withChanges(changes: DeliveryZoneChanges, actorUserId: UserId, now: Date): DeliveryZone {
    if (changes.fee !== undefined) assertFee(changes.fee);
    return new DeliveryZone({
      deliveryZoneId: this.deliveryZoneId,
      organizationId: this.organizationId,
      zoneKey: this.zoneKey,
      name: changes.name ?? this.name,
      areaCodes:
        changes.areaCodes === undefined ? this.areaCodes : normalizeAreaCodes(changes.areaCodes),
      fee: changes.fee ?? this.fee,
      status: changes.status ?? this.status,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: now,
      createdByUserId: this.createdByUserId,
      updatedByUserId: actorUserId,
    });
  }

  get isActive(): boolean {
    return this.status === DELIVERY_ZONE_STATUS.ACTIVE;
  }
}
