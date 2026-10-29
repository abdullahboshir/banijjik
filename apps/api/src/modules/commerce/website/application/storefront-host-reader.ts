import { SITE_DOMAIN_STATUS } from "@banijjik/contracts/website";
import type { SiteDomainId } from "@banijjik/ids";
import { normalizeHostname, type HostClaimResolution } from "../../../platform/operations/index.js";
import type { Site } from "../domain/site.entity.js";
import type { SiteDomain } from "../domain/site-domain.entity.js";
import type { SiteRepository } from "./ports/site-repository.js";

export interface StorefrontHostRead {
  readonly organizationId: string;
  readonly generation: number;
  readonly canonicalHostname: string;
  readonly publishedWebsiteVersionId: string;
}

export interface ActiveStorefrontOrganization {
  readonly organizationId: string;
  readonly slug: string;
}

export interface StorefrontHostLookup {
  readonly host: string;
  readonly baseDomain: string;
  readonly nodeEnv: string;
  readonly claims: {
    resolve(hostname: string): Promise<HostClaimResolution | undefined>;
  };
  readonly organizations: {
    findActiveBySlug(slug: string): Promise<ActiveStorefrontOrganization | undefined>;
    findActiveById(organizationId: string): Promise<ActiveStorefrontOrganization | undefined>;
  };
  readonly isWebsiteEffective: (organizationId: string) => Promise<boolean>;
  readonly runInOrganization: <Result>(
    organizationId: string,
    work: () => Promise<Result>,
  ) => Promise<Result>;
  readonly reader: StorefrontHostReader;
}

export class StorefrontHostReader {
  constructor(
    private readonly dependencies: {
      readonly sites: SiteRepository;
      readonly domains: {
        findById(siteDomainId: SiteDomainId): Promise<SiteDomain | undefined>;
        findByHostname(hostname: string): Promise<SiteDomain | undefined>;
      };
    },
  ) {}

  async resolve(input: {
    readonly hostname: string;
    readonly freeHostname: string;
    readonly organizationId: string;
    readonly claim?: HostClaimResolution;
  }): Promise<StorefrontHostRead | undefined> {
    const site = await this.dependencies.sites.findCurrent();
    if (site === undefined || site.publishedWebsiteVersionId === null) return undefined;
    const domain = await this.dependencies.domains.findByHostname(input.hostname);
    if (!isRequestedDomainEligible(domain, site.siteId, input.claim)) return undefined;
    const canonicalHostname = await this.readCanonicalHostname(site, input.freeHostname);

    return {
      organizationId: input.organizationId,
      generation: input.claim?.domainGeneration ?? 0,
      canonicalHostname,
      publishedWebsiteVersionId: site.publishedWebsiteVersionId,
    };
  }

  private async readCanonicalHostname(site: Site, freeHostname: string): Promise<string> {
    const canonicalDomainId = site.canonicalSiteDomainId;
    if (canonicalDomainId === null) return freeHostname;
    const domain = await this.dependencies.domains.findById(canonicalDomainId);
    return domain?.status === SITE_DOMAIN_STATUS.ACTIVE && domain.siteId === site.siteId
      ? domain.hostname
      : freeHostname;
  }
}

/** `shop.sites.example.com` under base domain `sites.example.com` is the business slug `shop`. */
export function slugOfFreeHost(host: string, baseDomain: string): string | undefined {
  const hostName = host.toLowerCase();
  const suffix = `.${baseDomain}`;
  if (!hostName.endsWith(suffix)) return undefined;
  const slug = hostName.slice(0, -suffix.length);
  return slug === "" || slug.includes(".") ? undefined : slug;
}

/**
 * Trusts a host only after the platform claim (if any), the active organization, the effective
 * website module and the current published Site all agree.
 */
export async function lookupPublishedStorefrontHost(
  input: StorefrontHostLookup,
): Promise<StorefrontHostRead | undefined> {
  const hostname = hostnameForResolveQuery(input.host, input.baseDomain, input.nodeEnv);
  if (hostname === undefined) return undefined;
  const slug = slugOfFreeHost(hostname, input.baseDomain);
  const claim = slug === undefined ? await input.claims.resolve(hostname) : undefined;
  const organization = await activeOrganizationOf(input.organizations, slug, claim);
  if (organization === undefined) return undefined;
  return input.runInOrganization(organization.organizationId, () =>
    publishedHostOf({ lookup: input, organization, hostname, claim }),
  );
}

function hostnameForResolveQuery(
  host: string,
  baseDomain: string,
  nodeEnvironment: string,
): string | undefined {
  const portMatch = /^(.*):([0-9]{1,5})$/.exec(host);
  if (portMatch === null) return normalizeHostname(host);
  const hostname = portMatch[1];
  const port = Number(portMatch[2]);
  const localPortAllowed =
    nodeEnvironment !== "production" &&
    baseDomain === "localhost" &&
    hostname !== undefined &&
    hostname.endsWith(".localhost") &&
    port > 0 &&
    port <= 65_535;
  return localPortAllowed && hostname !== undefined ? normalizeHostname(hostname) : undefined;
}

function activeOrganizationOf(
  organizations: StorefrontHostLookup["organizations"],
  slug: string | undefined,
  claim: HostClaimResolution | undefined,
): Promise<ActiveStorefrontOrganization | undefined> {
  if (slug !== undefined) return organizations.findActiveBySlug(slug);
  if (claim === undefined) return Promise.resolve(undefined);
  return organizations.findActiveById(claim.organizationId);
}

async function publishedHostOf(input: {
  readonly lookup: StorefrontHostLookup;
  readonly organization: ActiveStorefrontOrganization;
  readonly hostname: string;
  readonly claim: HostClaimResolution | undefined;
}): Promise<StorefrontHostRead | undefined> {
  const { lookup, organization, hostname, claim } = input;
  if (!(await lookup.isWebsiteEffective(organization.organizationId))) return undefined;
  return lookup.reader.resolve({
    hostname,
    freeHostname: `${organization.slug}.${lookup.baseDomain}`,
    organizationId: organization.organizationId,
    ...(claim === undefined ? {} : { claim }),
  });
}

function isRequestedDomainEligible(
  domain: SiteDomain | undefined,
  siteId: Site["siteId"],
  claim: HostClaimResolution | undefined,
): boolean {
  if (claim === undefined) return domain === undefined;
  return (
    domain !== undefined &&
    domain.status === SITE_DOMAIN_STATUS.ACTIVE &&
    domain.operationGeneration === claim.domainGeneration &&
    domain.organizationId === claim.organizationId &&
    domain.siteId === siteId
  );
}
