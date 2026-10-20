import { ALL_LOCATIONS, MEMBER_STATUS, OFFERING_KIND } from "@banijjik/contracts";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { OFFERING_STATUS } from "@banijjik/contracts/catalog";
import {
  asId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
} from "@banijjik/ids";
import { models } from "../../../../kernel/db/index.js";
import { MongoOfferingRepository } from "../../catalog/index.js";
import { buildResourceTypeKeysReader } from "../../../platform/industry/index.js";
import { bookingRuleError } from "../domain/errors.js";

const ORGANIZATION_MODEL_NAME = "Organization";
const MEMBER_MODEL_NAME = "Member";

interface OrganizationRow {
  timezone: string;
}

interface MemberAssignmentRow {
  locationId: string;
}

interface MemberRow {
  status: string;
  assignments: MemberAssignmentRow[];
}

export function buildOrganizationTimezoneReader(): {
  read(organizationId: OrganizationId): Promise<string>;
} {
  return {
    async read(organizationId: OrganizationId): Promise<string> {
      const row = await models({})
        .get<OrganizationRow>(ORGANIZATION_MODEL_NAME)
        .findOne({ organizationId }, { timezone: 1 })
        .lean<OrganizationRow>();
      return row?.timezone ?? "Asia/Dhaka";
    },
  };
}

/** Resource type keys, offering checks and member assignment for resource CRUD. */
export function buildResourceContextPorts(): {
  resourceTypes: ReturnType<typeof buildResourceTypeKeysReader>;
  offerings: {
    assertActiveServiceOfferings(
      organizationId: OrganizationId,
      offeringIds: readonly OfferingId[],
    ): Promise<void>;
  };
  members: {
    isAssignedToLocation(memberId: MemberId, locationId: LocationId): Promise<boolean>;
  };
} {
  const resourceTypes = buildResourceTypeKeysReader();
  const offerings = new MongoOfferingRepository();
  return {
    resourceTypes,
    offerings: {
      async assertActiveServiceOfferings(
        organizationId: OrganizationId,
        offeringIds: readonly OfferingId[],
      ): Promise<void> {
        void organizationId;
        for (const offeringId of offeringIds) {
          const offering = await offerings.findById(offeringId);
          if (
            offering === undefined ||
            offering.kind !== OFFERING_KIND.SERVICE ||
            offering.status !== OFFERING_STATUS.ACTIVE
          ) {
            throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
          }
        }
      },
    },
    members: {
      async isAssignedToLocation(memberId: MemberId, locationId: LocationId): Promise<boolean> {
        const row = await models({})
          .get<MemberRow>(MEMBER_MODEL_NAME)
          .findOne(
            { memberId: asId(memberId), status: MEMBER_STATUS.ACTIVE },
            { assignments: 1, status: 1 },
          )
          .lean<MemberRow>();
        if (row === null) return false;
        return row.assignments.some(
          (assignment) =>
            assignment.locationId === ALL_LOCATIONS || assignment.locationId === locationId,
        );
      },
    },
  };
}
