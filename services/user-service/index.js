/**
 * User Service Entry Point
 * Port: 3002
 */

const express = require("express");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { isReady: redisReady } = require("./src/shared/redis");

// Import users routes
const usersRoutes = require("./src/modules/users/routes");

const app = express();

// ========================
// EXPRESS CONFIGURATION
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

// ========================
// USERS ROUTES
// ========================
app.use("/", usersRoutes);

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("User Service error:", err);
  res.status(500).json({ error: "Erreur serveur" });
});

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    await initDatabase();
    
    if (!redisReady()) {
      console.warn("⚠️  Redis not ready, caching disabled");
    }

    const port = process.env.PORT || 3002;
    app.listen(port, () => {
      console.log(`🚀 User Service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start User Service:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;

