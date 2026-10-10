import type { RequestHandler } from "express";
import { notFound } from "./app-error.js";

/** Mounted after every router, so any request that reaches it matched no route. */
export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(notFound());
};
