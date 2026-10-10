import { asId, type UserId } from "@banijjik/ids";

/** The audit field `createdByUserId` is null for records the system wrote itself. */
export function toAuthorId(stored: string | null): UserId | null {
  return stored === null ? null : asId<UserId>(stored);
}
