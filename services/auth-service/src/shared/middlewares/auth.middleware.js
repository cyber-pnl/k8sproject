/**
 * Auth Middleware
 */

// Check session OR headers for user authentication
function isAuthenticated(req, res, next) {
  // First check session
  if (req.session && req.session.user) {
    return next();
  }
  // Check if user info was passed via headers from gateway
  if (req.headers['x-user-id'] && req.headers['x-user-name']) {
    req.session = req.session || {};
    req.session.user = {
      id: req.headers['x-user-id'],
      username: req.headers['x-user-name'],
      role: req.headers['x-user-role'] || 'user',
    };
    return next();
  }
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  // First check session
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  // Check headers
  if (req.headers['x-user-id'] && req.headers['x-user-role'] === 'admin') {
    return next();
  }
  res.status(403).json({ error: "Access denied" });
}

module.exports = {
  isAuthenticated,
  isAdmin,
};

