const express = require("express");
const bcrypt = require("bcrypt");
const validator = require("validator");
const router = express.Router();

const { pgClient } = require("../services/db.services");

/**
 * PAGE LOGIN
 */
router.get("/login", (req, res) => {
  res.render("login", { error: req.query.error });
});

/**
 * TRAITEMENT LOGIN / SIGNUP AUTOMATIQUE
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {

    // ==============================
    // VALIDATION INPUTS
    // ==============================

    if (!validator.isLength(username, { min: 3, max: 20 })) {
      return res.redirect("/login?error=invalid_username");
    }

    if (!validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      return res.redirect("/login?error=weak_password");
    }

    // ==============================
    // RECHERCHE UTILISATEUR
    // ==============================

    const result = await pgClient.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    // ==============================
    // CREATION SI INEXISTANT
    // ==============================

    if (result.rows.length === 0) {

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertResult = await pgClient.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
        [username, hashedPassword]
      );

      req.session.user = insertResult.rows[0].username;
      return res.redirect("/");
    }

    // ==============================
    // LOGIN EXISTANT
    // ==============================

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.redirect("/login?error=invalid_credentials");
    }

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
