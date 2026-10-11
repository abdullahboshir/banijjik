/**
 * Runs several repository calls and the audit entry as one all-or-nothing unit. The Mongo adapter
 * uses the kernel's withTransaction; use case tests use a fake that just runs the work.
 */
export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
