const express = require("express");
const { initDatabase } = require("./src/shared/database");
const { initRedis, isReady: redisReady } = require("./src/shared/redis");
const s3 = require("./src/shared/s3");
const coursesRoutes = require("./src/modules/courses/routes");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "course-service", s3Enabled: s3.enabled });
});

app.use("/", coursesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Course Service error:", err);
  res.status(500).json({ error: "Erreur serveur" });
});

async function startServer() {
  try {
    await initDatabase();
    await initRedis();
    if (!redisReady()) console.warn("[WARN] Redis not ready, caching disabled");
    if (!s3.enabled) console.warn("[WARN] S3 not configured (s3-secret manquant) : contenu des leçons indisponible");

    const port = process.env.PORT || 3004;
    app.listen(port, () => {
      console.log(`Course Service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start Course Service:", err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = app;