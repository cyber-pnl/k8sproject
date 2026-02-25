/**
 * Authentication Middleware
 */

/**
 * Check if user is authenticated
 */
function isAuthenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

/**
 * Check if user is admin
 */
function isAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Accès interdit (admin requis)" });
  }

  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
};

