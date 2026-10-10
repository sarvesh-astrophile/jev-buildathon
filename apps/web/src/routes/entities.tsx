import { createFileRoute } from "@tanstack/react-router";

import EntitySearch from "@/components/entity-search";

export const Route = createFileRoute("/entities")({
  component: EntitySearch,
});
