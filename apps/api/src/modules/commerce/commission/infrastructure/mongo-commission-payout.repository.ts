import type { Money } from "@banijjik/contracts/accounting";
import {
  asId,
  type CommissionPayoutId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  CommissionPayoutListFilter,
  CommissionPayoutRepository,
  Page,
} from "../application/ports/commission-ports.js";
import type { CommissionPayout } from "../domain/commission-payout.entity.js";
import {
  COMMISSION_PAYOUT_MODEL_NAME,
  type CommissionPayoutDocument,
  type MoneyDocument,
} from "./commission.schema.js";

function payoutModel(): Model<CommissionPayoutDocument> {
  return models({}).get<CommissionPayoutDocument>(COMMISSION_PAYOUT_MODEL_NAME);
}

function toMoney(value: MoneyDocument): Money {
  return { amount: value.amount, currency: value.currency };
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function toPayout(row: CommissionPayoutDocument): CommissionPayout {
  return {
    commissionPayoutId: asId<CommissionPayoutId>(row.commissionPayoutId),
    organizationId: asId<OrganizationId>(row.organizationId),
    payoutNumber: row.payoutNumber,
    memberId: asId<MemberId>(row.memberId),
    locationId: asId<LocationId>(row.locationId),
    upToBusinessDate: row.upToBusinessDate,
    entryCount: row.entryCount,
    total: toMoney(row.total),
    method: row.method,
    externalReference: row.externalReference,
    note: row.note,
    businessDate: row.businessDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  };
}

function listQueryOf(filter: CommissionPayoutListFilter): QueryFilter<CommissionPayoutDocument> {
  const query: QueryFilter<CommissionPayoutDocument> = {};
  if (filter.memberId !== undefined) query.memberId = filter.memberId;
  if (filter.locationId !== undefined) query.locationId = filter.locationId;
  return query;
}

export class MongoCommissionPayoutRepository implements CommissionPayoutRepository {
  async insert(payout: CommissionPayout): Promise<void> {
    const { organizationId, ...rest } = payout;
    await payoutModel().create([{ ...rest, organizationId }], sessionOption(getActiveSession()));
  }

  async findById(commissionPayoutId: CommissionPayoutId): Promise<CommissionPayout | undefined> {
    const row = await payoutModel()
      .findOne({ commissionPayoutId }, null, sessionOption(getActiveSession()))
      .lean<CommissionPayoutDocument>();
    return row === null ? undefined : toPayout(row);
  }

  async list(filter: CommissionPayoutListFilter): Promise<Page<CommissionPayout>> {
    const rows = await payoutModel()
      .find(listQueryOf(filter))
      .sort({ businessDate: -1, commissionPayoutId: -1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<CommissionPayoutDocument[]>();
    return {
      items: rows.slice(0, filter.limit).map(toPayout),
      hasNext: rows.length > filter.limit,
    };
  }
}
