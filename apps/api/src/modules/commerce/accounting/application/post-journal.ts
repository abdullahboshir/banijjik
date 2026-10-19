import {
  ACCOUNTING_EVENT_TYPE,
  type AccountResponse,
  type JournalEntryResponse,
  type JournalSourceType,
  type PostingKey,
} from "@banijjik/contracts/accounting";
import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  asId,
  type JournalEntryId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { accountNotFound } from "../domain/errors.js";
import { JournalEntry } from "../domain/journal-entry.entity.js";
import {
  assertBalanced,
  type DraftJournalEntry,
  type ResolvedJournalLine,
} from "../domain/journal-lines.js";
import type { AccountRepository } from "./ports/account-repository.js";
import type { JournalRepository } from "./ports/journal-repository.js";

export interface EventPublisher {
  publish(
    type: typeof ACCOUNTING_EVENT_TYPE.JOURNAL_POSTED,
    payload: { readonly journalEntryId: string },
  ): Promise<void>;
}

export interface PostJournalDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

function formatEntryNumber(value: number): string {
  return String(value).padStart(6, "0");
}

async function resolveLines(
  accounts: AccountRepository,
  draft: DraftJournalEntry,
): Promise<ResolvedJournalLine[]> {
  assertBalanced(draft.lines);
  const resolved: ResolvedJournalLine[] = [];
  for (const line of draft.lines) {
    const account = await accounts.findByCode(line.accountCode);
    if (account === undefined) throw accountNotFound(line.accountCode);
    resolved.push({
      accountId: account.accountId,
      accountCode: account.accountCode,
      debit: line.debit,
      credit: line.credit,
    });
  }
  return resolved;
}

export function toAccountResponse(account: {
  readonly accountId: string;
  readonly accountCode: string;
  readonly name: AccountResponse["name"];
  readonly accountType: AccountResponse["accountType"];
  readonly isSystem: boolean;
  readonly status: AccountResponse["status"];
}): AccountResponse {
  return {
    accountId: account.accountId,
    accountCode: account.accountCode,
    name: account.name,
    accountType: account.accountType,
    isSystem: account.isSystem,
    status: account.status,
  };
}

export function toJournalResponse(entry: JournalEntry): JournalEntryResponse {
  return {
    journalEntryId: entry.journalEntryId,
    entryNumber: entry.entryNumber,
    businessDate: entry.businessDate,
    locationId: entry.locationId,
    lines: entry.lines.map((line) => ({ ...line })),
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    postingKey: entry.postingKey,
    reversesJournalEntryId: entry.reversesJournalEntryId,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Posts one balanced draft. Idempotent on (sourceType, sourceId, postingKey): a duplicate insert
 * returns the existing entry without a second event.
 */
async function buildJournalEntry(
  dependencies: PostJournalDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly draft: DraftJournalEntry;
  },
): Promise<JournalEntry> {
  const lines = await resolveLines(dependencies.accounts, input.draft);
  const sequence = await nextSequenceValue({
    organizationId: input.organizationId,
    sequenceKey: SEQUENCE_KEY.JOURNAL,
  });
  return JournalEntry.create({
    organizationId: input.organizationId,
    entryNumber: formatEntryNumber(sequence),
    businessDate: input.draft.businessDate,
    locationId: input.draft.locationId === null ? null : asId<LocationId>(input.draft.locationId),
    lines,
    sourceType: input.draft.sourceType as JournalSourceType,
    sourceId: input.draft.sourceId,
    postingKey: input.draft.postingKey,
    reversesJournalEntryId:
      input.draft.reversesJournalEntryId === undefined
        ? null
        : asId<JournalEntryId>(input.draft.reversesJournalEntryId),
    now: dependencies.clock.now(),
    actorUserId: input.actorUserId,
  });
}

export async function postJournalEntry(
  dependencies: PostJournalDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly draft: DraftJournalEntry;
  },
): Promise<JournalEntry> {
  const { journals, events, audit } = dependencies;
  const existing = await journals.findBySource({
    sourceType: input.draft.sourceType as JournalSourceType,
    sourceId: input.draft.sourceId,
    postingKey: input.draft.postingKey,
  });
  if (existing !== undefined) return existing;
  const entry = await buildJournalEntry(dependencies, input);
  const result = await journals.insert(entry);
  if (result === "duplicate") {
    const raced = await journals.findBySource({
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      postingKey: entry.postingKey,
    });
    if (raced === undefined) throw new Error("journal duplicate without row");
    return raced;
  }
  await audit.record({
    action: AUDIT_ACTION.JOURNAL_POSTED,
    entityType: "journalEntry",
    entityId: entry.journalEntryId,
    changes: {
      postingKey: { to: entry.postingKey },
      sourceType: { to: entry.sourceType },
    },
  });
  await events.publish(ACCOUNTING_EVENT_TYPE.JOURNAL_POSTED, {
    journalEntryId: entry.journalEntryId,
  });
  return entry;
}

/** Posts a mirrored reversal of an earlier entry (same sourceId, postingKey `reversal` or custom). */
export async function postReversal(
  dependencies: PostJournalDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly original: JournalEntry;
    readonly postingKey: PostingKey;
    readonly businessDate: string;
  },
): Promise<JournalEntry> {
  return postJournalEntry(dependencies, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    draft: {
      businessDate: input.businessDate,
      locationId: input.original.locationId,
      sourceType: input.original.sourceType,
      sourceId: input.original.sourceId,
      postingKey: input.postingKey,
      reversesJournalEntryId: input.original.journalEntryId,
      lines: input.original.lines.map((line) => ({
        accountCode: line.accountCode,
        debit: line.credit,
        credit: line.debit,
      })),
    },
  });
}
