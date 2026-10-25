import type { PosSessionId } from "@banijjik/ids";
import { sessionRequired } from "../domain/errors.js";
import type { PosSessionRepository, PosSettings } from "./ports/pos-ports.js";
import type { PosDeviceContext } from "./use-cases/session.use-cases.js";

/**
 * The register a till write runs on (plan 3.9 decision 4). With `pos.requireShift` on there must be
 * an OPEN session on this device; with it off the write carries no session, so it lands in no
 * Z-report. Money, stock and refund writes all take their `posSessionId` from here.
 */
export async function openSessionOf(
  sessions: PosSessionRepository,
  settings: Pick<PosSettings, "requireShift">,
  device: PosDeviceContext,
): Promise<{ readonly posSessionId: PosSessionId } | undefined> {
  if (!settings.requireShift) return undefined;
  const session = await sessions.findOpenByDevice(device.posDeviceId);
  if (session === undefined) throw sessionRequired();
  return session;
}
