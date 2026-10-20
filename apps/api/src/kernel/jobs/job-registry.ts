import { ERROR_CODE, type ModuleKey } from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";

export interface ScheduledJob {
  /** Unique key, e.g. `booking.expireHolds`. Names the BullMQ repeatable job. */
  readonly jobKey: string;
  /** How often the job runs, in minutes. */
  readonly everyMinutes: number;
  /**
   * When set, the job runs for an organization only while this module is effective there.
   * SYSTEM jobs omit it and always run.
   */
  readonly moduleKey?: ModuleKey;
  run(organizationId: string, now: Date): Promise<void>;
}

const JOB_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;

function registryError(messageKey: string, jobKey: string): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey, details: { jobKey } });
}

/**
 * Registry of scheduled jobs. Modules register at startup; the worker seals before it starts
 * (same pattern as the event handler registry).
 */
export class JobRegistry {
  private readonly jobs = new Map<string, ScheduledJob>();
  private isSealed = false;

  register(job: ScheduledJob): void {
    if (this.isSealed) {
      throw registryError("errors.job_registry_sealed", job.jobKey);
    }
    if (!JOB_KEY_PATTERN.test(job.jobKey)) {
      throw registryError("errors.invalid_job_key", job.jobKey);
    }
    if (!(job.everyMinutes >= 1)) {
      throw registryError("errors.invalid_job_interval", job.jobKey);
    }
    if (this.jobs.has(job.jobKey)) {
      throw registryError("errors.duplicate_job", job.jobKey);
    }
    this.jobs.set(job.jobKey, job);
  }

  seal(): void {
    this.isSealed = true;
  }

  find(jobKey: string): ScheduledJob | undefined {
    return this.jobs.get(jobKey);
  }

  all(): readonly ScheduledJob[] {
    return [...this.jobs.values()];
  }
}

export const jobRegistry = new JobRegistry();

export function registerScheduledJob(job: ScheduledJob): void {
  jobRegistry.register(job);
}
