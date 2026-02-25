/**
 * Auth Routes
 * Handles login, signup, logout endpoints
 */

const express = require("express");
const router = express.Router();
const authController = require("./controller");

/**
 * GET /login
 * Render login page
 */
router.get("/login", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }
  
  res.render("login", { 
    error: req.query.error,
    user: null 
  });
});

/**
 * GET /signup
 * Render signup page
 */
router.get("/signup", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    return res.redirect("/");
  }
  
  res.render("signup", { 
    error: req.query.error,
    user: null 
  });
});

/**
 * POST /login
 * Handle login form submission
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect("/login?error=1");
  }

  try {
    const user = await authController.findUserByUsername(username);

    if (!user) {
      return res.redirect("/login?error=2");
    }

    const passwordMatch = await authController.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.redirect("/login?error=1");
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    if (user.role === "admin") {
      return res.redirect("/dashboard");
    }
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * POST /signup
 * Handle signup form submission
 */
router.post("/signup", async (req, res) => {
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
    // Check if user already exists
    const existingUser = await authController.findUserByUsername(username);

    if (existingUser) {
      return res.redirect("/signup?error=5");
    }

    // Create new user
    const newUser = await authController.createUser(username, password, "user");

    // Set session
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
    };

    res.redirect("/");
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * GET /logout
 * Handle logout
 */
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.redirect("/");
  });
});

module.exports = router;

