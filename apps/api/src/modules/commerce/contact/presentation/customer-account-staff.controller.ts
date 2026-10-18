import { asId, type ContactId } from "@banijjik/ids";
import type { CustomerAccountBlockBody } from "@banijjik/validation";
import type { Request, RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  BlockCustomerAccountUseCase,
  GetCustomerAccountUseCase,
  UnblockCustomerAccountUseCase,
} from "../application/use-cases/customer-account-staff.use-cases.js";

export interface CustomerAccountStaffControllerDependencies {
  readonly getAccount: GetCustomerAccountUseCase;
  readonly blockAccount: BlockCustomerAccountUseCase;
  readonly unblockAccount: UnblockCustomerAccountUseCase;
}

function readContactId(request: Request): ContactId {
  // validate() already parsed the path parameter with the contact-id schema.
  return asId<ContactId>(String(request.params["contactId"]));
}

/** What staff see and do about a contact's website login (card M.1). */
export class CustomerAccountStaffController {
  constructor(private readonly dependencies: CustomerAccountStaffControllerDependencies) {}

  readonly get: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.getAccount.execute(readContactId(request)));
  };

  readonly block: RequestHandler = async (request, response) => {
    const body: CustomerAccountBlockBody = request.body;
    const { actorUserId } = readTenantCaller();
    const view = await this.dependencies.blockAccount.execute({
      contactId: readContactId(request),
      version: body.version,
      actorUserId,
    });
    sendData(response, view);
  };

  readonly unblock: RequestHandler = async (request, response) => {
    const body: CustomerAccountBlockBody = request.body;
    const { actorUserId } = readTenantCaller();
    const view = await this.dependencies.unblockAccount.execute({
      contactId: readContactId(request),
      version: body.version,
      actorUserId,
    });
    sendData(response, view);
  };
}
