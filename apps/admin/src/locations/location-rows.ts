import { LOCATION_STATUS, type LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { formatPhoneForDisplay } from "@banijjik/ui";
import { locationArchiveLabelsOf, locationTypeLabels } from "./location-labels";
import type { LocationRowView } from "./location-list";
import { locationToFormState } from "./location-state";

/** What the caller may do with locations. Writes need the permission at every location (API rule of 1.7b). */
export interface LocationAbilities {
  canUpdate: boolean;
  canArchive: boolean;
}

const STATUS_LABEL_KEY: Record<LocationResponse["status"], string> = {
  [LOCATION_STATUS.ACTIVE]: "locations.status.active",
  [LOCATION_STATUS.ARCHIVED]: "locations.status.archived",
};

/**
 * Turns locations into table rows. Only an active location can be edited or archived. The default
 * location still offers the archive, so the person is told why it cannot be done (the API refuses it).
 */
export function toLocationRows(
  locations: readonly LocationResponse[],
  abilities: LocationAbilities,
  t: Translator["t"],
): LocationRowView[] {
  const typeLabels = locationTypeLabels(t);
  return locations.map((location) => {
    const isActive = location.status === LOCATION_STATUS.ACTIVE;
    return {
      locationId: location.locationId,
      version: location.version,
      name: location.name,
      typeLabel: typeLabels[location.locationType],
      phone: location.phoneE164 ? formatPhoneForDisplay(location.phoneE164) : "",
      status: location.status,
      statusLabel: t(STATUS_LABEL_KEY[location.status]),
      isDefault: location.isDefault,
      canEdit: isActive && abilities.canUpdate,
      canArchive: isActive && abilities.canArchive,
      form: locationToFormState(location),
      archiveLabels: locationArchiveLabelsOf(t, location.name),
    };
  });
}
