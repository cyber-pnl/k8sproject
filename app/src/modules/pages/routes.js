/**
 * Pages Routes
 * Handles page rendering (home, dashboard)
 */

const express = require("express");
const router = express.Router();

/**
 * GET /
 * Landing page (public)
 */
router.get("/", (req, res) => {
  res.render("home", {
    title: "KubeLearn | Master Kubernetes",
    description: "The modern platform to learn Kubernetes from beginner to expert.",
    user: req.session.user || null,
  });
});

/**
 * GET /dashboard
 * Dashboard page (protected)
 */
router.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("dashboard", {
    title: "Dashboard | KubeLearn",
    description: "Your personal learning dashboard.",
    user: req.session.user,
    currentUser: req.session.user,
  });
});

module.exports = router;

