/**
 * Auth Middleware
 * Validates JWT tokens from gateway
 */

function isAuthenticated(req, res, next) {
  // In production, validate JWT token from Authorization header
  // For now, check for user info passed from gateway
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  if (userId) {
    req.user = {
      id: userId,
      role: userRole || "user",
    };
    return next();
  }

  // Also check session for local development
  if (req.session && req.session.user) {
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

function isAdmin(req, res, next) {
  const userRole = req.headers["x-user-role"] || (req.session && req.session.user && req.session.user.role);

  if (userRole === "admin") {
    return next();
  }

  res.status(403).json({ error: "Access denied" });
}

module.exports = {
  isAuthenticated,
  isAdmin,
};

