/**
 * API Gateway Entry Point
 * Port: 3000
 * Routes requests to appropriate microservices
 */

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");

const app = express();

// ========================
// SERVICE URLs
// ========================
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:3002";

// ========================
// EXPRESS CONFIGURATION
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// SESSION (for auth state)
// ========================
const session = require("express-session");
app.use(
  session({
    secret: process.env.SESSION_SECRET || "gateway-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// ========================
// PROXY ROUTES
// ========================

// Auth Service - handles login, signup, logout, pages
app.use("/", createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api": "", // Remove /api prefix for auth service
  },
  onProxyReq: (proxyReq, req) => {
    // Pass session info to auth service
    if (req.session && req.session.user) {
      proxyReq.setHeader("x-user-id", req.session.user.id);
      proxyReq.setHeader("x-user-role", req.session.user.role);
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
      proxyReq.setHeader("x-user-role", req.session.user.role);
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
});

module.exports = app;

