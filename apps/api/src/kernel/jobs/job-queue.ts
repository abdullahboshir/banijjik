import { Queue, Worker, type Job } from "bullmq";
import { getLogger } from "../logger/index.js";
import type { RedisClient } from "../redis/index.js";
import type { ShutdownTask } from "../lifecycle/shutdown.js";
import type { Clock } from "../time/index.js";
import type { ModuleEffectiveness } from "../events/module-effectiveness.js";
import { jobRegistry, type JobRegistry, type ScheduledJob } from "./job-registry.js";
import { runScheduledJob } from "./job-runner.js";

export const SCHEDULED_JOB_QUEUE_NAME = "scheduled-jobs";

export interface ScheduledJobData {
  readonly jobKey: string;
}

export interface StartScheduledJobsOptions {
  readonly redis: RedisClient;
  readonly effectiveness: ModuleEffectiveness;
  readonly clock: Clock;
  readonly registry?: JobRegistry;
  readonly prefix?: string;
}

/**
 * Seals the job registry, adds one repeatable BullMQ job per registered key, and starts a worker.
 */
export function startScheduledJobs(options: StartScheduledJobsOptions): {
  readonly shutdownTasks: readonly ShutdownTask[];
} {
  const registry = options.registry ?? jobRegistry;
  registry.seal();
  const queue = new Queue<ScheduledJobData>(SCHEDULED_JOB_QUEUE_NAME, {
    connection: options.redis,
    ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
  });
  queue.on("error", () => {
    getLogger().debug({ event: "jobs.queue_error" }, "scheduled job queue error");
  });

  const worker = new Worker<ScheduledJobData>(
    SCHEDULED_JOB_QUEUE_NAME,
    async (job: Job<ScheduledJobData>) => {
      const definition = registry.find(job.data.jobKey);
      if (definition === undefined) {
        getLogger().warn(
          { event: "jobs.unknown_key", jobKey: job.data.jobKey },
          "unknown scheduled job key",
        );
        return;
      }
      await runScheduledJob(definition, {
        effectiveness: options.effectiveness,
        clock: options.clock,
      });
    },
    {
      connection: options.redis,
      ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
    },
  );
  worker.on("error", () => {
    getLogger().debug({ event: "jobs.worker_error" }, "scheduled job worker error");
  });

  void upsertRepeatables(queue, registry.all()).catch((error: unknown) => {
    getLogger().error({ event: "jobs.repeatable_setup_failed", err: error }, "repeatable setup");
  });

  return {
    shutdownTasks: [
      {
        name: "scheduled-jobs-worker",
        run: async () => {
          await worker.close();
        },
      },
      {
        name: "scheduled-jobs-queue",
        run: async () => {
          await queue.close();
        },
      },
    ],
  };
}

async function upsertRepeatables(
  queue: Queue<ScheduledJobData>,
  jobs: readonly ScheduledJob[],
): Promise<void> {
  for (const job of jobs) {
    await queue.add(
      job.jobKey,
      { jobKey: job.jobKey },
      {
        repeat: { every: job.everyMinutes * 60_000 },
        jobId: job.jobKey,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}
