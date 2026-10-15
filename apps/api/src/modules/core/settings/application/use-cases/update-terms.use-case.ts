import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ERROR_CODE,
  SETTINGS_EVENT_TYPE,
  DomainRuleError,
  type PreferredLocale,
  type TermChange,
  type TermView,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { IndustryTermsReader } from "../ports/industry-terms-reader.js";
import { termNotAvailable, termVersionRequired } from "../../domain/term-errors.js";
import type { SettingsEventPublisher } from "../ports/settings-event-publisher.js";
import type {
  StoredTermOverride,
  TermOverrideRepository,
} from "../ports/term-override-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { GetTermsUseCase } from "./get-terms.use-case.js";

export interface UpdateTermsDependencies {
  readonly templateTerms: IndustryTermsReader;
  readonly overrides: TermOverrideRepository;
  readonly unitOfWork: UnitOfWork;
  readonly audit: AuditRecorder;
  readonly events: SettingsEventPublisher;
  readonly configVersion: ConfigVersionBumper;
  readonly readTerms: GetTermsUseCase;
}

export interface UpdateTermsInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly items: readonly TermChange[];
}

interface AppliedTerm {
  readonly termKey: string;
  readonly locale: PreferredLocale;
  readonly from: string | null;
  readonly to: string | null;
}

/**
 * One transaction. A batch that changes something writes one audit entry, one event and one
 * configVersion bump. A batch that changes nothing writes none of those (ADR-104).
 */
export class UpdateTermsUseCase {
  constructor(private readonly dependencies: UpdateTermsDependencies) {}

  async execute(input: UpdateTermsInput): Promise<readonly TermView[]> {
    const allowed = await this.dependencies.templateTerms.forOrganization(input.organizationId);
    assertKnownKeys(input.items, allowed);
    await this.dependencies.unitOfWork.run(() => this.commit(input, allowed));
    return this.dependencies.readTerms.execute(input.organizationId);
  }

  private async commit(
    input: UpdateTermsInput,
    allowed: Readonly<Record<string, { bn: string; en: string }>>,
  ): Promise<void> {
    const rows = await this.dependencies.overrides.list();
    const applied: AppliedTerm[] = [];
    for (const item of input.items) {
      const recorded = await this.apply({ input, item, row: rowOf(rows, item), allowed });
      if (recorded !== undefined) applied.push(recorded);
    }
    if (applied.length === 0) return;
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.TERM_CHANGED,
      entityType: AUDIT_ENTITY_TYPE.termOverride,
      entityId: input.organizationId,
      changes: auditChanges(applied),
    });
    await this.dependencies.events.publish(SETTINGS_EVENT_TYPE.TERM_CHANGED, {
      termKeys: [...new Set(applied.map((entry) => entry.termKey))],
    });
    await this.dependencies.configVersion.bump(input.organizationId);
  }

  private async apply(change: {
    input: UpdateTermsInput;
    item: TermChange;
    row: StoredTermOverride | undefined;
    allowed: Readonly<Record<string, { bn: string; en: string }>>;
  }): Promise<AppliedTerm | undefined> {
    const { input, item, row, allowed } = change;
    if (item.text === null) return this.remove(item, row);
    if (row === undefined) return this.create(input, item, allowed);
    requireVersion(item, row);
    if (row.text === item.text) return undefined;
    await this.dependencies.overrides.update({
      termKey: item.termKey,
      locale: item.locale,
      version: item.version ?? row.version,
      text: item.text,
      actorUserId: input.actorUserId,
    });
    return { termKey: item.termKey, locale: item.locale, from: row.text, to: item.text };
  }

  private async remove(
    item: TermChange,
    row: StoredTermOverride | undefined,
  ): Promise<AppliedTerm | undefined> {
    if (row === undefined) return undefined;
    requireVersion(item, row);
    await this.dependencies.overrides.delete({
      termKey: item.termKey,
      locale: item.locale,
      version: item.version ?? row.version,
    });
    return { termKey: item.termKey, locale: item.locale, from: row.text, to: null };
  }

  private async create(
    input: UpdateTermsInput,
    item: TermChange,
    allowed: Readonly<Record<string, { bn: string; en: string }>>,
  ): Promise<AppliedTerm | undefined> {
    if (item.version !== undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    const templateText = allowed[item.termKey]?.[item.locale];
    if (item.text === templateText) return undefined;
    if (item.text === null) return undefined;
    await this.dependencies.overrides.insert({
      termOverrideId: newId(),
      organizationId: input.organizationId,
      termKey: item.termKey,
      locale: item.locale,
      text: item.text,
      actorUserId: input.actorUserId,
    });
    return { termKey: item.termKey, locale: item.locale, from: null, to: item.text };
  }
}

function assertKnownKeys(
  items: readonly TermChange[],
  allowed: Readonly<Record<string, unknown>>,
): void {
  for (const item of items) {
    if (allowed[item.termKey] === undefined) throw termNotAvailable(item.termKey);
  }
}

function rowOf(
  rows: readonly StoredTermOverride[],
  item: TermChange,
): StoredTermOverride | undefined {
  return rows.find((row) => row.termKey === item.termKey && row.locale === item.locale);
}

function requireVersion(item: TermChange, row: StoredTermOverride): void {
  if (item.version === undefined || item.version !== row.version) {
    throw termVersionRequired(row.version);
  }
}

function auditChanges(applied: readonly AppliedTerm[]) {
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  for (const entry of applied) {
    changes[`${entry.termKey}.${entry.locale}`] = { from: entry.from, to: entry.to };
  }
  return changes;
}
