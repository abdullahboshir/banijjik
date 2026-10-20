import { asId, type LocationId, type MemberId } from "@banijjik/ids";
import { bookingRuleError } from "../domain/errors.js";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";

export async function memberIdAfterUpdate(input: {
  existingMemberId: MemberId | null;
  bodyMemberId: string | null | undefined;
  locationId: LocationId;
  members: {
    isAssignedToLocation(memberId: MemberId, locationId: LocationId): Promise<boolean>;
  };
}): Promise<MemberId | null> {
  if (input.bodyMemberId === undefined) return input.existingMemberId;
  const memberId = input.bodyMemberId === null ? null : asId<MemberId>(input.bodyMemberId);
  if (memberId === null) return null;
  const ok = await input.members.isAssignedToLocation(memberId, input.locationId);
  if (!ok) throw bookingRuleError(BOOKING_RULE_KEY.INVALID_MEMBER_ASSIGNMENT);
  return memberId;
}
