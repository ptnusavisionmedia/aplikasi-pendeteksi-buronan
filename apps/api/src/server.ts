import "./env";
import { app } from "./app";
import "./jobs/notification-worker";
import { ensureEvidenceBucket } from "./services/storage";
import { env } from "./env";

ensureEvidenceBucket().catch((err) => console.error("Gagal memastikan bucket evidence:", err));

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
