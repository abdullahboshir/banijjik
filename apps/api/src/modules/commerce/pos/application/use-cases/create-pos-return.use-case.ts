import type { SalesReturnResponse } from "@banijjik/contracts/sales";
import { asId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { PosReturnBody } from "@banijjik/validation/pos";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { PosSalesReturnService } from "../../../sales/index.js";
import { sessionRequired } from "../../domain/errors.js";
import { openSessionOf } from "../open-session.js";
import type { PosSessionRepository, PosSettingsReader, PosUnitOfWork } from "../ports/pos-ports.js";
import type { PosDeviceContext } from "./session.use-cases.js";

export interface CreatePosReturnDependencies {
  readonly salesReturns: PosSalesReturnService;
  readonly sessions: PosSessionRepository;
  readonly settings: PosSettingsReader;
  readonly unitOfWork: PosUnitOfWork;
  readonly clock: Clock;
}

/**
 * `POST /pos/returns` (plan 3.9 A2-4): records a sales return at the till and tags its refund
 * payment with the open `posSessionId`, so a cash refund lowers the drawer's expected cash.
 */
export class CreatePosReturnUseCase {
  constructor(private readonly dependencies: CreatePosReturnDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly device: PosDeviceContext;
    readonly body: PosReturnBody;
  }): Promise<SalesReturnResponse> {
    const {
      salesReturns,
      sessions,
      settings: settingsReader,
      unitOfWork,
      clock,
    } = this.dependencies;
    const settings = await settingsReader.read(input.organizationId, input.device.locationId);
    const session = await openSessionOf(sessions, settings, input.device);
    const posSessionId = session?.posSessionId ?? null;
    const { orderId, ...returnBody } = input.body;
    return unitOfWork.run(async () => {
      if (posSessionId !== null && !(await sessions.markSale(posSessionId, clock.now()))) {
        throw sessionRequired();
      }
      return salesReturns.create({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        allowedLocationIds: [input.device.locationId],
        orderId: asId<OrderId>(orderId),
        body: returnBody,
        posSessionId,
      });
    });
  }
}
