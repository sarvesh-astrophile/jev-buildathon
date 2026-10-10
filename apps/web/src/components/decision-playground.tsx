import { convexQuery } from "@convex-dev/react-query";
import { Button } from "@jev-usecase/ui/components/button";
import { Textarea } from "@jev-usecase/ui/components/textarea";
import { api } from "@jev-usecase/backend/convex/_generated/api";
import type { Doc } from "@jev-usecase/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useState } from "react";

type EvaluateArgs = FunctionArgs<typeof api.decisions.evaluate>;
type EvaluationResult = FunctionReturnType<typeof api.decisions.evaluate>;
type DecisionAnswer = NonNullable<EvaluationResult>["answers"][string];

const MODEL_ID = "typesafe/jev-1.13";

const PRESETS = [
  {
    label: "Support ticket",
    request: {
      model: MODEL_ID,
      state: { ticket: "All users are unable to sign in. There is no workaround." },
      questions: {
        priority: {
          type: "choice",
          instructions: "Choose the support ticket's priority.",
          criteria: {
            urgent: "An outage is blocking users.",
            normal: "A bug affects users but has a workaround.",
          },
        },
        urgency: {
          type: "score",
          instructions: "How urgent is this ticket?",
          criteria: ["Low", "Moderate", "High", "Critical"],
        },
        refund: {
          type: "noul",
          instructions: "Is the customer asking for money back?",
        },
      },
    },
  },
  {
    label: "Content moderation",
    request: {
      model: MODEL_ID,
      state: {
        comment: "This product is total garbage, whoever made it should be fired.",
      },
      questions: {
        action: {
          type: "choice",
          instructions: "What action should moderation take?",
          criteria: {
            allow: "The comment is acceptable as-is.",
            review: "A human should review the comment.",
            block: "The comment should be removed.",
          },
        },
        toxicity: {
          type: "score",
          instructions: "Rate how toxic the comment is.",
          criteria: ["Not toxic", "Mildly toxic", "Toxic", "Severely toxic"],
        },
        targets_person: {
          type: "noul",
          instructions: "Does the comment attack a specific person?",
        },
      },
    },
  },
  {
    label: "Lead scoring",
    request: {
      model: MODEL_ID,
      state: {
        company: "Acme Corp",
        employees: 1200,
        budget_usd: 80000,
        timeline: "This quarter",
        note: "Evaluating three vendors, needs SSO and SOC2.",
      },
      questions: {
        tier: {
          type: "choice",
          instructions: "Which sales tier fits this lead?",
          criteria: {
            enterprise: "Large budget, near-term timeline, security requirements.",
            mid_market: "Some budget and interest but no urgency.",
            self_serve: "Small or exploratory.",
          },
        },
        fit: {
          type: "score",
          instructions: "Score the lead's fit for the product.",
          criteria: ["Poor", "Fair", "Good", "Excellent"],
        },
      },
    },
  },
] as const;

const DEFAULT_REQUEST = JSON.stringify(PRESETS[0].request, null, 2);

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ProbabilityBars({ probabilities }: { probabilities: Record<string, number> }) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-2 grid gap-1">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
          <div className="h-1.5 flex-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: toPercent(value) }} />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">{toPercent(value)}</span>
        </div>
      ))}
    </div>
  );
}

function AnswerValue({ answer }: { answer: DecisionAnswer }) {
  switch (answer.type) {
    case "choice":
      return (
        <div>
          <p className="text-lg font-medium">{answer.choice}</p>
          {answer.confidence !== undefined ? (
            <p className="text-muted-foreground text-xs">
              confidence {toPercent(answer.confidence)}
            </p>
          ) : null}
          {answer.probabilities ? <ProbabilityBars probabilities={answer.probabilities} /> : null}
        </div>
      );
    case "score":
      return (
        <div>
          <p className="text-lg font-medium tabular-nums">
            {answer.score.toFixed(2)}
            {answer.probabilities ? ` / ${Object.keys(answer.probabilities).length - 1}` : ""}
          </p>
          {answer.confidence !== undefined ? (
            <p className="text-muted-foreground text-xs">
              confidence {toPercent(answer.confidence)}
            </p>
          ) : null}
          {answer.probabilities ? <ProbabilityBars probabilities={answer.probabilities} /> : null}
        </div>
      );
    case "noul":
      return (
        <div>
          <p className="text-lg font-medium tabular-nums">{toPercent(answer.noul)}</p>
          <p className="text-muted-foreground text-xs">probability the statement is true</p>
        </div>
      );
    default:
      return <p className="text-muted-foreground text-sm">The model declined to answer.</p>;
  }
}

function AnswerGrid({ answers }: { answers: Record<string, DecisionAnswer> }) {
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No answers.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([name, answer]) => (
        <div key={name} className="rounded-lg border p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">{name}</span>
            <span className="text-muted-foreground text-xs">{answer.type}</span>
          </div>
          <AnswerValue answer={answer} />
        </div>
      ))}
    </div>
  );
}

function UsageLine({ usage }: { usage: Doc<"decisions">["usage"] }) {
  return (
    <p className="text-muted-foreground text-xs">
      {usage.input_tokens} input tokens · {usage.output_tokens} output tokens
      {usage.cost !== undefined ? ` · $${usage.cost.toFixed(4)}` : ""}
    </p>
  );
}

function HistoryItem({ decision }: { decision: Doc<"decisions"> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate text-sm">
          {Object.keys(decision.questions).length} question
          {Object.keys(decision.questions).length === 1 ? "" : "s"}:{" "}
          {Object.keys(decision.questions).join(", ")}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {new Date(decision._creationTime).toLocaleString()}
        </span>
      </button>
      {open ? (
        <div className="mt-3 grid gap-2">
          <UsageLine usage={decision.usage} />
          <AnswerGrid answers={decision.answers} />
        </div>
      ) : null}
    </div>
  );
}

export default function DecisionPlayground() {
  const evaluate = useAction(api.decisions.evaluate);
  const history = useQuery(convexQuery(api.decisions.list, { limit: 20 }));

  const [requestText, setRequestText] = useState(DEFAULT_REQUEST);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(requestText);
    } catch {
      setError("Request must be valid JSON.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Request must be a JSON object.");
      return;
    }

    const request = parsed as { state?: unknown; questions?: unknown };
    if (request.state === undefined) {
      setError("Request must include a state field.");
      return;
    }
    if (
      typeof request.questions !== "object" ||
      request.questions === null ||
      Array.isArray(request.questions)
    ) {
      setError("Request must include a questions object.");
      return;
    }

    setIsRunning(true);
    try {
      const response = await evaluate({
        state: request.state as EvaluateArgs["state"],
        questions: request.questions as EvaluateArgs["questions"],
        source: "playground",
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="container mx-auto grid max-w-5xl gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Decision Playground</h1>
        <p className="text-muted-foreground text-sm">
          Structured decisions with TypeSafe Jev ({MODEL_ID}). Send one state and several questions;
          answers come back by name.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => setRequestText(JSON.stringify(preset.request, null, 2))}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="decision-request">
            Request body
          </label>
          <Textarea
            id="decision-request"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            spellCheck={false}
            className="min-h-[28rem] font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={isRunning}>
              {isRunning ? "Evaluating..." : "Run decision"}
            </Button>
            {error ? <span className="text-red-500 text-sm">{error}</span> : null}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Result</h2>
            {result ? (
              <div className="grid gap-3">
                <AnswerGrid answers={result.answers} />
                <UsageLine usage={result.usage} />
                <p className="text-muted-foreground font-mono text-xs">id: {result.id}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Run a decision to see the answers here.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <h2 className="font-medium">Recent decisions</h2>
        {history.data && history.data.length > 0 ? (
          <div className="grid gap-2">
            {history.data.map((decision) => (
              <HistoryItem key={decision._id} decision={decision} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No decisions logged yet.</p>
        )}
      </div>
    </div>
  );
}
