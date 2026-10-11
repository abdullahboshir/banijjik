import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { locationFormLabelsOf, locationTypeLabels } from "../locations/location-labels";
import { NewLocationButton } from "../locations/new-location-button";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";

const LOCATIONS_MENU_THRESHOLD = 2;

export interface ProfileLocationsSectionProps {
  access: OrgAccess;
  /** Absent when the caller may not read locations: the section is then left out. */
  locations: LocationResponse[] | undefined;
  orgSlug: string;
  t: Translator["t"];
}

/**
 * The Locations section of the profile page (plan 1.7d decision 3). It is how a one-location business
 * adds a second one, since the Locations menu entry appears only with two or more active locations.
 */
export function ProfileLocationsSection(props: ProfileLocationsSectionProps): ReactElement | null {
  const { access, locations, orgSlug, t } = props;
  if (!locations) return null;
  const { permissions, limits } = access.config;
  const typeLabels = locationTypeLabels(t);
  const canCreate =
    access.canWrite &&
    holdsPermissionEverywhere(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE);
  const hasPage =
    locations.length >= LOCATIONS_MENU_THRESHOLD &&
    holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_READ);
  return (
    <section className="mb-6" aria-labelledby="profile-locations-title">
      <h2 id="profile-locations-title" className="mb-2 text-title font-semibold text-primary">
        {t("profile.locations.title")}
      </h2>
      <ul className="mb-3 flex flex-col gap-2">
        {locations.map((location) => (
          <li
            key={location.locationId}
            className="rounded-md border border-default bg-surface p-3 text-body text-primary"
          >
            {location.name} · {typeLabels[location.locationType]}
          </li>
        ))}
      </ul>
      {canCreate ? (
        <p className="mb-3 text-small text-secondary">{t("profile.locations.hint")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canCreate ? (
          <NewLocationButton
            organizationId={access.organization.organizationId}
            label={t("profile.locations.add")}
            variant="secondary"
            labels={locationFormLabelsOf(t, limits.locations)}
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
    </section>
  );
}
