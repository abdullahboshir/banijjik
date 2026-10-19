import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  type JournalSourceType,
  type PostingKey,
} from "@banijjik/contracts/accounting";
import { Schema } from "mongoose";
import { domainIdField, SCHEMA_OPTIONS, SUB_SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const JOURNAL_ENTRY_MODEL_NAME = "JournalEntry";
export const JOURNAL_ENTRY_COLLECTION_NAME = "journal_entries";

export interface JournalLineDocument {
  accountId: string;
  accountCode: string;
  debit: { amount: number; currency: string };
  credit: { amount: number; currency: string };
}

export interface JournalEntryDocument {
  journalEntryId: string;
  organizationId: string;
  entryNumber: string;
  businessDate: string;
  locationId: string | null;
  lines: JournalLineDocument[];
  sourceType: JournalSourceType;
  sourceId: string;
  postingKey: PostingKey;
  reversesJournalEntryId: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  updatedAt: Date;
  updatedByUserId: string | null;
}

const moneySchema = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const lineSchema = new Schema<JournalLineDocument>(
  {
    accountId: { type: String, required: true },
    accountCode: { type: String, required: true },
    debit: { type: moneySchema, required: true },
    credit: { type: moneySchema, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const journalEntrySchema = new Schema<JournalEntryDocument>(
  {
    ...domainIdField("journalEntryId"),
    organizationId: { type: String, required: true, immutable: true },
    entryNumber: { type: String, required: true },
    businessDate: { type: String, required: true },
    locationId: { type: String, default: null },
    lines: { type: [lineSchema], required: true },
    sourceType: { type: String, required: true, enum: Object.values(JOURNAL_SOURCE_TYPE) },
    sourceId: { type: String, required: true },
    postingKey: { type: String, required: true, enum: Object.values(POSTING_KEY) },
    reversesJournalEntryId: { type: String, default: null },
    createdAt: { type: Date, required: true },
    createdByUserId: { type: String, default: null },
    updatedAt: { type: Date, required: true },
    updatedByUserId: { type: String, default: null },
  },
  SCHEMA_OPTIONS,
);

journalEntrySchema.index(
  { organizationId: 1, sourceType: 1, sourceId: 1, postingKey: 1 },
  { unique: true },
);
journalEntrySchema.index({ organizationId: 1, businessDate: 1, entryNumber: 1 });
journalEntrySchema.index({ organizationId: 1, sourceType: 1, businessDate: 1 });
