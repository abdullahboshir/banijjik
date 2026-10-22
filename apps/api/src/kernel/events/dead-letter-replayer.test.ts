import { newId } from "@banijjik/ids";
import type { JobState, Queue } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { replayDeadLetter } from "./dead-letter-admin.js";
import { DeadLetterReplayer } from "./dead-letter-replayer.js";
import { deadLetter } from "./dead-letter.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import type { EventJobData, EventJobQueue } from "./event-job.js";
import { registerEventModels } from "./register-event-models.js";
import * as observability from "../observability/report-error.js";

registerEventModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

beforeEach(async () => {
  await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).deleteMany({});
  vi.restoreAllMocks();
});

const NO_OLD_JOB = { getJob: async () => undefined } as unknown as Queue<EventJobData>;

/** The old BullMQ job of the same ID; a test moves it between states like the worker would. */
interface FakeOldJob {
  state: JobState | "unknown";
  removeCalls: number;
}

function fakeOldJob(state: FakeOldJob["state"]): FakeOldJob {
  return { state, removeCalls: 0 };
}

function queueWithOldJob(oldJob: FakeOldJob): Queue<EventJobData> {
  const job = {
    getState: async () => oldJob.state,
    // Answers like a real job, so the stub stays honest whichever question the replayer asks.
    isFailed: async () => oldJob.state === "failed",
    remove: async () => {
      oldJob.removeCalls += 1;
    },
  };
  return { getJob: async () => job } as unknown as Queue<EventJobData>;
}

function recordingJobs(added: EventJobData[]): EventJobQueue {
  return { enqueue: async (job) => void added.push(job) };
}

async function requestedReplay(): Promise<{ id: string; eventId: string }> {
  const eventId = newId();
  await deadLetter({
    data: { eventId, handlerKey: "ledger.post", type: "iam.user.registered", organizationId: null },
    attempts: 5,
    error: new Error("boom"),
  });
  const row = await models({})
    .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
    .findOne({ eventId })
    .lean<EventDeadLetterDocument>();
  const id = row?.eventDeadLetterId ?? "";
  await withTransaction(() => replayDeadLetter({ eventDeadLetterId: id, operatorId: newId() }));
  return { id, eventId };
}

async function statusOf(id: string): Promise<string | undefined> {
  const row = await models({})
    .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
    .findOne({ eventDeadLetterId: id })
    .lean<EventDeadLetterDocument>();
  return row?.status;
}

describe("the dead letter replayer", () => {
  it("adds the job again and only then says REPLAYED", async () => {
    const { id, eventId } = await requestedReplay();
    const added: EventJobData[] = [];
    const jobs: EventJobQueue = { enqueue: async (job) => void added.push(job) };
    const replayer = new DeadLetterReplayer({ queue: NO_OLD_JOB, jobs });

    expect(await statusOf(id)).toBe("REPLAY_REQUESTED");
    const queued = await replayer.replayPending();

    expect(queued).toBe(1);
    expect(added.map((job) => job.eventId)).toEqual([eventId]);
    expect(await statusOf(id)).toBe("REPLAYED");
    const row = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({ eventDeadLetterId: id })
      .lean<EventDeadLetterDocument>();
    expect(row?.requeuedAt).toBeInstanceOf(Date);
  });

  it("leaves it REPLAY_REQUESTED with a reported error when the job cannot be added, and retries on the next poll", async () => {
    const reportSpy = vi.spyOn(observability, "reportError");
    const { id } = await requestedReplay();
    // Writing the dead letter reported its own error; count only what the replayer reports.
    reportSpy.mockClear();
    let failures = 1;
    const jobs: EventJobQueue = {
      enqueue: async () => {
        if (failures-- > 0) throw new Error("redis is away");
      },
    };
    const replayer = new DeadLetterReplayer({ queue: NO_OLD_JOB, jobs });

    const first = await replayer.replayPending();
    const statusAfterFailure = await statusOf(id);
    const second = await replayer.replayPending();

    expect(first).toBe(0);
    expect(statusAfterFailure).toBe("REPLAY_REQUESTED");
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(second).toBe(1);
    expect(await statusOf(id)).toBe("REPLAYED");
  });

  it("does not let one bad row stop the others", async () => {
    vi.spyOn(observability, "reportError");
    const bad = await requestedReplay();
    const good = await requestedReplay();
    const jobs: EventJobQueue = {
      enqueue: async (job) => {
        if (job.eventId === bad.eventId) throw new Error("this one fails");
      },
    };
    const replayer = new DeadLetterReplayer({ queue: NO_OLD_JOB, jobs });

    const queued = await replayer.replayPending();

    expect(queued).toBe(1);
    expect(await statusOf(bad.id)).toBe("REPLAY_REQUESTED");
    expect(await statusOf(good.id)).toBe("REPLAYED");
  });

  it("ignores a dead letter that nobody asked to replay", async () => {
    const eventId = newId();
    await deadLetter({
      data: { eventId, handlerKey: "ledger.post", type: "x", organizationId: null },
      attempts: 5,
      error: new Error("boom"),
    });
    const added: EventJobData[] = [];
    const replayer = new DeadLetterReplayer({
      queue: NO_OLD_JOB,
      jobs: { enqueue: async (job) => void added.push(job) },
    });

    expect(await replayer.replayPending()).toBe(0);
    expect(added).toEqual([]);
  });

  it("does not mark a replay REPLAYED while the old job is still active", async () => {
    const reportSpy = vi.spyOn(observability, "reportError");
    const { id } = await requestedReplay();
    // Writing the dead letter reported its own error; count only what the replayer reports.
    reportSpy.mockClear();
    const oldJob = fakeOldJob("active");
    const added: EventJobData[] = [];
    const replayer = new DeadLetterReplayer({
      queue: queueWithOldJob(oldJob),
      jobs: recordingJobs(added),
    });

    const queued = await replayer.replayPending();

    expect(queued).toBe(0);
    expect(added).toEqual([]);
    expect(oldJob.removeCalls).toBe(0);
    expect(await statusOf(id)).toBe("REPLAY_REQUESTED");
    expect(reportSpy).not.toHaveBeenCalled();
  });
});
