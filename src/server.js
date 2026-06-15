import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function bootstrap() {
  await connectDB();

  const startServer = (port, attemptedFallback = false) => {
    const server = app.listen(port, () => {
      const fallbackNote = attemptedFallback ? " (fallback port)" : "";
      console.log(`API server running on http://127.0.0.1:${port}${fallbackNote}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE" && env.nodeEnv === "development" && env.portFallback && !attemptedFallback) {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying ${fallbackPort} for local development...`);
        startServer(fallbackPort, true);
        return;
      }
      throw error;
    });
  };

  startServer(env.port);
}

bootstrap().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
