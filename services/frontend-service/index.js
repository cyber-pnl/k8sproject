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
let redisClient = null;

async function initSessionStore() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://redis-service:6379",
    });
    redisClient.on("error", (err) => console.error("Redis Client Error", err));
    await redisClient.connect();

    const redisStore = new RedisStore({ client: redisClient });

    // ✅ Session configurée ICI, après que Redis soit prêt
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "kubelearn-secret-key-2024",
        resave: false,
        saveUninitialized: false,
        store: redisStore,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24, // 24 hours
          sameSite: "lax",
        },
      })
    );

    console.log("✅ Redis session store initialized");
  } catch (err) {
    console.error("Failed to initialize Redis session store:", err);
    // Fallback: session en mémoire sans Redis
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "kubelearn-secret-key-2024",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false,
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24,
          sameSite: "lax",
        },
      })
    );
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

// ========================
// MIDDLEWARE - Lit les headers du gateway pour identifier l'utilisateur
// Le gateway est la SEULE source de vérité pour la session
// ========================
app.use((req, res, next) => {
  // Priorité aux headers envoyés par le gateway (source de vérité)
  if (req.headers["x-user-id"] && req.headers["x-user-name"]) {
    const userFromGateway = {
      id: req.headers["x-user-id"],
      username: req.headers["x-user-name"],
      role: req.headers["x-user-role"] || "user",
    };
    res.locals.user = userFromGateway;
    res.locals.currentUser = userFromGateway;
  } else {
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
    user: res.locals.user,
    currentUser: res.locals.currentUser,
  });
});

// Dashboard page (requires auth)
app.get("/dashboard", (req, res) => {
  if (!res.locals.user) {
    return res.redirect("/login");
  }

  res.render("dashboard", {
    title: "Dashboard | KubeLearn",
    description: "Your personal learning dashboard.",
    user: res.locals.user,
    currentUser: res.locals.currentUser,
  });
});

// Login page
app.get("/login", (req, res) => {
  if (res.locals.user) {
    if (res.locals.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }

  res.render("login", {
    title: "Login | KubeLearn",
    user: null,
    currentUser: null,
    error: req.query.error || null,
  });
});

// Signup page
app.get("/signup", (req, res) => {
  if (res.locals.user) {
    if (res.locals.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }

  res.render("signup", {
    title: "Signup | KubeLearn",
    user: null,
    currentUser: null,
    error: req.query.error || null,
  });
});

// Logout - géré par le gateway, mais on garde la route au cas où
app.get("/logout", (req, res) => {
  res.redirect("/logout");
});

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  // On n'essaie plus de render une vue "404" qui n'existe pas
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

  //  Les routes sont enregistrées après l'init de la session
  const port = process.env.PORT || 3003;
  app.listen(port, () => {
    console.log(` Frontend Service running on port ${port}`);
  });
}

startServer();

module.exports = app;