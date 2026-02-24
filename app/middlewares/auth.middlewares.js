// Vérifie que l'utilisateur est connecté
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// Vérifie que l'utilisateur est admin
function isAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Accès interdit (admin requis)" });
  }

  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
};