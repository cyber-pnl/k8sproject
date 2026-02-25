/**
 * Auth Controller
 * Handles all authentication-related operations
 */

const bcrypt = require("bcrypt");
const { query } = require("../../shared/database");

/**
 * Find user by username
 */
async function findUserByUsername(username) {
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0] || null;
}

/**
 * Create a new user
 */
async function createUser(username, password, role = "user") {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const result = await query(
    "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at",
    [username, hashedPassword, role]
  );
  
  return result.rows[0];
}

/**
 * Get all users
 */
async function getAllUsers() {
  const result = await query(
    "SELECT id, username, role, created_at FROM users ORDER BY id"
  );
  return result.rows;
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
 * Delete user by ID
 */
async function deleteUser(id) {
  await query("DELETE FROM users WHERE id = $1", [id]);
  return true;
}

/**
 * Verify password
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  findUserByUsername,
  createUser,
  getAllUsers,
  getUserById,
  deleteUser,
  verifyPassword,
};

