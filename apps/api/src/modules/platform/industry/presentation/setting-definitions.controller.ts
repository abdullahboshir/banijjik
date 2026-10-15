import type { RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { SettingCatalog } from "../application/registered-settings.js";

/** `GET /platform/setting-definitions`: the code registry, ordered by key, not a page (ADR-106). */
export class SettingDefinitionsController {
  constructor(private readonly settings: SettingCatalog) {}

  readonly list: RequestHandler = (_request, response) => {
    sendData(response, this.settings.list());
  };
}
