import type { Response } from "express";

export interface SendDataOptions {
  readonly meta?: object;
  readonly status?: number;
}

/** Writes the success envelope `{ data, meta? }` (14-API.md section 2). Error bodies come only from the error handler. */
export function sendData<Data>(
  response: Response,
  data: Data,
  options: SendDataOptions = {},
): void {
  const { meta, status = 200 } = options;
  const body = meta === undefined ? { data } : { data, meta };
  response.status(status).json(body);
}
