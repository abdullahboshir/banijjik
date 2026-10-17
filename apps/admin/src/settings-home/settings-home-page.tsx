import type { SettingsTopic } from "@banijjik/contracts";
import { EmptyState, PageLayout, TopicCard } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { menuEntryLabelOf } from "../shell/menu-groups";
import { requireOrgAccess } from "../shell/org-access";
import { groupSettingsTopics } from "./settings-topics";

/** One icon per topic: topics are a closed list in contracts, so the icon lives beside the page that draws it. */
const TOPIC_ICON_KEY: Record<SettingsTopic, string> = {
  BUSINESS: "store",
  TEAM: "users",
  WEBSITE: "globe",
  SALES: "shopping-cart",
  PAYMENTS: "wallet",
  AUTOMATION: "zap",
  ADVANCED: "sliders-horizontal",
};

/** `/{orgSlug}/settings`: one card per topic, each listing the settings pages this person can open. */
export async function SettingsHomePage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [{ t, locale }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { menu, terms } = access.config;
  const groups = groupSettingsTopics(menu);
  return (
    <PageLayout title={t("settings.home.title")} subtitle={t("settings.home.subtitle")}>
      {groups.length === 0 ? (
        <EmptyState kind="noPermission" message={t("state.permissionDenied")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ topic, entries }) => (
            <TopicCard
              key={topic}
              title={t(`settings.topic.${topic}.title`)}
              description={t(`settings.topic.${topic}.line`)}
              iconKey={TOPIC_ICON_KEY[topic]}
              links={entries.map((entry) => ({
                href: `/${orgSlug}/${entry.path}`,
                label: menuEntryLabelOf(entry, { terms, locale, t }),
              }))}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
