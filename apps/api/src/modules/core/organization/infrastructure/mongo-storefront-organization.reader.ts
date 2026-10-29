import { ORGANIZATION_STATUS } from "@banijjik/contracts";
import { models } from "../../../../kernel/db/index.js";
import type {
  StorefrontOrganization,
  StorefrontOrganizationReader,
} from "../application/ports/storefront-organization-reader.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

const PROJECTION = {
  organizationId: 1,
  slug: 1,
  name: 1,
  defaultLocale: 1,
  configVersion: 1,
  branding: 1,
  _id: 0,
} as const;

type Row = Pick<
  OrganizationDocument,
  "organizationId" | "slug" | "name" | "defaultLocale" | "configVersion" | "branding"
>;

/** Missing branding (created before card 3.12) reads as no branding, never as an error. */
function toStorefrontOrganization(row: Row): StorefrontOrganization {
  return {
    organizationId: row.organizationId,
    slug: row.slug,
    name: row.name,
    defaultLocale: row.defaultLocale,
    configVersion: row.configVersion,
    tagline: row.branding?.tagline ?? null,
    logoFileId: row.branding?.logoFileId ?? null,
    primaryColor: row.branding?.primaryColor ?? null,
    accentColor: row.branding?.accentColor ?? null,
  };
}

/** Each lookup is one indexed read (the slug and the organization id are both unique). */
export class MongoStorefrontOrganizationReader implements StorefrontOrganizationReader {
  findActiveBySlug(slug: string): Promise<StorefrontOrganization | undefined> {
    return this.findActive({ slug });
  }

  findActiveById(organizationId: string): Promise<StorefrontOrganization | undefined> {
    return this.findActive({ organizationId });
  }

  private async findActive(filter: object): Promise<StorefrontOrganization | undefined> {
    const row = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne({ ...filter, status: ORGANIZATION_STATUS.ACTIVE }, PROJECTION)
      .lean<Row>();
    return row === null ? undefined : toStorefrontOrganization(row);
  }
}
