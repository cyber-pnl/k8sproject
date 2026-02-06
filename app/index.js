const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");

const app = express();
app.use(express.json());

// PostgreSQL
const pgClient = new Pool({
  host: "postgres",
  user: "process.env.POSTGRES_USER",
  password: "process.env.POSTGRES_PASSWORD",
  database: "process.env.POSTGRES_DB",
});

// Redis
const redisClient = redis.createClient({
  socket: {
    host: "redis",
    port: 6379,
  },
});
redisClient.connect();

app.get("/", (req, res) => {
  res.send("Multi-container app running k8s project");
});

app.get("/users", async (req, res) => {
  const cache = await redisClient.get("users");
  if (cache) {
    return res.json(JSON.parse(cache));
  }

  const result = await pgClient.query("SELECT * FROM users");
  await redisClient.set("users", JSON.stringify(result.rows), { EX: 60 });
  res.json(result.rows);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
