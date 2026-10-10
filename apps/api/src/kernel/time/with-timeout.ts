/**
 * Rejects with `timeoutError()` when `work` takes longer than `timeoutMs`. The slow call is not
 * cancelled (a driver call cannot be); its late result or failure is simply ignored.
 */
export async function withTimeout<Result>(
  work: Promise<Result>,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<Result> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
