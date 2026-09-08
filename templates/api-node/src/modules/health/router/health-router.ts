import type { FastifyPluginAsync } from "fastify";
import { getHealthController } from "../controller/health-controller.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/health", getHealthController);
};
