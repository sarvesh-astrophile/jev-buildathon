import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { ENTITY_SEED } from "./entitySeed";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "who",
  "what",
  "which",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function lexicalScore(entity: Doc<"entities">, tokens: readonly string[]): number {
  const name = entity.name.toLowerCase();
  const aliases = entity.aliases.join(" ").toLowerCase();
  const description = entity.description.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (name.includes(token)) {
      score += 3;
    } else if (aliases.includes(token)) {
      score += 2;
    } else if (description.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db.query("entities").take(limit);
  },
});

export const candidates = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("entities").take(500);
    const tokens = tokenize(args.query);
    if (tokens.length === 0) {
      return all.slice(0, args.limit);
    }

    const scored = all
      .map((entity) => ({ entity, score: lexicalScore(entity, tokens) }))
      .sort((a, b) => b.score - a.score);
    const matches = scored.filter((item) => item.score > 0);
    const pool = matches.length > 0 ? matches.slice(0, args.limit) : scored.slice(0, 20);
    return pool.map((item) => item.entity);
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("entities").take(500);
    const existingKeys = new Set(existing.map((entity) => entity.key));
    let inserted = 0;
    for (const entity of ENTITY_SEED) {
      if (existingKeys.has(entity.key)) continue;
      await ctx.db.insert("entities", {
        key: entity.key,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        aliases: entity.aliases,
        ...(entity.detailedDescription !== undefined
          ? { detailedDescription: entity.detailedDescription }
          : {}),
        ...(entity.url !== undefined ? { url: entity.url } : {}),
      });
      inserted += 1;
    }
    return { inserted, total: ENTITY_SEED.length };
  },
});
