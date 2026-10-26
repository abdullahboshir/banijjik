import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";

export interface SmsStubRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: IncomingMessage["headers"];
  readonly body: string;
}
export interface SmsStubReply {
  readonly status?: number;
  readonly body?: object;
  readonly delayMs?: number;
}
export interface SmsStub {
  readonly baseUrl: string;
  readonly requests: readonly SmsStubRequest[];
  close(): Promise<void>;
}

/** Only listens on loopback. No provider credentials or real network endpoints belong in tests. */
export async function startSmsStub(
  reply: (request: SmsStubRequest) => SmsStubReply,
): Promise<SmsStub> {
  const requests: SmsStubRequest[] = [];
  const server = createServer((request, response) => {
    void receive(request, response);
  });
  async function receive(request: IncomingMessage, response: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const received = {
      url: request.url ?? "",
      method: request.method ?? "",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    requests.push(received);
    const result = reply(received);
    const send = () => {
      response.writeHead(result.status ?? 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result.body ?? {}));
    };
    if (result.delayMs === undefined) send();
    else setTimeout(send, result.delayMs).unref();
  }
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("stub address missing");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    async close() {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
  };
}
