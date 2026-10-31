import cors from "cors";
import express from "express";
import { adminRouter } from "./routes/admin";
import { appealsRouter } from "./routes/appeals";
import { authRouter } from "./routes/auth";
import { buronanRouter } from "./routes/buronan";
import { cctvRouter } from "./routes/cctv";
import { detectionsRouter } from "./routes/detections";
import { escalationsRouter } from "./routes/escalations";
import { instansiRouter } from "./routes/instansi";
import { notificationsRouter } from "./routes/notifications";
import { reportsRouter } from "./routes/reports";
import { searchRouter } from "./routes/search";
import { settingsRouter } from "./routes/settings";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/buronan", buronanRouter);
app.use("/cctv-feeds", cctvRouter);
app.use("/instansi", instansiRouter);
app.use("/detections", detectionsRouter);
app.use("/notifications", notificationsRouter);
app.use("/escalations", escalationsRouter);
app.use("/reports", reportsRouter);
app.use("/appeals", appealsRouter);
app.use("/settings", settingsRouter);
app.use("/search", searchRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
