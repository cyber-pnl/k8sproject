const { query } = require("../../shared/database");

/**
 * Find user by username
 */
async function findUserByUsername(username) {
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0] || null;
}

/**
 * Find user by ID
 */
async function findUserById(id) {
  const result = await query("SELECT id, username, role FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

/**
 * Create new user
 */
async function createUser(username, password, role = "user") {
  const bcrypt = require("bcrypt");
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const result = await query(
    "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
    [username, hashedPassword, role]
  );
  return result.rows[0];
}

/**
 * Verify password
 */
async function verifyPassword(plainPassword, hashedPassword) {
  const bcrypt = require("bcrypt");
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Get all users
 */
async function getAllUsers() {
  const result = await query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
  return result.rows;
}

/**
 * Delete user
 */
async function deleteUser(id) {
  await query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  findUserByUsername,
  findUserById,
  createUser,
  verifyPassword,
  getAllUsers,
  deleteUser,
};

