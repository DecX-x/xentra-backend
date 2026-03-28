import "dotenv/config";

import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down Xentra backend");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed to close server cleanly");
    process.exit(1);
  }
}

async function start() {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    app.log.info(
      { host: env.HOST, port: env.PORT },
      "Xentra backend listening",
    );
  } catch (error) {
    app.log.error(error, "Failed to start Xentra backend");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

await start();
