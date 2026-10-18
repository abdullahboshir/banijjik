// @vitest-environment jsdom
import { ApiError } from "@banijjik/web-client";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickLabels } from "../lib/labels";
import { banglaText, banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import { DeadLetterRowActions } from "./dead-letter-actions";
import { FAILED_EVENT_LABEL_KEYS, type FailedEventLabels } from "./failed-event-labels";
import { DeadLetterList, DeadOutboxList, type DeadLetterRowView } from "./dead-letter-list";

const { refresh, replayDeadLetter, skipDeadLetter, replayDeadOutboxEvent } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replayDeadLetter: vi.fn(),
  skipDeadLetter: vi.fn(),
  replayDeadOutboxEvent: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/platform-api", () => ({
  replayDeadLetter,
  skipDeadLetter,
  replayDeadOutboxEvent,
}));
vi.mock("../forms/announce-success", () => ({ announceSuccess: vi.fn() }));

const LETTER_ID = "01900000-0000-7000-8000-000000000001";
const EVENT_ID = "01900000-0000-7000-8000-000000000002";
const REASON = "জার্নাল এন্ট্রি হাতে করা হয়েছে";

function labels(): FailedEventLabels {
  return pickLabels(banglaTranslator().t, FAILED_EVENT_LABEL_KEYS);
}

function row(overrides: Partial<DeadLetterRowView> = {}): DeadLetterRowView {
  return {
    eventDeadLetterId: LETTER_ID,
    eventType: "contact.contact.created",
    handlerKey: "ledger.post",
    organizationLabel: "acme",
    errorSummary: "Error",
    attemptsLabel: "5",
    whenLabel: "১৮ অক্টো",
    status: "FAILED",
    statusLabel: "ব্যর্থ",
    statusTone: "danger",
    waitingNote: "",
    canAct: true,
    ...overrides,
  };
}

function refusal(messageKey: string): ApiError {
  return new ApiError({ status: 422, code: "BUSINESS_RULE", messageKey });
}

async function submitDialog(): Promise<void> {
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the list of failed handlers", () => {
  it("shows the event, the handler, the error and the status, and Replay and Skip for a failed one", () => {
    renderInBangla(<DeadLetterList rows={[row()]} labels={labels()} />);

    expect(screen.getAllByText("contact.contact.created").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ledger.post").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: banglaText("platform.failedEvents.action.replay") }),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: banglaText("platform.failedEvents.action.skip") }),
    ).not.toHaveLength(0);
  });

  it("says that the stream waits behind an ordered handler's failure", () => {
    renderInBangla(
      <DeadLetterList
        rows={[row({ waitingNote: banglaText("platform.failedEvents.waiting") })]}
        labels={labels()}
      />,
    );

    expect(screen.getAllByText(banglaText("platform.failedEvents.waiting")).length).toBeGreaterThan(
      0,
    );
  });

  it("offers no action for a row that was already replayed or skipped, or to an operator who may not act", () => {
    renderInBangla(<DeadLetterList rows={[row({ canAct: false })]} labels={labels()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the empty state when there is nothing", () => {
    renderInBangla(<DeadLetterList rows={[]} labels={labels()} />);

    expect(screen.getByText(banglaText("platform.failedEvents.handlers.empty"))).not.toBeNull();
  });
});

describe("Replay", () => {
  function renderReplay(): void {
    renderInBangla(
      <DeadLetterRowActions
        labels={labels()}
        targets={[
          {
            target: { kind: "replay", eventDeadLetterId: LETTER_ID },
            label: banglaText("platform.failedEvents.action.replay"),
            isDanger: false,
          },
        ]}
      />,
    );
  }

  it("asks for a confirmation, then sends the replay and reloads the page", async () => {
    replayDeadLetter.mockResolvedValue({});
    renderReplay();
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.failedEvents.action.replay") }),
    );
    await screen.findByRole("dialog");

    await submitDialog();

    expect(replayDeadLetter).toHaveBeenCalledWith(LETTER_ID);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the translated refusal and does not reload when the API refuses", async () => {
    replayDeadLetter.mockRejectedValue(refusal("errors.event_dead_letter_not_failed"));
    renderReplay();
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.failedEvents.action.replay") }),
    );
    await screen.findByRole("dialog");

    await submitDialog();

    expect(
      await screen.findByText(banglaText("errors.event_dead_letter_not_failed")),
    ).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("Skip", () => {
  async function openSkip(): Promise<void> {
    renderInBangla(
      <DeadLetterRowActions
        labels={labels()}
        targets={[
          {
            target: { kind: "skip", eventDeadLetterId: LETTER_ID },
            label: banglaText("platform.failedEvents.action.skip"),
            isDanger: true,
          },
        ]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.failedEvents.action.skip") }),
    );
    await screen.findByRole("dialog");
  }

  it("explains that a skip means the handler's effect must be fixed by hand", async () => {
    await openSkip();

    expect(
      screen.getByText(banglaText("platform.failedEvents.sheet.skip.description")),
    ).not.toBeNull();
  });

  it("requires a reason: with none it shows the field error and sends nothing", async () => {
    await openSkip();

    await submitDialog();

    expect(screen.getByText(banglaText("validation.required"))).not.toBeNull();
    expect(skipDeadLetter).not.toHaveBeenCalled();
  });

  it("sends the reason and reloads the page", async () => {
    skipDeadLetter.mockResolvedValue({});
    await openSkip();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.failedEvents.field.skipReason"), { exact: false }),
      REASON,
    );

    await submitDialog();

    expect(skipDeadLetter).toHaveBeenCalledWith(LETTER_ID, { reason: REASON });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the refusal when earlier events of the stream are not done", async () => {
    skipDeadLetter.mockRejectedValue(refusal("errors.event_stream_not_at_event"));
    await openSkip();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.failedEvents.field.skipReason"), { exact: false }),
      REASON,
    );

    await submitDialog();

    expect(await screen.findByText(banglaText("errors.event_stream_not_at_event"))).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("events that were not dispatched", () => {
  it("lists them with a Replay that sends the outbox replay", async () => {
    replayDeadOutboxEvent.mockResolvedValue({ eventId: EVENT_ID });
    renderInBangla(
      <DeadOutboxList
        rows={[
          {
            eventId: EVENT_ID,
            eventType: "iam.user.registered",
            organizationLabel: "acme",
            errorSummary: "Error",
            attemptsLabel: "10",
            whenLabel: "১৮ অক্টো",
            canAct: true,
          },
        ]}
        labels={labels()}
      />,
    );
    await userEvent.click(
      screen.getAllByRole("button", {
        name: banglaText("platform.failedEvents.action.replay"),
      })[0] as HTMLElement,
    );
    await screen.findByRole("dialog");

    await submitDialog();

    expect(replayDeadOutboxEvent).toHaveBeenCalledWith(EVENT_ID);
    expect(refresh).toHaveBeenCalled();
  });
});
