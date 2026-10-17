import {
  PERMISSION_KEY,
  type LocationResponse,
  type OrganizationProfileResponse,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { PageLayout, PageSection, formatPhoneForDisplay } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { CustomFieldDetailList } from "../custom-fields/custom-field-detail-list";
import { customFieldPartsOf } from "../custom-fields/custom-field-parts";
import { EditProfileButton } from "./edit-profile-button";
import { ProfileLocationsSection } from "./profile-locations-section";
import { profileLabelsOf } from "./profile-labels";
import { profileToFormState } from "./profile-state";

const LOCATION_PAGE_SIZE = 100;

interface Fact {
  label: string;
  value: string | undefined;
}

interface FactListProps {
  title: string;
  help: string;
  facts: Fact[];
  t: Translator["t"];
}

function FactList({ title, help, facts, t }: FactListProps): ReactElement {
  return (
    <PageSection title={title} help={help}>
      <dl className="grid gap-4 md:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1">
            <dt className="text-small text-secondary">{fact.label}</dt>
            <dd className="break-words text-body text-primary">
              {fact.value || t("profile.notSet")}
            </dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}

function businessFacts(profile: OrganizationProfileResponse, t: Translator["t"]): Fact[] {
  const { profile: fields } = profile;
  return [
    { label: t("profile.field.name"), value: profile.name },
    {
      label: t("profile.field.defaultLocale"),
      value: t(`profile.locale.${profile.defaultLocale}`),
    },
    { label: t("profile.field.legalName"), value: fields.legalName },
    { label: t("profile.field.legalType"), value: fields.legalType },
    {
      label: t("profile.field.phone"),
      value: fields.phoneE164 ? formatPhoneForDisplay(fields.phoneE164) : undefined,
    },
    { label: t("profile.field.email"), value: fields.email },
    { label: t("profile.field.tradeLicenseNumber"), value: fields.tradeLicenseNumber },
  ];
}

function addressFacts(profile: OrganizationProfileResponse, t: Translator["t"]): Fact[] {
  const address = profile.profile.address;
  return [
    { label: t("address.line1"), value: address?.line1 },
    { label: t("address.area"), value: address?.area },
    { label: t("address.thana"), value: address?.thana },
    { label: t("address.district"), value: address?.district },
    { label: t("address.postalCode"), value: address?.postalCode },
  ];
}

function fixedFacts(profile: OrganizationProfileResponse, t: Translator["t"]): Fact[] {
  return [
    { label: t("profile.field.slug"), value: profile.slug },
    { label: t("profile.field.currency"), value: profile.currencyCode },
    { label: t("profile.field.timezone"), value: profile.timezone },
    { label: t("profile.field.country"), value: profile.countryCode },
  ];
}

/** The business and address sections: the facts every member may read. */
function ProfileFacts({
  profile,
  t,
}: {
  profile: OrganizationProfileResponse;
  t: Translator["t"];
}): ReactElement {
  return (
    <>
      <FactList
        title={t("profile.section.business")}
        help={t("profile.section.business.help")}
        facts={businessFacts(profile, t)}
        t={t}
      />
      <FactList
        title={t("profile.section.address")}
        help={t("profile.section.address.help")}
        facts={addressFacts(profile, t)}
        t={t}
      />
    </>
  );
}

function canEditProfile(access: OrgAccess): boolean {
  const { permissions } = access.config;
  return (
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE)
  );
}

/** Sensitive extra details are shown only to someone who may edit the profile at every location (ADR-107). */
function canSeeSensitiveDetails(access: OrgAccess): boolean {
  return holdsPermissionEverywhere(
    access.config.permissions,
    PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
  );
}

/**
 * `/{orgSlug}/settings/profile`: the business details and its locations. Any member may read the
 * profile; the edit button shows only with the permission and outside READ_ONLY (the API enforces both).
 */
export async function ProfilePage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { organizationId } = access.organization;
  const [profileResult, locations] = await Promise.all([
    fetchBusinessResource<OrganizationProfileResponse>(`/orgs/${organizationId}/profile`),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_PAGE_SIZE}`,
    ),
  ]);
  const profile = profileResult.data;
  const customFieldParts = customFieldPartsOf({
    fields: access.config.fields["organization"] ?? [],
    values: profile.customFields,
    canSeeSensitive: canSeeSensitiveDetails(access),
    translator,
    timeZone: access.timeZone,
    currencyCode: profile.currencyCode,
  });
  return (
    <PageLayout
      title={t("profile.title")}
      subtitle={t("profile.subtitle")}
      actions={
        canEditProfile(access) ? (
          <EditProfileButton
            label={t("profile.edit")}
            sheetProps={{
              organizationId,
              initial: profileToFormState(profile),
              version: profile.version,
              labels: profileLabelsOf(t),
              customFields: customFieldParts.form,
            }}
          />
        ) : null
      }
    >
      <ProfileFacts profile={profile} t={t} />
      <CustomFieldDetailList {...customFieldParts.list} />
      <ProfileLocationsSection
        access={access}
        locations={locations}
        t={t}
        locale={translator.locale}
        orgSlug={orgSlug}
      />
      <FactList
        title={t("profile.section.fixed")}
        help={t("profile.fixed.hint")}
        facts={fixedFacts(profile, t)}
        t={t}
      />
    </PageLayout>
  );
}
