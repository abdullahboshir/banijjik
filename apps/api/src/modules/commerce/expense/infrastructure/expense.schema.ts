import {
  EXPENSE_CATEGORY_STATUS,
  EXPENSE_PAID_VIA,
  EXPENSE_STATUS,
  type ExpenseCategoryStatus,
  type ExpensePaidVia,
  type ExpenseStatus,
} from "@banijjik/contracts/accounting";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const EXPENSE_MODEL_NAME = "Expense";
export const EXPENSE_COLLECTION_NAME = "expenses";
export const EXPENSE_CATEGORY_MODEL_NAME = "ExpenseCategory";
export const EXPENSE_CATEGORY_COLLECTION_NAME = "expense_categories";

export interface ExpenseCategoryDocument {
  expenseCategoryId: string;
  organizationId: string;
  name: { bn: string; en: string };
  accountId: string;
  accountCode: string;
  status: ExpenseCategoryStatus;
  isSystem: boolean;
  categoryKey: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface ExpenseDocument {
  expenseId: string;
  organizationId: string;
  expenseNumber: string;
  expenseCategoryId: string;
  amount: { amount: number; currency: string };
  paidVia: ExpensePaidVia;
  businessDate: string;
  locationId: string;
  note: string | null;
  attachmentFileIds: string[];
  status: ExpenseStatus;
  customFields: Record<string, unknown>;
  voidReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const localizedNameSchema = new Schema(
  { bn: { type: String, required: true }, en: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const moneySchema = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const expenseCategorySchema = new Schema<ExpenseCategoryDocument>(
  {
    ...domainIdField("expenseCategoryId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: localizedNameSchema, required: true },
    accountId: { type: String, required: true },
    accountCode: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(EXPENSE_CATEGORY_STATUS) },
    isSystem: { type: Boolean, required: true },
    categoryKey: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

expenseCategorySchema.index({ organizationId: 1, accountCode: 1 }, { unique: true });
expenseCategorySchema.index(
  { organizationId: 1, categoryKey: 1 },
  { unique: true, partialFilterExpression: { categoryKey: { $type: "string" } } },
);
expenseCategorySchema.index({ organizationId: 1, status: 1 });

export const expenseSchema = new Schema<ExpenseDocument>(
  {
    ...domainIdField("expenseId"),
    organizationId: { type: String, required: true, immutable: true },
    expenseNumber: { type: String, required: true },
    expenseCategoryId: { type: String, required: true },
    amount: { type: moneySchema, required: true },
    paidVia: { type: String, required: true, enum: Object.values(EXPENSE_PAID_VIA) },
    businessDate: { type: String, required: true },
    locationId: { type: String, required: true },
    note: { type: String, default: null },
    attachmentFileIds: { type: [String], default: [] },
    status: { type: String, required: true, enum: Object.values(EXPENSE_STATUS) },
    customFields: { type: Schema.Types.Mixed, default: {} },
    voidReason: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

expenseSchema.index({ organizationId: 1, expenseNumber: 1 }, { unique: true });
expenseSchema.index({ organizationId: 1, businessDate: -1, expenseId: -1 });
expenseSchema.index({ organizationId: 1, locationId: 1, businessDate: -1 });
expenseSchema.index({ organizationId: 1, expenseCategoryId: 1, businessDate: -1 });
