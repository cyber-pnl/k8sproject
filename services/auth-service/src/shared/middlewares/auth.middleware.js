/**
 * Auth Middleware
 */

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Access denied" });
}

module.exports = {
  isAuthenticated,
  isAdmin,
};

