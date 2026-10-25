import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import type {
  PosSessionListResponse,
  PosSessionResponse,
  PosSessionStatus,
} from "@banijjik/contracts/pos";
import { asId, type LocationId } from "@banijjik/ids";
import { locationForbidden } from "../../domain/errors.js";
import type { PosSessionListCursor, PosSessionRepository } from "../ports/pos-ports.js";
import { toSessionResponse, type PosDeviceContext } from "./session.use-cases.js";

const CURSOR_SEPARATOR = "|";

function invalidCursor(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "validation.invalid_format",
  });
}

function encodeSessionCursor(cursor: PosSessionListCursor): string {
  return Buffer.from(
    `${cursor.openedAt.toISOString()}${CURSOR_SEPARATOR}${cursor.posSessionId}`,
  ).toString("base64url");
}

function decodeSessionCursor(cursor: string): PosSessionListCursor {
  const [iso, posSessionId] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split(CURSOR_SEPARATOR);
  const openedAt = new Date(iso ?? "");
  if (posSessionId === undefined || posSessionId === "" || Number.isNaN(openedAt.getTime())) {
    throw invalidCursor();
  }
  return { openedAt, posSessionId };
}

/** `GET /pos/sessions/current`: the OPEN session of the paired device, or `null` (plan 3.9 A2-7). */
export class GetCurrentPosSessionUseCase {
  constructor(private readonly dependencies: { readonly sessions: PosSessionRepository }) {}

  async execute(input: { readonly device: PosDeviceContext }): Promise<PosSessionResponse | null> {
    const open = await this.dependencies.sessions.findOpenByDevice(input.device.posDeviceId);
    return open === undefined ? null : toSessionResponse(open);
  }
}

/** `GET /pos/sessions`: keyset-paged session list for the caller's locations (plan 3.9 A2-7). */
export class ListPosSessionsUseCase {
  constructor(private readonly dependencies: { readonly sessions: PosSessionRepository }) {}

  async execute(input: {
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId?: string | undefined;
    readonly status?: PosSessionStatus | undefined;
    readonly cursor?: string | undefined;
    readonly limit: number;
  }): Promise<PosSessionListResponse> {
    if (
      input.locationId !== undefined &&
      input.allowedLocationIds !== "ALL" &&
      !input.allowedLocationIds.includes(input.locationId)
    ) {
      throw locationForbidden();
    }
    const page = await this.dependencies.sessions.list({
      allowedLocationIds: input.allowedLocationIds,
      locationId: input.locationId === undefined ? undefined : asId<LocationId>(input.locationId),
      status: input.status,
      after: input.cursor === undefined ? undefined : decodeSessionCursor(input.cursor),
      limit: input.limit,
    });
    return {
      items: page.items.map(toSessionResponse),
      nextCursor: page.next === null ? null : encodeSessionCursor(page.next),
    };
  }
}
