/** Runs repository calls as one all-or-nothing unit (Mongo adapter uses withTransaction). */
export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
