import { type Infer, v } from "convex/values";

export const MODEL_ID = "typesafe/jev-1.13";

export const UNSUPPORTED_FIELDS = [
  "route",
  "models",
  "transforms",
  "plugins",
  "preset",
  "fallbacks",
  "speed",
  "trace",
  "session_id",
  "user",
  "stream",
] as const;

export const decisionInput = v.union(v.string(), v.array(v.any()), v.record(v.string(), v.any()));

const criteriaValue = v.union(
  v.string(),
  v.array(v.any()),
  v.record(v.string(), v.any()),
  v.null(),
);

export const questionValidator = v.union(
  v.object({
    type: v.literal("choice"),
    instructions: decisionInput,
    criteria: v.record(v.string(), criteriaValue),
  }),
  v.object({
    type: v.literal("score"),
    instructions: decisionInput,
    criteria: v.array(criteriaValue),
  }),
  v.object({
    type: v.literal("noul"),
    instructions: decisionInput,
    criteria: v.optional(
      v.object({
        true: v.optional(criteriaValue),
        false: v.optional(criteriaValue),
      }),
    ),
  }),
);

const answerValidator = v.union(
  v.object({
    type: v.literal("choice"),
    choice: v.string(),
    confidence: v.optional(v.number()),
    probabilities: v.optional(v.record(v.string(), v.number())),
  }),
  v.object({
    type: v.literal("score"),
    score: v.number(),
    confidence: v.optional(v.number()),
    probabilities: v.optional(v.record(v.string(), v.number())),
  }),
  v.object({
    type: v.literal("noul"),
    noul: v.number(),
  }),
  v.object({
    type: v.literal("refusal"),
  }),
);

export const answersValidator = v.record(v.string(), answerValidator);

export const usageValidator = v.object({
  input_tokens: v.number(),
  output_tokens: v.number(),
  cost: v.optional(v.number()),
});

export type DecisionInput = Infer<typeof decisionInput>;
export type DecisionQuestion = Infer<typeof questionValidator>;
export type DecisionAnswer = Infer<typeof answerValidator>;
export type DecisionAnswers = Infer<typeof answersValidator>;
export type DecisionUsage = Infer<typeof usageValidator>;
