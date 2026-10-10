import { Button } from "@jev-usecase/ui/components/button";
import { Input } from "@jev-usecase/ui/components/input";
import { api } from "@jev-usecase/backend/convex/_generated/api";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { ENV } from "@/env.public";

type EntitySearchResponse = FunctionReturnType<typeof api.entitySearch.search>;
type EntitySearchItem = EntitySearchResponse["itemListElement"][number];

const SUGGESTIONS = [
  "taylor swift",
  "theoretical physicist who developed relativity",
  "block building game",
  "capital of France",
  "animated studio that made Toy Story",
  "the king of pop",
  "argentine footballer",
  "japanese capital city",
  "british rock band from liverpool",
  "online video sharing platform",
  "united states space agency",
  "highest mountain in the world",
  "space saga with lightsabers",
  "puzzle game with falling blocks",
  "spanish football club",
  "author of the lord of the rings",
];

const ENDPOINT_URL = `${ENV.VITE_CONVEX_SITE_URL}/api/entities:search?query=capital%20of%20France&limit=3`;

function Code({ children }: { children: string }) {
  return <code className="rounded-none bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
}

function HowItWorks() {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="font-medium">How this works</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Jev is the judge, not the database. A Convex action retrieves candidates from a small entity
        store, then TypeSafe Jev scores each candidate through the Convex AI Gateway.
      </p>
      <ol className="mt-3 grid list-decimal gap-3 pl-5 text-sm">
        <li>
          <span className="font-medium">Retrieve candidates</span> — the{" "}
          <Code>entities.candidates</Code> Convex query tokenizes the search string (lowercased,
          stop words dropped) and lexically scores every stored entity: name ×3, alias ×2,
          description ×1. The top 10 become candidates, or up to 20 when nothing overlaps so Jev can
          still reason.
        </li>
        <li>
          <span className="font-medium">Ask Jev</span> — the <Code>entitySearch.search</Code> action
          builds one <Code>score</Code> question per candidate, from &quot;Not relevant&quot; to
          &quot;Exact match&quot;, and calls the shared <Code>runEvaluation</Code> helper.
        </li>
        <li>
          <span className="font-medium">Evaluate</span> — <Code>runEvaluation</Code> sends the query
          and candidates as <Code>state</Code> to{" "}
          <Code>convexGateway.evaluationModel(&quot;typesafe/jev-1.13&quot;)</Code> with the AI SDK{" "}
          <Code>experimental_evaluate</Code>. The provider authenticates with{" "}
          <Code>getServiceToken(&quot;ai-gateway&quot;)</Code>; answers, confidence, probabilities
          and cost are normalized and logged to the <Code>decisions</Code> table.
        </li>
        <li>
          <span className="font-medium">Rank and shape</span> — scores below &quot;Related&quot;
          (0.5) are dropped, the rest are sorted, each normalized score becomes a{" "}
          <Code>resultScore</Code> (0–1000), and the response is assembled as a schema.org JSON-LD{" "}
          <Code>ItemList</Code>.
        </li>
      </ol>
      <p className="mt-4 text-muted-foreground text-xs">
        This page calls the action with the Convex client. The same action is exposed over HTTP:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
        GET {ENDPOINT_URL}
      </pre>
    </div>
  );
}

function ResultScore({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(value, 1000) / 10}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">{value}</span>
    </div>
  );
}

function ResultCard({ item }: { item: EntitySearchItem }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium">{item.result.name}</span>
          {item.result["@type"]
            .filter((type) => type !== "Thing")
            .map((type) => (
              <span
                key={type}
                className="border px-1.5 py-0.5 text-muted-foreground text-xs uppercase"
              >
                {type}
              </span>
            ))}
        </div>
        <ResultScore value={item.resultScore} />
      </div>
      <p className="mt-2 text-sm">{item.result.description}</p>
      {item.result.detailedDescription ? (
        <p className="mt-1 text-muted-foreground text-xs">
          {item.result.detailedDescription.articleBody}
        </p>
      ) : null}
      <p className="mt-2 font-mono text-muted-foreground text-xs">{item.result["@id"]}</p>
    </div>
  );
}

export default function EntitySearch() {
  const search = useAction(api.entitySearch.search);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<EntitySearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  async function run(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (trimmed.length === 0) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await search({ query: trimmed, limit: 5 });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="container mx-auto grid max-w-3xl gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Entity Search</h1>
        <p className="text-muted-foreground text-sm">
          Retrieval over a small entity store, then TypeSafe Jev scores each candidate and ranks the
          results. Returns a Knowledge-Graph-style JSON-LD ItemList.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(query);
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search entities, e.g. taylor swift"
        />
        <Button type="submit" disabled={isSearching || query.trim().length === 0}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery(suggestion);
              void run(suggestion);
            }}
          >
            {suggestion}
          </Button>
        ))}
      </div>

      {error ? <p className="text-red-500 text-sm">{error}</p> : null}

      {result ? (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              {result.itemListElement.length} result
              {result.itemListElement.length === 1 ? "" : "s"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowRaw((value) => !value)}>
              {showRaw ? "Hide" : "Show"} JSON-LD
            </Button>
          </div>
          {result.itemListElement.length > 0 ? (
            result.itemListElement.map((item) => (
              <ResultCard key={item.result["@id"]} item={item} />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No entities matched.</p>
          )}
          {showRaw ? (
            <pre className="overflow-x-auto rounded-lg border p-3 font-mono text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      <HowItWorks />
    </div>
  );
}
