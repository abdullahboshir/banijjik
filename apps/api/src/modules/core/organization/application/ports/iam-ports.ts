import type { PreferredLocale } from "@banijjik/contracts";
import type { OrganizationId, RoleId, UserId } from "@banijjik/ids";
import type { RoleGrants } from "../../domain/assignment-rules.js";
import type { UserIdentifiers } from "../../domain/invitation.entity.js";

/** Creates the system roles of a new organization. The iam module implements it (ADR-011: through its index.ts only). */
export interface SystemRoleProvisioner {
  provision(organizationId: OrganizationId, actorUserId: UserId): Promise<{ ownerRoleId: RoleId }>;
}

/** Turns role IDs into role keys in one query. The iam module implements it. */
export interface RoleKeyLookup {
  findRoleKeysByIds(
    organizationIds: readonly OrganizationId[],
    roleIds: readonly RoleId[],
  ): Promise<ReadonlyMap<RoleId, string>>;
}

export interface ActorProfile {
  readonly name: string;
  readonly preferredLocale: PreferredLocale;
}

/** The display name and language of the signed-in user. The iam module implements it. */
export interface ActorProfileReader {
  findProfile(userId: UserId): Promise<ActorProfile | undefined>;
}

/** Which of the given roles exist, are ACTIVE, are the OWNER role, and what they grant. The iam module implements it. */
export interface RoleGrantLookup {
  findGrants(roleIds: readonly RoleId[]): Promise<RoleGrants>;
}

export type IdentifierLookupQuery = { readonly email: string } | { readonly phoneE164: string };

/** The email and phone number of a user, and the reverse lookup. The iam module implements it. */
export interface UserIdentifierLookup {
  findIdentifiers(userId: UserId): Promise<UserIdentifiers | undefined>;
  findUserIdByIdentifier(query: IdentifierLookupQuery): Promise<UserId | undefined>;
}
