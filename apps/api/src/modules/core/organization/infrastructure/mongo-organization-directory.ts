import { LOCATION_STATUS, MEMBER_STATUS } from "@banijjik/contracts";
import { escapeRegExp } from "@banijjik/validation";
import { models } from "../../../../kernel/db/index.js";
import type {
  OrganizationAdminView,
  OrganizationDirectory,
  OrganizationDirectoryPage,
  OrganizationDirectoryQuery,
} from "../application/ports/organization-directory.js";
import { LOCATION_MODEL_NAME, type LocationDocument } from "./location.schema.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

const LIST_SORT = { createdAt: -1, organizationId: -1 } as const;

/** Case-sensitive prefix on name and slug, so both use their index (slugs are lower case). */
function toFilter(query: OrganizationDirectoryQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.status !== undefined) filter["status"] = query.status;
  if (query.search === undefined) return filter;
  const namePrefix = new RegExp(`^${escapeRegExp(query.search)}`);
  const slugPrefix = new RegExp(`^${escapeRegExp(query.search.toLowerCase())}`);
  filter["$or"] = [{ name: namePrefix }, { slug: slugPrefix }];
  return filter;
}

function toView(document: OrganizationDocument): OrganizationAdminView {
  return {
    organizationId: document.organizationId,
    slug: document.slug,
    name: document.name,
    status: document.status,
    templateKey: document.industryTemplateKey,
    ownerUserId: document.ownerUserId,
    version: document.version,
    createdAt: document.createdAt,
  };
}

interface MemberCountRow {
  readonly _id: string;
  readonly memberCount: number;
}

/**
 * The reads behind the platform tenant list and detail. Organizations are platform data; members
 * and locations are tenant data, which the tenant plugin only lets through under system access.
 */
export class MongoOrganizationDirectory implements OrganizationDirectory {
  async list(query: OrganizationDirectoryQuery): Promise<OrganizationDirectoryPage> {
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.organizations()
      .find(toFilter(query))
      .sort(LIST_SORT)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<OrganizationDocument[]>();
    return {
      items: documents.slice(0, query.limit).map(toView),
      hasNext: documents.length > query.limit,
    };
  }

  async findById(organizationId: string): Promise<OrganizationAdminView | undefined> {
    const document = await this.organizations()
      .findOne({ organizationId })
      .lean<OrganizationDocument>();
    return document === null ? undefined : toView(document);
  }

  async countActiveMembers(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (organizationIds.length === 0) return new Map();
    const rows = await models({})
      .get<MemberDocument>(MEMBER_MODEL_NAME)
      .aggregate<MemberCountRow>([
        { $match: { organizationId: { $in: [...organizationIds] }, status: MEMBER_STATUS.ACTIVE } },
        { $group: { _id: "$organizationId", memberCount: { $sum: 1 } } },
      ]);
    return new Map(rows.map((row) => [row._id, row.memberCount]));
  }

  countActiveLocations(organizationId: string): Promise<number> {
    return models({})
      .get<LocationDocument>(LOCATION_MODEL_NAME)
      .countDocuments({ organizationId, status: LOCATION_STATUS.ACTIVE });
  }

  async findOwnerDisplayName(
    organizationId: string,
    ownerUserId: string,
  ): Promise<string | undefined> {
    const owner = await models({})
      .get<MemberDocument>(MEMBER_MODEL_NAME)
      .findOne({ organizationId, userId: ownerUserId }, { displayName: 1, _id: 0 })
      .lean<Pick<MemberDocument, "displayName">>();
    return owner?.displayName;
  }

  private organizations() {
    return models({}).get<OrganizationDocument>(ORGANIZATION_MODEL_NAME);
  }
}
