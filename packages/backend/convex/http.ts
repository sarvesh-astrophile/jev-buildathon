import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";
import { registerDecisionRoutes } from "./decisionHttp";
import { registerEntityRoutes } from "./entityHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
registerDecisionRoutes(http);
registerEntityRoutes(http);

export default http;
