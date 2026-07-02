import type { FastifyInstance } from "fastify";
import type { AppContainer } from "./container.js";

export const registerShutdown = (server: FastifyInstance, container: AppContainer): void => {
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    container.logger.info({ signal }, "Graceful shutdown started");
    try {
      await server.close();
      await container.close();
      container.logger.info({ signal }, "Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      container.logger.error({ err: error, signal }, "Graceful shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
};
