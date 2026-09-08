import type { FastifyReply, FastifyRequest } from "fastify";
import { getHealthStatus } from "../service/health-service.js";

export async function getHealthController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(getHealthStatus());
}
