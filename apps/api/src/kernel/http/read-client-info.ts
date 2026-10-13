import type { Request } from "express";

/** What a request tells about the device it came from. Both values are missing when the transport has none. */
export interface RequestClientInfo {
  readonly userAgent: string | undefined;
  readonly ipAddress: string | undefined;
}

/** The address is `request.ip`, which already honours the configured number of trusted proxy hops. */
export function readClientInfo(request: Request): RequestClientInfo {
  return { userAgent: request.get("user-agent"), ipAddress: request.ip };
}
