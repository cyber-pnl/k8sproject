/**
 * Auth Routes
 * 
 * Ce service est appelé UNIQUEMENT par le gateway Node.js en interne.
 * Il expose des endpoints JSON — pas de redirects, pas de sessions.
 * 
 * Endpoints utilisés par le gateway :
 *   POST /auth/verify   → vérifier credentials au login
 *   POST /auth/register → créer un utilisateur au signup
 */

const express = require("express");
const router = express.Router();
const authController = require("./controller");

/**
 * POST /auth/verify
 * Vérifie les credentials et retourne les données user (appelé par le gateway au login)
 */
router.post("/auth/verify", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing credentials" });
  }

  try {
    const user = await authController.findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const passwordMatch = await authController.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Retourne les données user sans le mot de passe
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
 * Crée un nouvel utilisateur et retourne ses données (appelé par le gateway au signup)
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
    const existingUser = await authController.findUserByUsername(username);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: "USER_EXISTS",
        message: "User already exists",
      });
    }

    const newUser = await authController.createUser(username, password, role || "user");

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

module.exports = router;