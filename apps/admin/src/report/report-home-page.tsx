import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ReportHomeResponse } from "@banijjik/contracts/report";
import type { Translator } from "@banijjik/i18n";
import { DashboardFrame } from "@banijjik/ui";
import type { ReactElement, ReactNode } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { buildHomeCards, isHomeWithoutActivity, type HomeCard } from "./report-home-cards";
import { homeLocationOf } from "./report-query";
import { loadHomeReport, loadReportLocations } from "./report-server-data";
import { showsLocationFilter } from "./report-locations";
import { HomeCardView, HomeEmptyNote, HomeLocationFilter } from "./report-home-view";

type RawParams = Record<string, string | string[] | undefined>;

interface HomeBodyInput {
  access: OrgAccess;
  translator: Translator;
  home: ReportHomeResponse;
  locations: readonly LocationResponse[];
  selectedLocationId: string | undefined;
}

function cardNodesOf(cards: readonly HomeCard[], input: HomeBodyInput): ReactNode[] {
  return cards.map((card) => (
    <HomeCardView
      key={card.section}
      card={card}
      currency={input.home.currency}
      locale={input.translator.locale}
      t={input.translator.t}
    />
  ));
}

/** The filter and the cards of the home, in the order of the grid. */
function homeBodyNodes(input: HomeBodyInput): ReactNode[] {
  const { access, translator, home, locations, selectedLocationId } = input;
  const cards = buildHomeCards(home);
  const nodes: ReactNode[] = [];
  if (showsLocationFilter(access.config.permissions, PERMISSION_KEY.REPORT_HOME_READ, locations)) {
    nodes.push(
      <HomeLocationFilter
        key="location-filter"
        locations={locations}
        selectedLocationId={selectedLocationId}
        t={translator.t}
      />,
    );
  }
  if (isHomeWithoutActivity(cards)) {
    nodes.push(<HomeEmptyNote key="empty" t={translator.t} />);
    return nodes;
  }
  return [...nodes, ...cardNodesOf(cards, input)];
}

/**
 * The business home (plan 3.10 decision 10). The API decides which sections exist; a caller without
 * `report.home.read` sees the greeting only.
 */
export async function ReportHomePage(props: {
  orgSlug: string;
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const greeting = translator.t("home.greeting", { name: access.me.name });
  const subtitle = translator.t("home.ready");
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.REPORT_HOME_READ)) {
    return <DashboardFrame greeting={greeting} subtitle={subtitle} />;
  }
  const selectedLocationId = homeLocationOf(props.searchParams);
  const [home, locations] = await Promise.all([
    loadHomeReport(access, selectedLocationId),
    loadReportLocations(access),
  ]);
  if (!home) return <DashboardFrame greeting={greeting} subtitle={subtitle} />;
  const children = homeBodyNodes({ access, translator, home, locations, selectedLocationId });
  return (
    <DashboardFrame greeting={greeting} subtitle={subtitle}>
      {children}
    </DashboardFrame>
  );
}
