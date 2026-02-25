const express = require("express");
const router = express.Router();

const { pgClient } = require("../services/db.services");
const redisClient = require("../services/redis.services");
const { isAuthenticated, isAdmin } = require("../middlewares/auth.middleware");

/**
 * GET /api/users
 * Returns list of users (cached in Redis)
 * Protected: requires authentication
 */
router.get("/api/users", isAuthenticated, async (req, res) => {
  try {
    // Try to get from cache first
    const cache = await redisClient.get("users");

    if (cache) {
      return res.json({
        source: "cache",
        data: JSON.parse(cache),
      });
    }

    // Get from database
    const result = await pgClient.query(
      "SELECT id, username, role FROM users ORDER BY id"
    );

    // Store in cache for 60 seconds
    await redisClient.set("users", JSON.stringify(result.rows), {
      EX: 60,
    });

    res.json({
      source: "database",
      data: result.rows,
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
    await pgClient.query("DELETE FROM users WHERE id = $1", [id]);
    
    // Invalidate cache
    await redisClient.del("users");

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;

