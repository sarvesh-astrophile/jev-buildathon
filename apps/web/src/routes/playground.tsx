import { createFileRoute } from "@tanstack/react-router";

import DecisionPlayground from "@/components/decision-playground";

export const Route = createFileRoute("/playground")({
  component: DecisionPlayground,
});
