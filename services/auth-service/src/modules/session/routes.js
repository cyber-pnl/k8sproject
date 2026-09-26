/**
 * Routes de session — remplace la partie "session" de l'ancien gateway-service.
 *
 *   POST /auth/login    → vérifie les credentials, crée la session, Set-Cookie, redirige vers /dashboard
 *   POST /auth/signup   → crée l'utilisateur, crée la session, Set-Cookie, redirige vers /dashboard
 *   GET  /auth/logout   → détruit la session, redirige vers /
 *   GET  /auth/session  → cible ForwardAuth de Traefik : renvoie les en-têtes X-User-* si session valide
 */

const express = require("express");
const router = express.Router();
const authController = require("../auth/controller");

const jsonParser = express.json();
const urlEncodedParser = express.urlencoded({ extended: true });

router.post("/auth/login", jsonParser, urlEncodedParser, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect("/login?error=1");
  }

  try {
    const user = await authController.findUserByUsername(username);
    if (!user) {
      return res.redirect("/login?error=1");
    }

    const passwordMatch = await authController.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.redirect("/login?error=2");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: String(user.role || "user").toLowerCase(),
    };

    await new Promise((resolve) => req.session.save(() => resolve()));

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    return res.redirect("/login?error=1");
  }
});

router.post("/auth/signup", jsonParser, urlEncodedParser, async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) return res.redirect("/signup?error=1");
  if (password !== confirmPassword) return res.redirect("/signup?error=2");
  if (password.length < 6) return res.redirect("/signup?error=3");
  if (username.length < 3) return res.redirect("/signup?error=4");

  try {
    const existing = await authController.findUserByUsername(username);
    if (existing) return res.redirect("/signup?error=5");

    const newUser = await authController.createUser(username, password, "user");

    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      role: String(newUser.role || "user").toLowerCase(),
    };

    await new Promise((resolve) => req.session.save(() => resolve()));

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Signup error:", err);
    return res.redirect("/signup?error=1");
  }
});

router.get("/auth/logout", (req, res) => {
  if (req.session) {
    return req.session.destroy(() => res.redirect("/"));
  }
  return res.redirect("/");
});

router.get("/auth/session", (req, res) => {
  if (req.session && req.session.user) {
    res.set("X-User-Id", String(req.session.user.id));
    res.set("X-User-Name", String(req.session.user.username));
    res.set("X-User-Role", String(req.session.user.role || "user"));
    return res.status(200).json({ authenticated: true });
  }
  return res.status(200).json({ authenticated: false });
});

module.exports = router;