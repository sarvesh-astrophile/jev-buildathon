import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { DecisionQuestion } from "./decisionValidators";
import { runEvaluation } from "./decisions";

const CRITERIA = [
  "Not relevant",
  "Weakly related",
  "Related",
  "Good match",
  "Exact match",
] as const;
const MAX_LEVEL = CRITERIA.length - 1;
const CANDIDATE_LIMIT = 10;
const MIN_NORMALIZED = 0.5;

const CONTEXT = {
  "@vocab": "http://schema.org/",
  goog: "http://schema.googleapis.com/",
  resultScore: "goog:resultScore",
  detailedDescription: "goog:detailedDescription",
  EntitySearchResult: "goog:EntitySearchResult",
  kg: "http://g.co/kg",
};

export type EntitySearchResultItem = {
  "@type": "EntitySearchResult";
  result: {
    "@id": string;
    name: string;
    "@type": string[];
    description: string;
    detailedDescription?: { articleBody: string };
    url?: string;
  };
  resultScore: number;
};

export type EntitySearchResponse = {
  "@context": typeof CONTEXT;
  "@type": "ItemList";
  itemListElement: EntitySearchResultItem[];
};

export const search = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<EntitySearchResponse> => {
    const query = args.query.trim();
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 10);
    const empty: EntitySearchResponse = {
      "@context": CONTEXT,
      "@type": "ItemList",
      itemListElement: [],
    };

    if (query.length === 0) {
      return empty;
    }

    const candidates = await ctx.runQuery(internal.entities.candidates, {
      query,
      limit: CANDIDATE_LIMIT,
    });
    if (candidates.length === 0) {
      return empty;
    }

    const questions: Record<string, DecisionQuestion> = {};
    candidates.forEach((candidate, index) => {
      questions[`candidate_${index}`] = {
        type: "score",
        instructions: `Rate how well the candidate entity "${candidate.name}" (${candidate.type}) matches the search query "${query}".`,
        criteria: [...CRITERIA],
      };
    });

    const decision = await runEvaluation(ctx, {
      state: {
        query,
        candidates: candidates.map((candidate, index) => ({
          candidate: index,
          name: candidate.name,
          type: candidate.type,
          description: candidate.description,
          aliases: candidate.aliases,
        })),
      },
      questions,
      source: "entity-search",
    });

    const itemListElement = candidates
      .map((candidate, index) => {
        const answer = decision.answers[`candidate_${index}`];
        const normalized = answer?.type === "score" ? answer.score / MAX_LEVEL : 0;
        return { candidate, normalized };
      })
      .filter((item) => item.normalized >= MIN_NORMALIZED)
      .sort((a, b) => b.normalized - a.normalized)
      .slice(0, limit)
      .map((item): EntitySearchResultItem => {
        const result: EntitySearchResultItem["result"] = {
          "@id": `entities:${item.candidate.key}`,
          name: item.candidate.name,
          "@type": ["Thing", item.candidate.type],
          description: item.candidate.description,
        };
        if (item.candidate.detailedDescription !== undefined) {
          result.detailedDescription = { articleBody: item.candidate.detailedDescription };
        }
        if (item.candidate.url !== undefined) {
          result.url = item.candidate.url;
        }
        return {
          "@type": "EntitySearchResult",
          result,
          resultScore: Math.round(item.normalized * 1000),
        };
      });

    return { "@context": CONTEXT, "@type": "ItemList", itemListElement };
  },
});
