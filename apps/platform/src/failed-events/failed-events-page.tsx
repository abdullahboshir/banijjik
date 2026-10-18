import {
  EVENT_DEAD_LETTER_STATUS,
  PLATFORM_PERMISSION_KEY,
  type EventDeadLetterStatus,
  type PlatformDeadLetter,
  type PlatformDeadOutboxEvent,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout, type StatusTone } from "@banijjik/ui";
import type { PageMeta } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { formatCount, formatDateTime } from "../lib/format";
import { pickLabels } from "../lib/labels";
import { FilterChips, type FilterChipLink } from "../lists/filter-chips";
import { ListPager } from "../lists/list-pager";
import type { RawParams } from "../lists/list-query";
import {
  DeadLetterList,
  DeadOutboxList,
  type DeadLetterRowView,
  type DeadOutboxRowView,
} from "./dead-letter-list";
import { FAILED_EVENT_LABEL_KEYS, type FailedEventLabels } from "./failed-event-labels";
import {
  failedEventsApiPath,
  failedEventsHref,
  parseFailedEventQuery,
  type FailedEventQuery,
} from "./failed-event-query";

const STATUS_TONES: Record<EventDeadLetterStatus, StatusTone> = {
  [EVENT_DEAD_LETTER_STATUS.FAILED]: "danger",
  [EVENT_DEAD_LETTER_STATUS.REPLAYED]: "info",
  [EVENT_DEAD_LETTER_STATUS.SKIPPED]: "neutral",
};

interface RowContext {
  translator: Translator;
  canAct: boolean;
}

function organizationLabel(organizationId: string | null, t: Translator["t"]): string {
  return organizationId ?? t("platform.failedEvents.noOrganization");
}

function toDeadLetterRow(letter: PlatformDeadLetter, context: RowContext): DeadLetterRowView {
  const { t, locale } = context.translator;
  const isWaiting =
    letter.status === EVENT_DEAD_LETTER_STATUS.FAILED && letter.orderingKey !== undefined;
  return {
    eventDeadLetterId: letter.eventDeadLetterId,
    eventType: letter.eventType,
    handlerKey: letter.handlerKey,
    organizationLabel: organizationLabel(letter.organizationId, t),
    errorSummary: letter.lastError,
    attemptsLabel: formatCount(letter.attempts, locale),
    whenLabel: formatDateTime(letter.failedAt, locale),
    status: letter.status,
    statusLabel: t(`platform.failedEvents.status.${letter.status}`),
    statusTone: STATUS_TONES[letter.status],
    waitingNote: isWaiting ? t("platform.failedEvents.waiting") : "",
    canAct: context.canAct && letter.status === EVENT_DEAD_LETTER_STATUS.FAILED,
  };
}

function toOutboxRow(event: PlatformDeadOutboxEvent, context: RowContext): DeadOutboxRowView {
  const { t, locale } = context.translator;
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    organizationLabel: organizationLabel(event.organizationId, t),
    errorSummary: event.lastError ?? "",
    attemptsLabel: formatCount(event.dispatchAttempts, locale),
    whenLabel: formatDateTime(event.occurredAt, locale),
    canAct: context.canAct,
  };
}

function viewChips(query: FailedEventQuery, t: Translator["t"]): FilterChipLink[] {
  return (["handlers", "outbox"] as const).map((view) => ({
    chipKey: view,
    label: t(`platform.failedEvents.view.${view}`),
    href: failedEventsHref({ ...query, view, page: 1 }),
    isActive: query.view === view,
  }));
}

function statusChips(query: FailedEventQuery, t: Translator["t"]): FilterChipLink[] {
  return Object.values(EVENT_DEAD_LETTER_STATUS).map((status) => ({
    chipKey: status,
    label: t(`platform.failedEvents.status.${status}`),
    href: failedEventsHref({ ...query, status, page: 1 }),
    isActive: query.status === status,
  }));
}

interface LoadedView {
  body: ReactElement;
  hasNext: boolean;
}

/** Reads the page of the current view from the API and draws its list. */
async function loadView(
  query: FailedEventQuery,
  labels: FailedEventLabels,
  context: RowContext,
): Promise<LoadedView> {
  if (query.view === "outbox") {
    const events = await fetchPlatformResource<PlatformDeadOutboxEvent[], PageMeta>(
      failedEventsApiPath(query),
    );
    const rows = events.data.map((event) => toOutboxRow(event, context));
    return {
      body: <DeadOutboxList rows={rows} labels={labels} />,
      hasNext: events.meta?.hasNext ?? false,
    };
  }
  const letters = await fetchPlatformResource<PlatformDeadLetter[], PageMeta>(
    failedEventsApiPath(query),
  );
  const rows = letters.data.map((letter) => toDeadLetterRow(letter, context));
  return {
    body: <DeadLetterList rows={rows} labels={labels} />,
    hasNext: letters.meta?.hasNext ?? false,
  };
}

/** `/failed-events`: handlers that failed their last attempt, and events that were never dispatched (card 3.8a). */
export async function FailedEventsPage({
  searchParams,
}: {
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.EVENTS_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseFailedEventQuery(searchParams);
  const labels = pickLabels(t, FAILED_EVENT_LABEL_KEYS);
  const context: RowContext = {
    translator,
    canAct: holdsPermission(operator, PLATFORM_PERMISSION_KEY.EVENTS_REPLAY),
  };
  const view = await loadView(query, labels, context);
  return (
    <PageLayout
      title={t("platform.failedEvents.title")}
      subtitle={t("platform.failedEvents.subtitle")}
      filters={
        <>
          <FilterChips
            chips={viewChips(query, t)}
            navLabel={t("platform.failedEvents.view.label")}
          />
          {query.view === "handlers" ? (
            <FilterChips chips={statusChips(query, t)} navLabel={t("platform.filter.label")} />
          ) : null}
        </>
      }
    >
      {view.body}
      <ListPager
        page={query.page}
        hasNext={view.hasNext}
        previousHref={failedEventsHref({ ...query, page: query.page - 1 })}
        nextHref={failedEventsHref({ ...query, page: query.page + 1 })}
        labels={{
          previous: t("platform.page.previous"),
          next: t("platform.page.next"),
          current: t("platform.page.current", { page: formatCount(query.page, translator.locale) }),
        }}
      />
    </PageLayout>
  );
}
