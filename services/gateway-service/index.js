/**
 * API Gateway Entry Point
 * Port: 3000
 * Routes requests to appropriate microservices
 * Handles session management for all services
 */

const express = require("express");
const session = require("express-session");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");

const app = express();

// ========================
// SERVICE URLs
// ========================
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:3002";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://frontend-service:3003";

// ========================
// EXPRESS CONFIGURATION
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// SESSION - Centralized session management
// ========================
app.use(
  session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    },
  })
);

// ========================
// MIDDLEWARE - Pass user info to all views
// ========================
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentUser = req.session.user || null;
  next();
});

// ========================
// AUTH ROUTES - Proxy to auth-service for processing
// ========================

// POST login - authenticate user
app.post("/login", createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/login": "/login",
  },
  onProxyReq: (proxyReq, req) => {
    // Pass session cookie
  },
}));

// POST signup - create user
app.post("/signup", createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/signup": "/signup",
  },
}));

// GET logout - destroy session
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.redirect("/");
  });
});

// ========================
// FRONTEND PAGES - Proxy to frontend-service
// ========================
app.use("/", createProxyMiddleware({
  target: FRONTEND_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    // Pass session info to frontend service
    if (req.session && req.session.user) {
      proxyReq.setHeader("x-user-id", req.session.user.id);
      proxyReq.setHeader("x-user-role", req.session.user.role || "user");
      proxyReq.setHeader("x-user-name", req.session.user.username);
    }
  },
}));

// ========================
// API Routes (to User Service)
// ========================
app.use("/api", createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api": "", 
  },
  onProxyReq: (proxyReq, req) => {
    // Pass user info from session
    if (req.session && req.session.user) {
      proxyReq.setHeader("x-user-id", req.session.user.id);
      proxyReq.setHeader("x-user-role", req.session.user.role || "user");
    }
  },
}));

// ========================
// ERROR HANDLING
// ========================
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.use((err, req, res, next) => {
  console.error("Gateway error:", err);
  res.status(500).send("Erreur serveur");
});

// ========================
// START SERVER
// ========================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Gateway running on port ${port}`);
  console.log(`   -> Auth Service: ${AUTH_SERVICE_URL}`);
  console.log(`   -> User Service: ${USER_SERVICE_URL}`);
  console.log(`   -> Frontend Service: ${FRONTEND_URL}`);
});

module.exports = app;
