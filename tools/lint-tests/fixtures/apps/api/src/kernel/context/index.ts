// Stand-in for the real kernel entry, so the R26 fixtures have something to import.
export async function runAsSystem<Result>(
  reason: string,
  work: () => Promise<Result>,
): Promise<Result> {
  void reason;
  return work();
}

// Stand-in for the real kernel entry, so the R27 fixtures have something to import.
export function runWithRequestContext<Result>(
  context: { requestId: string },
  work: () => Result,
): Result {
  void context;
  return work();
}
