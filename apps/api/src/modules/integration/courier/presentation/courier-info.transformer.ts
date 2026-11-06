import type { CourierInfo } from "../application/ports/courier-info.source.js";

/** The API shape of the module info. Move it to `@banijjik/contracts` when an endpoint serves it. */
export interface CourierInfoResponse {
  readonly moduleKey: string;
  readonly path: string;
}

export function toCourierInfoResponse(info: CourierInfo): CourierInfoResponse {
  return { moduleKey: info.moduleKey, path: info.path };
}
