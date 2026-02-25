/**
 * Users Service
 * Handles user-related business logic with Redis caching
 */

const cache = require("../../shared/redis");
const { query } = require("../../shared/database");

const CACHE_KEY = "users:all";
const CACHE_TTL = 60; // seconds

/**
 * Get all users (with Redis caching)
 */
async function getAllUsers() {
  // Try to get from cache first
  const cached = await cache.get(CACHE_KEY);
  if (cached) {
    return { source: "cache", data: cached };
  }

  // Get from database
  const result = await query(
    "SELECT id, username, role, created_at FROM users ORDER BY id"
  );

  // Store in cache
  await cache.set(CACHE_KEY, result.rows, CACHE_TTL);

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
 * Delete user by ID (with cache invalidation)
 */
async function deleteUser(id) {
  await query("DELETE FROM users WHERE id = $1", [id]);
  
  // Invalidate cache
  await cache.del(CACHE_KEY);
  
  return true;
}

/**
 * Clear all user cache
 */
async function clearCache() {
  await cache.del(CACHE_KEY);
}

module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
  clearCache,
};

