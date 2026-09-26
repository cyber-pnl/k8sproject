const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");

/**
 * Fabrique le middleware express-session (même configuration que
 * l'ancien gateway-service, pour conserver le format des sessions Redis).
 */
function buildSessionMiddleware(redisClient) {
  const options = {
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: process.env.COOKIE_SECURE !== "false",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "lax",
    },
  };
  if (redisClient) {
    options.store = new RedisStore({ client: redisClient });
  }
  return session(options);
}

/**
 * Crée le client Redis dédié aux sessions et le middleware associé.
 * Appelé uniquement en production (startServer).
 */
function createRedisSession() {
  const client = createClient({
    url: process.env.REDIS_URL || "redis://redis-service:6379",
  });
  client.on("error", (err) => console.error("Session Redis Client Error:", err));

  const afterConnect = Promise.resolve();

  return {
    client,
    middleware: buildSessionMiddleware(client),
  };
}

module.exports = { buildSessionMiddleware, createRedisSession };