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
  entities: defineTable({
    key: v.string(),
    name: v.string(),
    type: v.string(),
    description: v.string(),
    detailedDescription: v.optional(v.string()),
    url: v.optional(v.string()),
    aliases: v.array(v.string()),
  }).index("by_key", ["key"]),
});
