/**
 * Auth Service Entry Point
 * Port: 3001
 */

const express = require("express");
const session = require("express-session");
const path = require("path");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { isReady: redisReady } = require("./src/shared/redis");

// Import auth routes
const authRoutes = require("./src/modules/auth/routes");

const app = express();

// ========================
// EXPRESS CONFIGURATION
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.set("layout", "layout");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: null, // Will use Redis for sessions in production
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// ========================
// AUTH ROUTES
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
    
    if (!redisReady()) {
      console.warn("⚠️  Redis not ready, caching disabled");
    }

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`🚀 Auth Service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start Auth Service:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;

