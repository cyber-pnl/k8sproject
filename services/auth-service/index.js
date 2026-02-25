/**
 * Auth Service Entry Point
 * Port: 3001
 * Handles authentication and user management
 */

const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { redisClient: sharedRedisClient, isReady } = require("./src/shared/redis");

// Import module routes
const authRoutes = require("./src/modules/auth/routes");

const app = express();

// ========================
// REDIS CLIENT FOR SESSIONS
// ========================
let redisStore = null;
let redisClient = null;

async function initSessionStore() {
  try {
    // Use existing redis client from shared module or create new one
    if (isReady()) {
      redisClient = sharedRedisClient;
    } else {
      // Create new client if shared one not ready
      redisClient = createClient({
        url: process.env.REDIS_URL || "redis://redis-service:6379"
      });
      redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
    }
    
    redisStore = new RedisStore({ client: redisClient });
    console.log(" Redis session store initialized");
  } catch (err) {
    console.error("Failed to initialize Redis session store:", err);
    // Continue without Redis store - sessions will be in-memory
  }
}

// ========================
// EXPRESS CONFIGURATION
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with Redis store
app.use(
  session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    store: redisStore || undefined, // Use Redis if available
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
    },
  })
);

// ========================
// MODULE ROUTES
// ========================
app.use("/", authRoutes);

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.use((err, req, res, next) => {
  console.error("Auth Service error:", err);
  res.status(500).send("Erreur serveur");
});

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    await initDatabase();
    await initSessionStore();
    
    if (!isReady()) {
      console.warn(" Redis not ready, caching disabled");
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
