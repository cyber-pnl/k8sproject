/**
 * Auth Middleware
 * Valide les headers x-user-* injectés par le gateway
 */

function isAuthenticated(req, res, next) {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  if (userId) {
    req.user = {
      id: userId,
      role: String(userRole || "user").toLowerCase(),
    };
    return next();
  }

  // Also check session for local development
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

function isAdmin(req, res, next) {
  const userRole = req.headers["x-user-role"] || (req.session && req.session.user && req.session.user.role);

  if (String(userRole || "").toLowerCase() === "admin") {
    return next();
  }

  res.status(403).json({ error: "Access denied" });
}

module.exports = {
  isAuthenticated,
  isAdmin,
};