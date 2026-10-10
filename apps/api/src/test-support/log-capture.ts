import type { DestinationStream } from "pino";

export interface LogCapture {
  readonly destination: DestinationStream;
  /** Every JSON log line written so far, parsed. */
  lines(): Record<string, unknown>[];
  /** The raw text, for asserting that a value never appears. */
  text(): string;
}

export function createLogCapture(): LogCapture {
  const chunks: string[] = [];
  return {
    destination: { write: (chunk: string) => void chunks.push(chunk) },
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.length > 0)
        // Safe: pino writes exactly one JSON object per line.
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    text: () => chunks.join(""),
  };
}
