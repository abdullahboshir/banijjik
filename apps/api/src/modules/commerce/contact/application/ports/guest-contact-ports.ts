import type {
  CreateProvisionalContactInput,
  ProvisionalContactResult,
} from "@banijjik/contracts/contact";

export interface GuestSessionRecord {
  readonly guestSessionId: string;
  readonly organizationId: string;
  readonly expiresAt: Date;
  readonly provisionalContactId: string | null;
  readonly version: number;
}

export interface LinkProvisionalContactInput {
  readonly organizationId: string;
  readonly guestSessionId: string;
  readonly provisionalContactId: string;
  readonly expectedVersion: number;
}

/**
 * Port to inspect and link guest sessions for provisional contact creation.
 * Allows verifying guest session existence, tenant isolation, expiry,
 * and optimistic atomic link within transactions.
 */
export interface GuestSessionProvisionalLinkPort {
  findSession(guestSessionId: string): Promise<GuestSessionRecord | null>;
  linkProvisionalContact(input: LinkProvisionalContactInput): Promise<boolean>;
}

/**
 * Port used by checkout orchestration UnitOfWork to create or reuse provisional guest contacts.
 */
export interface ProvisionalGuestContactCreator {
  createProvisionalContact(input: CreateProvisionalContactInput): Promise<ProvisionalContactResult>;
}
