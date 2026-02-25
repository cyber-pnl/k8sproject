/**
 * Users Routes
 * Handles user API endpoints with caching
 */

const express = require("express");
const router = express.Router();
const usersService = require("./service");
const { isAuthenticated, isAdmin } = require("../../shared/middlewares/auth.middleware");

/**
 * GET /api/users
 * Returns list of users (cached in Redis)
 * Protected: requires authentication
 */
router.get("/api/users", isAuthenticated, async (req, res) => {
  try {
    const result = await usersService.getAllUsers();
    
    res.json({
      source: result.source,
      data: result.data,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 * Protected: requires admin
 */
router.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await usersService.deleteUser(id);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;

