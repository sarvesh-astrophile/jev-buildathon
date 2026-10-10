import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  answersValidator,
  decisionInput,
  questionValidator,
  usageValidator,
} from "./decisionValidators";

export default defineSchema({
  decisions: defineTable({
    model: v.string(),
    state: decisionInput,
    questions: v.record(v.string(), questionValidator),
    answers: answersValidator,
    usage: usageValidator,
    gatewayId: v.optional(v.string()),
    source: v.optional(v.string()),
    userId: v.optional(v.string()),
  }),
});
