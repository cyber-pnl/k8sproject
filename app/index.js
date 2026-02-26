/**
 * Main Application Entry Point
 * Modular Monolith Architecture
 */

const express = require("express");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

// Import shared modules
const { initDatabase } = require("./src/shared/database");
const { isReady: redisReady } = require("./src/shared/redis");

// Import module routes
const authRoutes = require("./src/modules/auth/routes");
const usersRoutes = require("./src/modules/users/routes");
const pagesRoutes = require("./src/modules/pages/routes");

const app = express();

// ========================
// EXPRESS CONFIGURATION
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);
app.set("layout", "layout");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// ========================
// MODULE ROUTES
// ========================
// Note: Order matters! More specific routes should come first

// Pages (must be before auth to avoid conflicts)
app.use("/", pagesRoutes);

// Auth routes (login, signup, logout)
app.use("/", authRoutes);

// Users API routes
app.use("/", usersRoutes);

// ========================
// ERROR HANDLING
// ========================
// 404 handler
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Application error:", err);
  res.status(500).send("Erreur serveur");
});

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    
    // Wait for Redis (optional - app can start without it)
    if (!redisReady()) {
      console.warn("Redis not ready, caching disabled");
    }

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;

