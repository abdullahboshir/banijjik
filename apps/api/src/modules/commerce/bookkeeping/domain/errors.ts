import { ERROR_CODE } from "@banijjik/contracts";
import { HttpError } from "../../../../kernel/errors/index.js";

export function systemAccountLocked(): HttpError {
  return new HttpError(422, ERROR_CODE.SYSTEM_ACCOUNT_LOCKED, {
    messageKey: "errors.accounting.system_account_immutable",
  });
}

export function accountArchived(): HttpError {
  return new HttpError(422, ERROR_CODE.BUSINESS_RULE, {
    messageKey: "errors.accounting.account_archived",
  });
}

export function entryAlreadyReversed(): HttpError {
  return new HttpError(409, ERROR_CODE.CONFLICT, {
    messageKey: "errors.accounting.entry_already_reversed",
  });
}

export function futureBusinessDate(): HttpError {
  return new HttpError(422, ERROR_CODE.BUSINESS_RULE, {
    messageKey: "errors.accounting.future_business_date",
  });
}
