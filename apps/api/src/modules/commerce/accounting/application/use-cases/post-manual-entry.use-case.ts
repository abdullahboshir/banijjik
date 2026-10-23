import { manualJournalEntryRequestSchema } from "@banijjik/validation/accounting";
import { createHash } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  ACCOUNT_STATUS,
  JOURNAL_SOURCE_TYPE,
  manualJournalContent,
  type JournalEntryResponse,
  type ManualJournalEntryRequest,
  type PostingKey,
} from "@banijjik/contracts/accounting";
import { newId, asId, type AccountId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { AppError, conflict, notFound } from "../../../../../kernel/http/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import {
  requireOrganizationCurrency,
  type OrganizationCurrencyPort,
} from "../organization-currency.js";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";
import { postJournalEntry, toJournalResponse, type EventPublisher } from "../post-journal.js";
import type { DraftJournalLine } from "../../domain/journal-lines.js";
import { accountArchived, futureBusinessDate } from "../../domain/bookkeeping-errors.js";
export interface PostManualEntryInput extends ManualJournalEntryRequest {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly idempotencyKey: string;
  readonly allowedLocationIds: readonly string[] | "ALL";
}
export interface PostManualEntryDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly unitOfWork: { run<T>(work: () => Promise<T>): Promise<T> };
  readonly currencies: OrganizationCurrencyPort;
  readonly policy: { ownerMaySkip(organizationId: OrganizationId): Promise<boolean> };
  readonly locations: { isActiveLocation(locationId: string): Promise<boolean> };
}
export class PostManualEntryUseCase {
  constructor(private readonly deps: PostManualEntryDependencies) {}
  async execute(input: PostManualEntryInput): Promise<JournalEntryResponse> {
    assertManualRequest(input);
    if (input.businessDate > this.deps.clock.now().toISOString().slice(0, 10))
      throw futureBusinessDate();
    await assertJournalLocation(this.deps, input.locationId, input.allowedLocationIds);
    const currency = await this.deps.currencies.read(input.organizationId);
    if (input.lines.some((line) => (line.debit?.currency ?? line.credit?.currency) !== currency))
      throw new AppError({ code: ERROR_CODE.VALIDATION_ERROR });
    const operation = digest(input.actorUserId + ":" + input.idempotencyKey);
    const requestFingerprint = digest(manualJournalContent(input));
    const journalEntryId = newId();
    const postingKey: PostingKey = `manual:${journalEntryId}`;
    return this.deps.unitOfWork.run(async () => {
      if (this.deps.journals.findManualOperation === undefined)
        throw new Error("Manual operation lookup required");
      const existing = await this.deps.journals.findManualOperation(operation);
      if (existing !== undefined) {
        if (existing.requestFingerprint !== requestFingerprint) throw conflict({ operation });
        return toJournalResponse(existing);
      }
      const lines = await resolveManualLines(this.deps.accounts, input);
      await consumeJournalApproval(this.deps, {
        organizationId: input.organizationId,
        requestedByUserId: input.actorUserId,
        locationId: input.locationId ?? "ALL",
        token: input.approvalToken,
        subjectKey: "manual:" + requestFingerprint,
        amount: lines.reduce((sum, line) => sum + line.debit.amount, 0),
      });
      const entry = await postJournalEntry(this.deps, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        draft: {
          journalEntryId,
          requestFingerprint,
          memo: input.memo,
          businessDate: input.businessDate,
          locationId: input.locationId ?? null,
          sourceType: JOURNAL_SOURCE_TYPE.MANUAL,
          sourceId: journalEntryId,
          operationKey: operation,
          postingKey,
          lines,
        },
      });
      return toJournalResponse(entry);
    });
  }
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
async function resolveManualLines(
  accounts: AccountRepository,
  input: PostManualEntryInput,
): Promise<DraftJournalLine[]> {
  const lines: DraftJournalLine[] = [];
  for (const line of input.lines) lines.push(await resolveManualLine(accounts, input, line));
  const debit = lines.reduce((sum, line) => sum + line.debit.amount, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit.amount, 0);
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit !== credit)
    throw new AppError({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: "errors.accounting.unbalanced_journal",
    });
  return lines;
}
export async function consumeJournalApproval(
  deps: PostManualEntryDependencies,
  expected: {
    organizationId: OrganizationId;
    requestedByUserId: UserId;
    locationId: string;
    token: string | undefined;
    subjectKey: string;
    amount: number;
  },
): Promise<void> {
  const { organizationId, requestedByUserId, locationId, token, subjectKey, amount } = expected;
  if (await deps.policy.ownerMaySkip(organizationId)) return;
  if (token === undefined) throw new AppError({ code: ERROR_CODE.APPROVAL_REQUIRED });
  const currency = await requireOrganizationCurrency(deps.currencies, organizationId);
  await deps.approvals.consume(token, {
    action: APPROVAL_ACTION.MANUAL_JOURNAL,
    requestedByUserId,
    locationId,
    subjectKey,
    amount: { amount, currency },
  });
}
export async function assertJournalLocation(
  deps: PostManualEntryDependencies,
  locationId: string | undefined,
  allowed: readonly string[] | "ALL",
): Promise<void> {
  if (locationId === undefined) {
    if (allowed !== "ALL") throw new AppError({ code: ERROR_CODE.FORBIDDEN });
    return;
  }
  if (
    (allowed !== "ALL" && !allowed.includes(locationId)) ||
    !(await deps.locations.isActiveLocation(locationId))
  )
    throw new AppError({ code: ERROR_CODE.FORBIDDEN });
}

function assertManualRequest(input: PostManualEntryInput): void {
  const parsed = manualJournalEntryRequestSchema.safeParse({
    businessDate: input.businessDate,
    locationId: input.locationId,
    memo: input.memo,
    lines: input.lines,
    approvalToken: input.approvalToken,
  });
  if (!parsed.success || input.idempotencyKey.trim() === "")
    throw new AppError({ code: ERROR_CODE.VALIDATION_ERROR });
}

async function resolveManualLine(
  accounts: AccountRepository,
  input: PostManualEntryInput,
  line: PostManualEntryInput["lines"][number],
): Promise<DraftJournalLine> {
  const account = await accounts.findById(asId<AccountId>(line.accountId));
  if (account === undefined || account.organizationId !== input.organizationId) throw notFound();
  if (account.status === ACCOUNT_STATUS.ARCHIVED) throw accountArchived();
  const currency = line.debit?.currency ?? line.credit?.currency;
  if (currency === undefined) throw new AppError({ code: ERROR_CODE.VALIDATION_ERROR });
  return {
    accountCode: account.accountCode,
    debit: line.debit ?? { amount: 0, currency },
    credit: line.credit ?? { amount: 0, currency },
  };
}
