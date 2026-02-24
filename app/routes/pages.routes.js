const express = require("express");
const router = express.Router();

/**
 * LANDING PAGE (publique)
 * Accessible par tout le monde
 */
router.get("/", (req, res) => {
  res.render("home", {
    title: "KubeLearn | Master Kubernetes",
    description:
      "The modern platform to learn Kubernetes from beginner to expert.",
  });
});

/**
 * DASHBOARD (protege)
 * Redirige vers /login si pas connecte
 */
router.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("dashboard", {
    title: "Dashboard | KubeLearn",
    description: "Your personal learning dashboard.",
  });
});

module.exports = router;
