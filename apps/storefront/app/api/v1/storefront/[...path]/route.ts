import { handleStorefrontApi } from "../../../../../src/proxy/route-handlers";

interface RouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

async function proxyRequest(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return handleStorefrontApi(request, path);
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
