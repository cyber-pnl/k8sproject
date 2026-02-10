const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ==========================
 * PostgreSQL
 * ==========================
 */
const pgClient = new Pool({
  host: "postgres",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

/**
 * ==========================
 * Redis
 * ==========================
 */
const redisClient = redis.createClient({
  socket: {
    host: "redis",
    port: 6379,
  },
});

redisClient
  .connect()
  .then(() => console.log("Redis connected"))
  .catch(console.error);

/**
 * ==========================
 * PAGE LOGIN
 * ==========================
 */
app.get("/login", (req, res) => {
  const error = req.query.error;

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Connexion</title>
    </head>
    <body>
      <h2>Connexion</h2>

      <form method="POST" action="/login">
        <input
          type="text"
          name="username"
          placeholder="Nom d'utilisateur"
          required
        />
        <br /><br />
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          required
        />
        <br /><br />
        <button type="submit">Se connecter</button>
      </form>

      ${
        error
          ? "<p style='color:red'>Nom d'utilisateur ou mot de passe incorrect</p>"
          : ""
      }
    </body>
    </html>
  `);
});

/**
 * ==========================
 * TRAITEMENT LOGIN
 * ==========================
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pgClient.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.redirect("/login?error=1");
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.redirect("/login?error=1");
    }

    // Authentification OK
    res.redirect(`/?user=${encodeURIComponent(username)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

/**
 * ==========================
 * PAGE D’ACCUEIL
 * ==========================
 */
app.get("/", (req, res) => {
  const user = req.query.user;

  if (!user) {
    return res.redirect("/login");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Kubernetes App</title>
    </head>
    <body>
      <h1>Bienvenue ${user} 👋</h1>

      <p>
        Cette application est un projet pédagogique DevOps déployé sur Kubernetes.
      </p>

      <h2>Architecture</h2>
      <ul>
        <li>Node.js (Express)</li>
        <li>PostgreSQL (Base de données)</li>
        <li>Redis (Cache)</li>
        <li>Kubernetes (Orchestration)</li>
      </ul>

      <h2>Sécurité</h2>
      <p>
        Les mots de passe utilisateurs sont stockés sous forme hashée (bcrypt).
        Les secrets d’infrastructure sont gérés via Kubernetes Secrets.
      </p>

      <h2>API</h2>
      <ul>
        <li><code>/users</code> – Liste des utilisateurs (avec cache Redis)</li>
      </ul>
    </body>
    </html>
  `);
});

/**
 * ==========================
 * API USERS (Redis + PostgreSQL)
 * ==========================
 */
app.get("/users", async (req, res) => {
  try {
    const cache = await redisClient.get("users");
    if (cache) {
      return res.json({
        source: "cache",
        data: JSON.parse(cache),
      });
    }

    const result = await pgClient.query(
      "SELECT id, username FROM users"
    );

    await redisClient.set("users", JSON.stringify(result.rows), {
      EX: 60,
    });

    res.json({
      source: "database",
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * ==========================
 * SERVER
 * ==========================
 */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
