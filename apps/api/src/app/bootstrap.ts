import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { buildServer } from "./server.js";
import { registerShutdown } from "./shutdown.js";

export const bootstrap = async () => {
  const config = loadConfig();
  const container = createContainer(config);
  const server = await buildServer(container);
  registerShutdown(server, container);

  await server.listen({ host: config.HOST, port: config.PORT });
  container.logger.info({ port: config.PORT }, "CloudCommerce API listening");
};
