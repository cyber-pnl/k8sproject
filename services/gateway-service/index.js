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
// SHARED SETUP FUNCTION - USED BY TEST AND PROD
// ========================
function commonSetup(redisStore) {
  // SESSION
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: redisStore,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: "lax",
      },
    })
  );

  // MIDDLEWARE
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  // POST /login
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

  // POST /signup
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

  // GET /logout
  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.redirect("/");
    });
  });

  // API Routes — AVANT le proxy "/"
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

  // FRONTEND proxy — EN DERNIER
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
}

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
  // START SERVER FOR TESTS (sync, no listen)
  // ========================
  async function startServer() {
    const redisStore = new RedisStore({ client: null });
    commonSetup(redisStore);
    console.log('Test mode: server initialized without listening');
  }

  // Test env
  if (process.env.NODE_ENV === 'test') {
    startServer();
  }


// For prod async Redis + setup
async function initProd() {
  const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis-service:6379",
  });
  redisClient.on("error", (err) => console.error("Redis Client Error:", err));
  await redisClient.connect();
  console.log("Redis connected");

  const redisStore = new RedisStore({ client: redisClient });
  commonSetup(redisStore);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(` Gateway running on port ${port}`);
    console.log(`   -> Auth Service: ${AUTH_SERVICE_URL}`);
    console.log(`   -> User Service: ${USER_SERVICE_URL}`);
    console.log(`   -> Frontend Service: ${FRONTEND_URL}`);
  });
}


if (require.main === module) {
  if (process.env.NODE_ENV === 'test') {
    console.log('Test mode: sync setup complete');
  } else {
    initProd().catch(err => {
      console.error("Startup failed:", err);
      process.exit(1);
    });
  }
}

module.exports = { app, startServer };


