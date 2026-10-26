import type { RequestHandler } from "express";
import { smsLogQuerySchema, type SmsGatewayInput } from "@banijjik/validation/sms";
import { sendData } from "../../../../kernel/http/index.js";
import type { GatewayUseCases } from "../application/gateway-use-cases.js";

export class SmsController {
  constructor(
    private readonly useCases: GatewayUseCases,
    private readonly logs: {
      list(query: ReturnType<typeof smsLogQuerySchema.parse>): Promise<unknown>;
    },
  ) {}

  readonly read: RequestHandler = async (_request, response) => {
    sendData(response, await this.useCases.read());
  };
  readonly save: RequestHandler = async (request, response) => {
    const input: SmsGatewayInput = request.body;
    sendData(response, await this.useCases.save(input));
  };
  readonly test: RequestHandler = async (request, response) => {
    const input: { phoneE164: string } = request.body;
    const { result, status } = await this.useCases.test(input.phoneE164);
    sendData(response, result, { status });
  };
  readonly list: RequestHandler = async (_request, response) => {
    const query = smsLogQuerySchema.parse(response.locals["validated"].query);
    sendData(response, await this.logs.list(query));
  };
}
