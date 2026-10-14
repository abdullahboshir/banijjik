/**
 * Runs several repository calls as one all-or-nothing unit. The Mongo adapter uses the kernel's
 * withTransaction; the use case tests use a fake that just runs the work.
 */
export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
