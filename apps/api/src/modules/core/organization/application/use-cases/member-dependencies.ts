import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { AssignmentGuard } from "../assignment-guard.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { InvitationRepository } from "../ports/invitation-repository.js";
import type { MemberManagementRepository } from "../ports/member-management-repository.js";
import type { OrganizationProfileRepository } from "../ports/organization-profile-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface MemberDependencies {
  readonly members: MemberManagementRepository;
  readonly organizations: Pick<OrganizationProfileRepository, "findById">;
  readonly guard: AssignmentGuard;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  /** A member who loses access takes the invitations they sent with them (review J1). */
  readonly invitations: InvitationRepository;
  readonly clock: Clock;
}
