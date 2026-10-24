import { handlePublicFiles } from "../../../../../../src/proxy/route-handlers";

interface RouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

async function proxyRequest(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return handlePublicFiles(request, path);
}

export const GET = proxyRequest;
