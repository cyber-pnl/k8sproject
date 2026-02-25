/**
 * Users Service
 * Handles user data operations with Redis caching
 */

const { query } = require("../../shared/database");
const { getClient } = require("../../shared/redis");

/**
 * Get all users with caching
 */
async function getAllUsers() {
  const redisClient = getClient();
  const cacheKey = "users:all";

  // Try to get from cache
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return { source: "cache", data: JSON.parse(cached) };
      }
    } catch (err) {
      console.error("Redis get error:", err);
    }
  }

  // Get from database
  const result = await query(
    "SELECT id, username, role, created_at FROM users ORDER BY created_at DESC"
  );

  // Cache for 5 minutes
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(result.rows));
    } catch (err) {
      console.error("Redis set error:", err);
    }
  }

  return { source: "database", data: result.rows };
}

/**
 * Get user by ID
 */
async function getUserById(id) {
  const result = await query(
    "SELECT id, username, role, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Delete user
 */
async function deleteUser(id) {
  // Invalidate cache
  const redisClient = getClient();
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.del("users:all");
    } catch (err) {
      console.error("Redis delete error:", err);
    }
  }

  await query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
};

