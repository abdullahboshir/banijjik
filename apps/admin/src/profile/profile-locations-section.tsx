import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { PageSection, buttonVariants } from "@banijjik/ui";
import { termLabel } from "@banijjik/web-client";
import Link from "next/link";
import type { ReactElement } from "react";
import type { Locale } from "@banijjik/i18n";
import {
  locationFormLabelsOf,
  locationTermOf,
  locationTypeLabels,
} from "../locations/location-labels";
import { NewLocationButton } from "../locations/new-location-button";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";

const LOCATIONS_MENU_THRESHOLD = 2;

export interface ProfileLocationsSectionProps {
  access: OrgAccess;
  /** Absent when the caller may not read locations: the section is then left out. */
  locations: LocationResponse[] | undefined;
  orgSlug: string;
  locale: Locale;
  t: Translator["t"];
}

/**
 * The Locations section of the profile page (plan 1.7d decision 3). It is how a one-location business
 * adds a second one, since the Locations menu entry appears only with two or more active locations.
 */
export function ProfileLocationsSection(props: ProfileLocationsSectionProps): ReactElement | null {
  const { access, locations, orgSlug, locale, t } = props;
  if (!locations) return null;
  const { permissions, limits, terms } = access.config;
  const term = locationTermOf(terms, locale, t);
  const typeLabels = locationTypeLabels(t);
  const canCreate =
    access.canWrite &&
    holdsPermissionEverywhere(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE);
  const hasPage =
    locations.length >= LOCATIONS_MENU_THRESHOLD &&
    holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_READ);
  return (
    <PageSection
      title={termLabel(terms, "location", { locale, fallback: t("profile.locations.title") })}
      help={t(canCreate ? "profile.locations.hint" : "profile.locations.help", { term })}
    >
      <ul className="flex flex-col gap-2">
        {locations.map((location) => (
          <li
            key={location.locationId}
            className="rounded-md border border-default bg-surface p-3 text-body text-primary"
          >
            {location.name} · {typeLabels[location.locationType]}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {canCreate ? (
          <NewLocationButton
            organizationId={access.organization.organizationId}
            label={t("profile.locations.add", { term })}
            variant="secondary"
            labels={locationFormLabelsOf(t, limits.locations, term)}
          />
        ) : null}
        {hasPage ? (
          <Link
            href={`/${orgSlug}/settings/locations`}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("locations.title")}
          </Link>
        ) : null}
      </div>
    </PageSection>
  );
}
