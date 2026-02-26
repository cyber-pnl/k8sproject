/**
 * Auth Routes
 * Handles login, signup, logout endpoints
 * Redirects to frontend-service for views
 * 
 * Routes are prefixed with /auth because gateway proxies /auth/ to this service
 */

const express = require("express");
const router = express.Router();
const authController = require("./controller");

const FRONTEND_URL = process.env.FRONTEND_URL || "";

/**
 * GET /auth/login
 * Redirect to frontend login page
 */
router.get("/auth/login", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect(`${FRONTEND_URL}/dashboard`);
    }
    return res.redirect(`${FRONTEND_URL}/`);
  }
  
  res.redirect(`${FRONTEND_URL}/login`);
});

/**
 * GET /auth/signup
 * Redirect to frontend signup page
 */
router.get("/auth/signup", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect(`${FRONTEND_URL}/dashboard`);
    }
    return res.redirect(`${FRONTEND_URL}/`);
  }
  
  res.redirect(`${FRONTEND_URL}/signup`);
});

/**
 * POST /auth/login
 * Handle login form submission
 */
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect(`${FRONTEND_URL}/login?error=1`);
  }

  try {
    const user = await authController.findUserByUsername(username);

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=2`);
    }

    const passwordMatch = await authController.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.redirect(`${FRONTEND_URL}/login?error=1`);
    }

    // Instead of setting session here, return user data for gateway to handle
    // The gateway will set the session
    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    // Send user data as JSON for gateway to process
    // But we also do a redirect for the browser flow
    // Use a special response that gateway can detect
    
    // Set session here as well (for direct auth-service access)
    req.session.user = userData;
    await req.session.save();

    if (user.role === "admin") {
      return res.redirect(`${FRONTEND_URL}/dashboard`);
    }
    res.redirect(`${FRONTEND_URL}/`);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * POST /auth/signup
 * Handle signup form submission - processes the form, does SQL checks
 */
router.post("/auth/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password) {
    return res.redirect(`${FRONTEND_URL}/signup?error=1`);
  }

  if (password !== confirmPassword) {
    return res.redirect(`${FRONTEND_URL}/signup?error=2`);
  }

  if (password.length < 6) {
    return res.redirect(`${FRONTEND_URL}/signup?error=3`);
  }

  if (username.length < 3) {
    return res.redirect(`${FRONTEND_URL}/signup?error=4`);
  }

  try {
    // Check if user already exists (SQL query)
    const existingUser = await authController.findUserByUsername(username);

    if (existingUser) {
      return res.redirect(`${FRONTEND_URL}/signup?error=5`);
    }

    // Create new user (SQL insert)
    const newUser = await authController.createUser(username, password, "user");

    // Set session
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
    };

    // Save session before redirect
    await req.session.save();

    // Redirect to home page after successful signup
    res.redirect(`${FRONTEND_URL}/`);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * GET /auth/logout
 * Handle logout
 */
router.get("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.redirect(`${FRONTEND_URL}/`);
  });
});

/**
 * POST /auth/verify
 * Verify credentials and return user data (for gateway)
 */
router.post("/auth/verify", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing credentials" });
  }

  try {
    const user = await authController.findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const passwordMatch = await authController.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Return user data (without password)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /auth/register
 * Register new user and return user data (for gateway)
 */
router.post("/auth/register", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password too short" });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, message: "Username too short" });
  }

  try {
    // Check if user already exists
    const existingUser = await authController.findUserByUsername(username);

    if (existingUser) {
      return res.status(409).json({ success: false, code: "USER_EXISTS", message: "User already exists" });
    }

    // Create new user
    const newUser = await authController.createUser(username, password, role || "user");

    // Return user data
    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /auth/dashboard
 * User dashboard (protected) - redirect to frontend
 */
router.get("/auth/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect(`${FRONTEND_URL}/login`);
  }

  res.redirect(`${FRONTEND_URL}/dashboard`);
});

module.exports = router;

