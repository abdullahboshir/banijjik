import type { GuestSessionEntity } from "@banijjik/contracts/website";

export interface UpdateGuestSessionProvisionalContactInput {
  readonly organizationId: string;
  readonly guestSessionId: string;
  readonly provisionalContactId: string;
  readonly expectedVersion: number;
}

export interface GuestSessionRepository {
  findById(organizationId: string, guestSessionId: string): Promise<GuestSessionEntity | null>;
  findBySessionId(guestSessionId: string): Promise<GuestSessionEntity | null>;
  create(entity: GuestSessionEntity): Promise<void>;
  updateProvisionalContact(input: UpdateGuestSessionProvisionalContactInput): Promise<boolean>;
}
