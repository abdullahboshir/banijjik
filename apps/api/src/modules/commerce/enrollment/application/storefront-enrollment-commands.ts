import { DomainRuleError, ERROR_CODE, OFFERING_KIND } from "@banijjik/contracts";
import { ENROLLMENT_CREATION_MODE, ENROLLMENT_RULE_KEY } from "@banijjik/contracts/enrollment";
import type {
  CheckoutRequestLink,
  CheckoutSelection,
  PublicEnrollmentCommands,
  StorefrontCommandContext,
} from "@banijjik/contracts/website";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import type { EnrollmentDependencies } from "./dependencies.js";
import { calculateUpfrontObligation, createEnrollment } from "./create-enrollment.js";
import type { EnrollmentCaller } from "./ports.js";

export interface EnrollmentStorefrontDependencies extends EnrollmentDependencies {
  readonly kinds?: {
    effectiveKinds(organizationId: OrganizationId): Promise<readonly string[]>;
  };
}

export function buildStorefrontEnrollmentCommands(
  dependencies: EnrollmentStorefrontDependencies,
): PublicEnrollmentCommands {
  return {
    request: async (
      context: StorefrontCommandContext,
      input: CheckoutSelection,
    ): Promise<CheckoutRequestLink> => {
      if (input.selection.kind !== "PLAN") {
        throw new DomainRuleError({
          code: ERROR_CODE.VALIDATION_ERROR,
          messageKey: ENROLLMENT_RULE_KEY.PLAN,
        });
      }

      const organizationId = asId<OrganizationId>(context.organizationId);
      if (dependencies.kinds) {
        const effectiveKinds = await dependencies.kinds.effectiveKinds(organizationId);
        if (!effectiveKinds.includes(OFFERING_KIND.PLAN)) {
          throw new DomainRuleError({
            code: ERROR_CODE.NOT_FOUND,
            messageKey: ENROLLMENT_RULE_KEY.PLAN,
          });
        }
      }

      const selection = input.selection;
      const caller: EnrollmentCaller = {
        organizationId: context.organizationId,
        actorUserId: null,
        allowedLocationIds: [context.locationId],
        creationMode: ENROLLMENT_CREATION_MODE.CUSTOMER_REQUEST,
        checkoutId: context.checkoutId,
      };

      const body: EnrollmentCreateBody = {
        locationId: context.locationId,
        contactId: context.contactId,
        billToContactId:
          (input as { billToContactId?: string }).billToContactId ??
          (input.customFields?.billToContactId as string | undefined),
        offeringId: selection.offeringId,
        variantId: selection.variantId,
        startsOn: selection.startsOn,
        resourceIds: selection.resourceIds ? [...selection.resourceIds] : [],
        customFields: input.customFields ?? {},
      };

      const result = await createEnrollment(dependencies, caller, body);
      const paymentRequired = calculateUpfrontObligation(result.plan, result.firstRecurringFee);

      return {
        selectionIds: [input.selectionId],
        requestType: "ENROLLMENT",
        requestId: result.enrollmentId,
        publicNumber: result.enrollmentNumber,
        status: result.status,
        paymentRequired,
        holdExpiresAt: null,
      };
    },
  };
}
