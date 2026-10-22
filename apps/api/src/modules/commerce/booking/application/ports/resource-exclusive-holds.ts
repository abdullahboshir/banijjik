export interface ResourceExclusiveHoldPort {
  take(input: {
    readonly enrollmentId: string;
    readonly resourceIds: readonly string[];
    readonly locationId: string;
    readonly startsOn: string;
    readonly endsOn: string | null;
    readonly actorUserId: string | null;
  }): Promise<void>;
  release(enrollmentId: string, endsOn: string, actorUserId: string | null): Promise<void>;
}
