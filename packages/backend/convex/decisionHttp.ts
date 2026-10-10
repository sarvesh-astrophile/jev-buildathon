import type { FunctionArgs, HttpRouter } from "convex/server";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { MODEL_ID, UNSUPPORTED_FIELDS, type DecisionInput } from "./decisionValidators";

type EvaluateArgs = FunctionArgs<typeof api.decisions.evaluate>;

const MAX_BODY_BYTES = 16 * 1024 * 1024;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonError(status: number, code: string, message: string, param?: string): Response {
  return Response.json(
    {
      message,
      type: "invalid_request_error",
      code,
      ...(param ? { param } : {}),
    },
    { status, headers: CORS_HEADERS },
  );
}

function isDecisionInput(value: unknown): value is DecisionInput {
  if (typeof value === "string" || Array.isArray(value)) return true;
  return typeof value === "object" && value !== null;
}

const decisions = httpAction(async (ctx, request) => {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "request_too_large", "Request body must be no larger than 16 MiB.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonError(413, "request_too_large", "Request body must be no larger than 16 MiB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return jsonError(400, "invalid_request", "Request body must be a JSON object.");
  }

  const body = parsed as Record<string, unknown>;

  for (const field of UNSUPPORTED_FIELDS) {
    if (field in body) {
      return jsonError(
        400,
        "unsupported_parameter",
        `The "${field}" field is not supported by the Convex AI Gateway.`,
        field,
      );
    }
  }

  const model = body.model;
  if (typeof model !== "string" || model.length === 0) {
    return jsonError(400, "invalid_request", "model is required.", "model");
  }
  if (model !== MODEL_ID) {
    return jsonError(400, "unsupported_parameter", `Only "${MODEL_ID}" is supported.`, "model");
  }

  const state = body.state;
  if (!isDecisionInput(state)) {
    return jsonError(400, "invalid_request", "state must be a string, object, or array.", "state");
  }

  const questions = body.questions;
  if (
    typeof questions !== "object" ||
    questions === null ||
    Array.isArray(questions) ||
    Object.keys(questions).length === 0
  ) {
    return jsonError(400, "invalid_request", "questions must be a non-empty object.", "questions");
  }

  try {
    const result = await ctx.runAction(api.decisions.evaluate, {
      state: state as EvaluateArgs["state"],
      questions: questions as EvaluateArgs["questions"],
      source: "http",
    });
    return Response.json(result, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate the decision.";
    return jsonError(400, "invalid_request", message);
  }
});

const preflight = httpAction(
  async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
);

export function registerDecisionRoutes(http: HttpRouter): void {
  http.route({ path: "/alpha/decisions", method: "POST", handler: decisions });
  http.route({ path: "/alpha/decisions", method: "OPTIONS", handler: preflight });
}
