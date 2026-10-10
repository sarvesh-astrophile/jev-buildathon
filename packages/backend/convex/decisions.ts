import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { experimental_evaluate, type Experimental_DecisionQuestion } from "ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import {
  answersValidator,
  type DecisionAnswer,
  type DecisionAnswers,
  type DecisionInput,
  type DecisionQuestion,
  type DecisionUsage,
  MODEL_ID,
  decisionInput,
  questionValidator,
  usageValidator,
} from "./decisionValidators";

type RawAnswer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> }
  | { type: "boolean"; probability: number }
  | { type: "refusal" };

type EvaluationResult = {
  id: string;
  model: string;
  answers: DecisionAnswers;
  usage: DecisionUsage;
};

function toEvaluationQuestions(
  questions: Record<string, DecisionQuestion>,
): Record<string, Experimental_DecisionQuestion> {
  const output: Record<string, Experimental_DecisionQuestion> = {};
  for (const [id, question] of Object.entries(questions)) {
    switch (question.type) {
      case "choice":
        output[id] = {
          type: "choice",
          instructions: question.instructions,
          criteria: question.criteria,
        };
        break;
      case "score":
        output[id] = {
          type: "score",
          instructions: question.instructions,
          criteria: question.criteria,
        };
        break;
      default:
        output[id] = {
          type: "boolean",
          instructions: question.instructions,
          criteria: question.criteria,
        };
        break;
    }
  }
  return output;
}

function readNumber(source: unknown, path: readonly string[]): number | undefined {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : undefined;
}

function normalizeAnswers(answers: Record<string, RawAnswer>, body: unknown): DecisionAnswers {
  const output: DecisionAnswers = {};
  for (const [id, answer] of Object.entries(answers)) {
    const confidence = readNumber(body, ["answers", id, "confidence"]);
    switch (answer.type) {
      case "choice":
        output[id] = {
          type: "choice",
          choice: answer.choice,
          ...(confidence !== undefined ? { confidence } : {}),
          ...(answer.probabilities ? { probabilities: answer.probabilities } : {}),
        } satisfies DecisionAnswer;
        break;
      case "score":
        output[id] = {
          type: "score",
          score: answer.score,
          ...(confidence !== undefined ? { confidence } : {}),
          ...(answer.probabilities ? { probabilities: answer.probabilities } : {}),
        } satisfies DecisionAnswer;
        break;
      case "boolean":
        output[id] = { type: "noul", noul: answer.probability } satisfies DecisionAnswer;
        break;
      default:
        output[id] = { type: "refusal" } satisfies DecisionAnswer;
        break;
    }
  }
  return output;
}

function normalizeUsage(
  usage: { inputTokens?: number; outputTokens?: number },
  body: unknown,
): DecisionUsage {
  const cost = readNumber(body, ["usage", "cost"]);
  return {
    input_tokens: usage.inputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
    ...(cost !== undefined ? { cost } : {}),
  };
}

export const evaluate = action({
  args: {
    state: decisionInput,
    questions: v.record(v.string(), questionValidator),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EvaluationResult> => {
    const model = convexGateway.evaluationModel(MODEL_ID);
    const result = await experimental_evaluate({
      model,
      state: args.state,
      questions: toEvaluationQuestions(args.questions),
    });

    const body = result.response.body;
    const answers = normalizeAnswers(result.answers as unknown as Record<string, RawAnswer>, body);
    const usage = normalizeUsage(result.usage, body);
    const id = result.response.id ?? crypto.randomUUID();

    await ctx.runMutation(internal.decisions.save, {
      model: MODEL_ID,
      state: args.state,
      questions: args.questions,
      answers,
      usage,
      gatewayId: id,
      source: args.source,
    });

    return { id, model: MODEL_ID, answers, usage };
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return await ctx.db.query("decisions").order("desc").take(limit);
  },
});

export const save = internalMutation({
  args: {
    model: v.string(),
    state: decisionInput,
    questions: v.record(v.string(), questionValidator),
    answers: answersValidator,
    usage: usageValidator,
    gatewayId: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    await ctx.db.insert("decisions", {
      model: args.model,
      state: args.state as DecisionInput,
      questions: args.questions,
      answers: args.answers,
      usage: args.usage,
      gatewayId: args.gatewayId,
      source: args.source,
      userId: identity?.tokenIdentifier,
    });
  },
});
