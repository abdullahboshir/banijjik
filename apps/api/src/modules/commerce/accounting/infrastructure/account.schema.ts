import {
  ACCOUNT_STATUS,
  ACCOUNT_TYPE,
  type AccountStatus,
  type AccountType,
} from "@banijjik/contracts/accounting";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
} from "../../../../kernel/db/index.js";

export const ACCOUNT_MODEL_NAME = "Account";
export const ACCOUNT_COLLECTION_NAME = "accounts";

export interface AccountDocument {
  accountId: string;
  organizationId: string;
  accountCode: string;
  name: { bn: string; en: string };
  accountType: AccountType;
  isSystem: boolean;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const localizedNameSchema = new Schema(
  { bn: { type: String, required: true }, en: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const accountSchema = new Schema<AccountDocument>(
  {
    ...domainIdField("accountId"),
    organizationId: { type: String, required: true, immutable: true },
    accountCode: { type: String, required: true },
    name: { type: localizedNameSchema, required: true },
    accountType: { type: String, required: true, enum: Object.values(ACCOUNT_TYPE) },
    isSystem: { type: Boolean, required: true },
    status: { type: String, required: true, enum: Object.values(ACCOUNT_STATUS) },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

accountSchema.index({ organizationId: 1, accountCode: 1 }, { unique: true });
accountSchema.index({ organizationId: 1, status: 1, accountCode: 1 });
