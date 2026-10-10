/**
 * The shape of every domain event (05-CONVENTIONS "Events"). `organizationId` is null only for
 * user-level events such as `iam.user.registered`, which belong to no organization yet.
 */
export interface EventEnvelope<Payload> {
  readonly eventId: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly payload: Payload;
}
