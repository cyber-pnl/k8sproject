const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// Connect on startup
redisClient.connect()
  .then(() => console.log("✅ Redis connected"))
  .catch((err) => console.error("❌ Redis connection error:", err));

/**
 * Get a value from cache
 */
async function get(key) {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error("Redis get error:", err);
    return null;
  }
}

/**
 * Set a value in cache with expiration
 */
async function set(key, value, ttlSeconds = 60) {
  try {
    await redisClient.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
    return true;
  } catch (err) {
    console.error("Redis set error:", err);
    return false;
  }
}

/**
 * Delete a key from cache
 */
async function del(key) {
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.error("Redis del error:", err);
    return false;
  }
}

/**
 * Check if Redis is connected
 */
function isReady() {
  return redisClient.isReady;
}

module.exports = {
  redisClient,
  get,
  set,
  del,
  isReady,
};

