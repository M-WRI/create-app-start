import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
