import "./env";
import { app } from "./app";
import "./jobs/notification-worker";
import { ensureEvidenceBucket } from "./services/storage";
import { armActiveCctvFeeds } from "./routes/cctv";
import { env } from "./env";

ensureEvidenceBucket().catch((err) => console.error("Gagal memastikan bucket evidence:", err));
armActiveCctvFeeds().catch((err) => console.error("Gagal mengaktifkan ulang feed CCTV:", err));

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
