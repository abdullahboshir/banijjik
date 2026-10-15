import type { PreferredLocale } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";

export interface StoredTermOverride {
  readonly termKey: string;
  readonly locale: PreferredLocale;
  readonly text: string;
  readonly version: number;
}

export interface NewTermOverride {
  readonly termOverrideId: string;
  readonly organizationId: OrganizationId;
  readonly termKey: string;
  readonly locale: PreferredLocale;
  readonly text: string;
  readonly actorUserId: UserId;
}

export interface TermOverrideWrite {
  readonly termKey: string;
  readonly locale: PreferredLocale;
  readonly version: number;
  readonly text: string;
  readonly actorUserId: UserId;
}

export interface TermOverrideDelete {
  readonly termKey: string;
  readonly locale: PreferredLocale;
  readonly version: number;
}

export interface TermOverrideRepository {
  list(): Promise<readonly StoredTermOverride[]>;
  insert(row: NewTermOverride): Promise<void>;
  update(row: TermOverrideWrite): Promise<void>;
  delete(row: TermOverrideDelete): Promise<void>;
}
