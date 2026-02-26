/**
 * Auth Service Entry Point
 * Port: 3001
 * Handles authentication and user management
 * 
 * IMPORTANT: Ce service est appelé uniquement par le gateway Node.js
 * via des requêtes HTTP internes. Il ne gère PAS les sessions lui-même —
 * c'est le gateway qui est la source de vérité pour les sessions.
 */

const express = require("express");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { redisClient: sharedRedisClient, isReady } = require("./src/shared/redis");

// Import module routes
const authRoutes = require("./src/modules/auth/routes");

const app = express();

// ========================
// EXPRESS CONFIGURATION
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// MODULE ROUTES
// ========================
app.use("/", authRoutes);

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Auth Service error:", err);
  res.status(500).json({ success: false, message: "Erreur serveur" });
});

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    await initDatabase();

    if (!isReady()) {
      console.warn("Redis not ready, caching disabled");
    }

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Auth Service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start Auth Service:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;