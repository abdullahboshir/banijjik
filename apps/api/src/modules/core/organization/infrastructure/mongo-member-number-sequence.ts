import { SEQUENCE_KEY } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { MemberNumberSequence } from "../application/ports/member-number-sequence.js";

/** MEMBER is a FAST sequence: it runs outside any transaction, so call it before opening one. */
export class MongoMemberNumberSequence implements MemberNumberSequence {
  next(organizationId: OrganizationId): Promise<number> {
    return nextSequenceValue({ organizationId, sequenceKey: SEQUENCE_KEY.MEMBER });
  }
}
