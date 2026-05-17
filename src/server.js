import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function bootstrap() {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`API server running on http://127.0.0.1:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
