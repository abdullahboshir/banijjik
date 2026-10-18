import type { PlatformEventDeadLetterListQuery, PlatformEventSkipBody } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requirePlatformOperatorId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ListDeadLettersUseCase,
  ListDeadOutboxEventsUseCase,
  ReplayDeadLetterUseCase,
  ReplayDeadOutboxEventUseCase,
  SkipDeadLetterUseCase,
} from "../application/use-cases/event-use-cases.js";

export interface EventOperationsControllerDependencies {
  readonly listDeadLetters: ListDeadLettersUseCase;
  readonly listDeadOutboxEvents: ListDeadOutboxEventsUseCase;
  readonly replayDeadLetter: ReplayDeadLetterUseCase;
  readonly skipDeadLetter: SkipDeadLetterUseCase;
  readonly replayDeadOutboxEvent: ReplayDeadOutboxEventUseCase;
}

function paramsOf(response: Response): { eventDeadLetterId: string; eventId: string } {
  // Safe: validate({ params }) produced this value on the routes that read it.
  return response.locals["validated"].params as { eventDeadLetterId: string; eventId: string };
}

export class EventOperationsController {
  constructor(private readonly dependencies: EventOperationsControllerDependencies) {}

  readonly listDead: RequestHandler = async (_request, response) => {
    // Safe: validate({ query }) produced this value on this route.
    const query = response.locals["validated"].query as PlatformEventDeadLetterListQuery;
    const page = await this.dependencies.listDeadLetters.execute(query);
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly listOutbox: RequestHandler = async (_request, response) => {
    // Safe: validate({ query }) produced this value on this route.
    const query = response.locals["validated"].query as { page: number; limit: number };
    const page = await this.dependencies.listDeadOutboxEvents.execute(query);
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly replay: RequestHandler = async (_request, response) => {
    const { eventDeadLetterId } = paramsOf(response);
    sendData(
      response,
      await this.dependencies.replayDeadLetter.execute({
        eventDeadLetterId,
        operatorId: requirePlatformOperatorId(),
      }),
    );
  };

  readonly skip: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the skip schema.
    const body: PlatformEventSkipBody = request.body;
    const { eventDeadLetterId } = paramsOf(response);
    sendData(
      response,
      await this.dependencies.skipDeadLetter.execute({
        eventDeadLetterId,
        operatorId: requirePlatformOperatorId(),
        reason: body.reason,
      }),
    );
  };

  readonly replayOutbox: RequestHandler = async (_request, response) => {
    sendData(
      response,
      await this.dependencies.replayDeadOutboxEvent.execute(paramsOf(response).eventId),
    );
  };
}
