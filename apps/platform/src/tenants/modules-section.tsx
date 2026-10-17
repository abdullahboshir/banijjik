import type { PlatformModuleOverrideResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import { formatDate } from "../lib/format";
import { pickLabels } from "../lib/labels";
import { moduleLabelKey } from "../packages/module-catalog";
import { OverrideList, type OverrideRowView } from "./override-list";
import { REMOVE_OVERRIDE_LABEL_KEYS } from "./remove-override-labels";

interface ModulesSectionProps {
  organizationId: string;
  overrides: PlatformModuleOverrideResponse[];
  canWrite: boolean;
  translator: Translator;
}

function toRow(override: PlatformModuleOverrideResponse, translator: Translator): OverrideRowView {
  const { t, locale } = translator;
  return {
    moduleOverrideId: override.moduleOverrideId,
    moduleLabel: t(moduleLabelKey(override.moduleKey)),
    effectLabel: t(`platform.override.effect.${override.effect}`),
    reason: override.reason,
    expiryLabel: override.expiresAt
      ? formatDate(override.expiresAt, locale)
      : t("platform.override.noExpiry"),
  };
}

/** The active module overrides of a tenant: what the platform granted or revoked, why, and until when. */
export function ModulesSection({
  organizationId,
  overrides,
  canWrite,
  translator,
}: ModulesSectionProps): ReactElement {
  const { t } = translator;
  return (
    <PageSection title={t("platform.modules.title")} help={t("platform.modules.help")}>
      <OverrideList
        organizationId={organizationId}
        rows={overrides.map((override) => toRow(override, translator))}
        removeLabels={canWrite ? pickLabels(t, REMOVE_OVERRIDE_LABEL_KEYS) : undefined}
        labels={{
          module: t("platform.override.column.module"),
          effect: t("platform.override.column.effect"),
          reason: t("platform.override.column.reason"),
          expires: t("platform.override.column.expires"),
          actions: t("platform.override.column.actions"),
          empty: t("platform.modules.empty"),
        }}
      />
    </PageSection>
  );
}
