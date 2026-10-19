import type { JournalSourceType, Money, PostingKey } from "@banijjik/contracts/accounting";
import {
  asId,
  newId,
  type JournalEntryId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { ResolvedJournalLine } from "./journal-lines.js";

export interface JournalEntryProps {
  readonly journalEntryId: JournalEntryId;
  readonly organizationId: OrganizationId;
  readonly entryNumber: string;
  readonly businessDate: string;
  readonly locationId: LocationId | null;
  readonly lines: readonly ResolvedJournalLine[];
  readonly sourceType: JournalSourceType;
  readonly sourceId: string;
  readonly postingKey: PostingKey;
  readonly reversesJournalEntryId: JournalEntryId | null;
  readonly createdAt: Date;
  readonly createdByUserId: UserId | null;
}

export class JournalEntry {
  private constructor(private readonly props: JournalEntryProps) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly entryNumber: string;
    readonly businessDate: string;
    readonly locationId: LocationId | null;
    readonly lines: readonly ResolvedJournalLine[];
    readonly sourceType: JournalSourceType;
    readonly sourceId: string;
    readonly postingKey: PostingKey;
    readonly reversesJournalEntryId: JournalEntryId | null;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): JournalEntry {
    return new JournalEntry({
      journalEntryId: asId<JournalEntryId>(newId()),
      organizationId: input.organizationId,
      entryNumber: input.entryNumber,
      businessDate: input.businessDate,
      locationId: input.locationId,
      lines: input.lines,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      postingKey: input.postingKey,
      reversesJournalEntryId: input.reversesJournalEntryId,
      createdAt: input.now,
      createdByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: JournalEntryProps): JournalEntry {
    return new JournalEntry(props);
  }

  get journalEntryId(): JournalEntryId {
    return this.props.journalEntryId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get entryNumber(): string {
    return this.props.entryNumber;
  }

  get businessDate(): string {
    return this.props.businessDate;
  }

  get locationId(): LocationId | null {
    return this.props.locationId;
  }

  get lines(): readonly ResolvedJournalLine[] {
    return this.props.lines;
  }

  get sourceType(): JournalSourceType {
    return this.props.sourceType;
  }

  get sourceId(): string {
    return this.props.sourceId;
  }

  get postingKey(): PostingKey {
    return this.props.postingKey;
  }

  get reversesJournalEntryId(): JournalEntryId | null {
    return this.props.reversesJournalEntryId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  debitTotal(): Money {
    const currency = this.props.lines[0]?.debit.currency ?? "BDT";
    return {
      amount: this.props.lines.reduce((sum, line) => sum + line.debit.amount, 0),
      currency,
    };
  }

  creditTotal(): Money {
    const currency = this.props.lines[0]?.credit.currency ?? "BDT";
    return {
      amount: this.props.lines.reduce((sum, line) => sum + line.credit.amount, 0),
      currency,
    };
  }
}
