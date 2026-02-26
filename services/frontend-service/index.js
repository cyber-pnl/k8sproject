/**
 * Frontend Service Entry Point
 * Port: 3003
 * Handles views and user interface
 */

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const path = require("path");

const app = express();

// ========================
// REDIS CLIENT FOR SESSIONS
// ========================
let redisStore = null;
let redisClient = null;

async function initSessionStore() {
  try {
    // Create Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://redis-service:6379"
    });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    
    redisStore = new RedisStore({ client: redisClient });
    console.log(" Redis session store initialized");
  } catch (err) {
    console.error("Failed to initialize Redis session store:", err);
    // Continue without Redis store
  }
}

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

// Session configuration with Redis store - must be before routes
app.use(
  session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    store: redisStore || undefined,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    },
  })
);

// ========================
// MIDDLEWARE - Pass user info to all views
// ========================
app.use((req, res, next) => {
  // First check if session has user (direct access)
  if (req.session && req.session.user) {
    res.locals.user = req.session.user;
    res.locals.currentUser = req.session.user;
  } 
  // Check if user info was passed via headers from gateway
  else if (req.headers['x-user-id'] && req.headers['x-user-name']) {
    const userFromHeader = {
      id: req.headers['x-user-id'],
      username: req.headers['x-user-name'],
      role: req.headers['x-user-role'] || 'user',
    };
    // Optionally restore session from headers
    req.session.user = userFromHeader;
    res.locals.user = userFromHeader;
    res.locals.currentUser = userFromHeader;
  }
  else {
    res.locals.user = null;
    res.locals.currentUser = null;
  }
  next();
});

// ========================
// ROUTES
// ========================

// Home page
app.get("/", (req, res) => {
  res.render("home", {
    title: "KubeLearn | Master Kubernetes",
    description: "The modern platform to learn Kubernetes",
    user: req.session.user || null,
    currentUser: req.session.user || null,
  });
});

// Dashboard page (requires auth)
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("dashboard", {
    title: "Dashboard | KubeLearn",
    description: "Your personal learning dashboard.",
    user: req.session.user,
    currentUser: req.session.user,
  });
});

// Login page
app.get("/login", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }
  
  res.render("login", {
    title: "Login | KubeLearn",
    user: null,
    currentUser: null,
  });
});

// Signup page
app.get("/signup", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }
  
  res.render("signup", {
    title: "Signup | KubeLearn",
    user: null,
    currentUser: null,
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.redirect("/");
  });
});

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.use((err, req, res, next) => {
  console.error("Frontend Service error:", err);
  res.status(500).send("Erreur serveur");
});

// ========================
// START SERVER
// ========================
async function startServer() {
  await initSessionStore();
  
  const port = process.env.PORT || 3003;
  app.listen(port, () => {
    console.log(`🚀 Frontend Service running on port ${port}`);
  });
}

startServer();

module.exports = app;
