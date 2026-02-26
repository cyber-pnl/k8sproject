/**
 * API Gateway Entry Point
 * Port: 3000
 * Routes requests to appropriate microservices
 * Handles session management for all services
 * 
 * IMPORTANT: Gateway is the SINGLE source of truth for sessions.
 * All auth is handled here, and user info is passed to backend services via headers.
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
// SESSION - Centralized session management (gateway only)
// ========================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "kubelearn-secret-key-2024",
    resave: false,
    saveUninitialized: false,
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
  res.locals.user = req.session.user || null;
  res.locals.currentUser = req.session.user || null;
  next();
});

// Helper function to create proxy options with user headers
const createAuthProxyOptions = (targetPath) => ({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    [`^/${targetPath}`]: `/${targetPath}`,
  },
  onProxyReq: (proxyReq, req) => {
    // Pass session info to auth service
    if (req.session && req.session.user) {
      proxyReq.setHeader("x-user-id", req.session.user.id);
      proxyReq.setHeader("x-user-name", req.session.user.username);
      proxyReq.setHeader("x-user-role", req.session.user.role || "user");
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // After auth service processes, check if it set user info in response headers
    // If so, set the session here in gateway
    const userId = proxyRes.headers["x-user-id"];
    const userName = proxyRes.headers["x-user-name"];
    const userRole = proxyRes.headers["x-user-role"];
    
    if (userId && userName) {
      req.session.user = {
        id: userId,
        username: userName,
        role: userRole || "user",
      };
      req.session.save();
    }
    
    // Handle redirect - preserve it
    const redirectLocation = proxyRes.headers.location;
    if (redirectLocation && redirectLocation.startsWith("/")) {
      // Redirects are handled by the browser, session should be set before redirect
    }
  },
});

// ========================
// AUTH ROUTES - Handle directly in gateway
// ========================

// POST /login - Handle login in gateway, proxy to auth service for verification
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect("/login?error=1");
  }

  try {
    // Proxy to auth service for authentication
    // We'll use a simpler approach: auth service returns JSON with result
    
    const authResponse = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      return res.redirect("/login?error=1");
    }

    const userData = await authResponse.json();

    if (!userData.success) {
      return res.redirect("/login?error=2");
    }

    // Set session in gateway
    req.session.user = {
      id: userData.user.id,
      username: userData.user.username,
      role: userData.user.role,
    };

    await req.session.save();

    // Redirect based on role
    if (userData.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    res.redirect("/");
  } catch (err) {
    console.error("Login proxy error:", err);
    res.redirect("/login?error=1");
  }
});

// POST /signup - Handle signup in gateway
app.post("/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password) {
    return res.redirect("/signup?error=1");
  }

  if (password !== confirmPassword) {
    return res.redirect("/signup?error=2");
  }

  if (password.length < 6) {
    return res.redirect("/signup?error=3");
  }

  if (username.length < 3) {
    return res.redirect("/signup?error=4");
  }

  try {
    // Proxy to auth service for user creation
    const authResponse = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, role: "user" }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      if (errorData.code === 'USER_EXISTS') {
        return res.redirect("/signup?error=5");
      }
      return res.redirect("/signup?error=1");
    }

    const userData = await authResponse.json();

    // Set session in gateway
    req.session.user = {
      id: userData.user.id,
      username: userData.user.username,
      role: userData.user.role,
    };

    await req.session.save();

    // Redirect to home after successful signup
    res.redirect("/");
  } catch (err) {
    console.error("Signup proxy error:", err);
    res.redirect("/signup?error=1");
  }
});

// GET /logout - destroy session in gateway
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
    // Pass session info to frontend service via headers
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

