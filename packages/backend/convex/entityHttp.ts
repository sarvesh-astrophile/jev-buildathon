import type { HttpRouter } from "convex/server";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const search = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  if (query.trim().length === 0) {
    return Response.json(
      {
        message: "The query parameter is required.",
        type: "invalid_request_error",
        code: "invalid_request",
        param: "query",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit === null ? undefined : Number(rawLimit);
  const limit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  const result = await ctx.runAction(api.entitySearch.search, { query, limit });
  return Response.json(result, { status: 200, headers: CORS_HEADERS });
});

const preflight = httpAction(
  async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
);

export function registerEntityRoutes(http: HttpRouter): void {
  http.route({ path: "/api/entities:search", method: "GET", handler: search });
  http.route({ path: "/api/entities:search", method: "OPTIONS", handler: preflight });
}
