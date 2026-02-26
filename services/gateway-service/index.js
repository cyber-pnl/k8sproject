/**
 * API Gateway Entry Point
 * Port: 3000
 */

const express = require("express");
const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");
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
// START SERVER (async pour attendre Redis)
// ========================
async function startServer() {
  // Connexion Redis
  let redisClient;
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://redis-service:6379",
    });
    redisClient.on("error", (err) => console.error("Redis Client Error:", err));
    await redisClient.connect();
    console.log("Redis connected");
  } catch (err) {
    console.error("Redis connection failed:", err);
    process.exit(1);
  }

  const redisStore = new RedisStore({ client: redisClient });

  // ========================
  // SESSION avec Redis store
  // ========================
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "kubelearn-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      store: redisStore,
      cookie: {
        secure: false, // false car pas de HTTPS en local/k8s sans ingress TLS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: "lax",
      },
    })
  );

  // ========================
  // MIDDLEWARE
  // ========================
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  // ========================
  // AUTH ROUTES
  // ========================
  app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect("/login?error=1");
    }

    try {
      const authResponse = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!authResponse.ok) {
        return res.redirect("/login?error=1");
      }

      const userData = await authResponse.json();

      if (!userData.success) {
        return res.redirect("/login?error=2");
      }

      req.session.user = {
        id: userData.user.id,
        username: userData.user.username,
        role: userData.user.role,
      };

      await req.session.save();
      console.log(" Session saved after login:", req.session.user);

      if (userData.user.role === "admin") {
        return res.redirect("/dashboard");
      }
      res.redirect("/");
    } catch (err) {
      console.error("Login error:", err);
      res.redirect("/login?error=1");
    }
  });

  app.post("/signup", async (req, res) => {
    const { username, password, confirmPassword } = req.body;

    if (!username || !password) return res.redirect("/signup?error=1");
    if (password !== confirmPassword) return res.redirect("/signup?error=2");
    if (password.length < 6) return res.redirect("/signup?error=3");
    if (username.length < 3) return res.redirect("/signup?error=4");

    try {
      const authResponse = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role: "user" }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        if (errorData.code === "USER_EXISTS") return res.redirect("/signup?error=5");
        return res.redirect("/signup?error=1");
      }

      const userData = await authResponse.json();

      req.session.user = {
        id: userData.user.id,
        username: userData.user.username,
        role: userData.user.role,
      };

      await req.session.save();
      console.log(" Session saved after signup:", req.session.user);

      res.redirect("/");
    } catch (err) {
      console.error("Signup error:", err);
      res.redirect("/signup?error=1");
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.redirect("/");
    });
  });

  // ========================
  // API Routes — AVANT le proxy "/"
  // ========================
  app.use(
    "/api",
    createProxyMiddleware({
      target: USER_SERVICE_URL,
      changeOrigin: true,
      pathRewrite: { "^/api": "" },
      onProxyReq: (proxyReq, req) => {
        if (req.session && req.session.user) {
          proxyReq.setHeader("x-user-id", req.session.user.id);
          proxyReq.setHeader("x-user-role", req.session.user.role || "user");
        }
      },
    })
  );

  // ========================
  // FRONTEND proxy — EN DERNIER
  // ========================
  app.use(
    "/",
    createProxyMiddleware({
      target: FRONTEND_URL,
      changeOrigin: true,
      onProxyReq: (proxyReq, req) => {
        if (req.session && req.session.user) {
          proxyReq.setHeader("x-user-id", req.session.user.id);
          proxyReq.setHeader("x-user-role", req.session.user.role || "user");
          proxyReq.setHeader("x-user-name", req.session.user.username);
          console.log(" Passing user headers to frontend:", req.session.user.username);
        } else {
          console.log(" No session user for request:", req.url);
        }
      },
    })
  );

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(` Gateway running on port ${port}`);
    console.log(`   -> Auth Service: ${AUTH_SERVICE_URL}`);
    console.log(`   -> User Service: ${USER_SERVICE_URL}`);
    console.log(`   -> Frontend Service: ${FRONTEND_URL}`);
  });
}

startServer();

module.exports = app;