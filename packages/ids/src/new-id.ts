import type { Id } from "./branded-ids.js";

const COUNTER_MAX = 0xfff;
const BYTE_COUNT = 16;
const TIMESTAMP_BYTE_COUNT = 6;

// Monotonic state (RFC 9562 section 6.2, method 1): IDs made in the same millisecond still sort in creation order.
let lastTimestampMs = 0;
let counter = 0;

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function randomCounterSeed(): number {
  const [high = 0, low = 0] = randomBytes(2);
  return (((high & 0x0f) << 8) | low) & COUNTER_MAX;
}

/** Picks the timestamp and counter for the next ID, never going backwards and never repeating a pair. */
function advanceClock(): { timestampMs: number; counterValue: number } {
  const nowMs = Date.now();
  if (nowMs > lastTimestampMs) {
    lastTimestampMs = nowMs;
    counter = randomCounterSeed();
  } else if (counter >= COUNTER_MAX) {
    // Counter exhausted inside one millisecond: borrow the next millisecond.
    lastTimestampMs += 1;
    counter = randomCounterSeed();
  } else {
    counter += 1;
  }
  return { timestampMs: lastTimestampMs, counterValue: counter };
}

function writeTimestamp(bytes: Uint8Array, timestampMs: number): void {
  let remaining = timestampMs;
  for (let index = TIMESTAMP_BYTE_COUNT - 1; index >= 0; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatUuid(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/** Creates a new lowercase UUID v7. The only ID generator in the codebase (ADR-036). */
export function newId<IdType extends Id<string> = Id<string>>(): IdType {
  const { timestampMs, counterValue } = advanceClock();
  const bytes = randomBytes(BYTE_COUNT);
  writeTimestamp(bytes, timestampMs);
  bytes[6] = 0x70 | (counterValue >> 8);
  bytes[7] = counterValue & 0xff;
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  // Safe: the brand exists only at type level; the bytes above form a valid UUID v7.
  return formatUuid(bytesToHex(bytes)) as IdType;
}
