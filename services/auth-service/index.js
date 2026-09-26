/**
 * Auth Service Entry Point
 * Port: 3001
 * Handles authentication, user management and sessions.
 *
 * Depuis le remplacement du gateway-service par l'API Gateway Kubernetes,
 * ce service est la source de vérité des sessions (Redis) :
 *   POST /auth/login, POST /auth/signup, GET /auth/logout
 *   GET /auth/session → cible ForwardAuth de Traefik (en-têtes X-User-*)
 */

const express = require("express");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { redisClient: sharedRedisClient, isReady } = require("./src/shared/redis");

// Import module routes
const authRoutes = require("./src/modules/auth/routes");
const sessionRoutes = require("./src/modules/session/routes");
const { createRedisSession } = require("./src/modules/session/store");

const app = express();

// ========================
// EXPRESS CONFIGURATION
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    // Sessions Redis (remplace le gateway-service : l'auth-service est
    // désormais la source de vérité des sessions via l'API Gateway)
    const { client, middleware } = createRedisSession();
    let sessionConnected = false;
    try {
      await client.connect();
      sessionConnected = true;
    } catch (err) {
      console.error("Session Redis connect error:", err);
    }

    // On monte la session AVANT les routes (login/signup/session en ont besoin)
    app.use(sessionConnected ? middleware : (req, res, next) => {
      req.session = null;
      next();
    });

    app.use("/", sessionRoutes);
    app.use("/", authRoutes);
    if (sessionConnected) console.log("Session store ready (Redis)");
    else console.warn("Session middleware off (Redis indisponible)");

    await initDatabase();

    if (!isReady()) {
      console.warn("Redis not ready, caching disabled");
    }

    // Error handling APRÈS les routes
    app.use((req, res) => {
      res.status(404).json({ success: false, message: "Route not found" });
    });

    app.use((err, req, res, next) => {
      console.error("Auth Service error:", err);
      res.status(500).json({ success: false, message: "Erreur serveur" });
    });

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