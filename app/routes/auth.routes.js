const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const pgClient = require("../services/db.services");

/**
 * PAGE LOGIN
 */
router.get("/login", (req, res) => {
  res.render("login", { error: req.query.error });
});

/**
 * TRAITEMENT LOGIN / SIGNUP AUTOMATIQUE
 *  */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pgClient.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      // Utilisateur n'existe pas → création
      const hashedPassword = await bcrypt.hash(password, 10);

      const insertResult = await pgClient.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
        [username, hashedPassword]
      );

      // Session
      req.session.user = insertResult.rows[0].username;

      return res.redirect("/");
    }

    // Utilisateur existant  vérification du mot de passe
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.redirect("/login?error=1");
    }

    // Session
    req.session.user = user.username;

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * PAGE HOME
 */
router.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("home", { user: req.session.user });
});

module.exports = router;
