const express = require("express");
const router = express.Router();

const pgClient = require("../services/db.services");
const redisClient = require("../services/redis.services");

router.get("/users", async (req, res) => {
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

module.exports = router;
