import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";
import { registerDecisionRoutes } from "./decisionHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
registerDecisionRoutes(http);

export default http;
