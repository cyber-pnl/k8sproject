const redis = require("redis");

let client = null;
let isReadyFlag = false;

/**
 * Initialize Redis connection
 */
async function initRedis() {
  try {
    client = redis.createClient({
      url: `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`,
    });

    client.on("error", (err) => console.error("Redis Client Error:", err));
    client.on("connect", () => console.log("✅ Redis connected"));
    client.on("ready", () => {
      isReadyFlag = true;
      console.log("✅ Redis ready");
    });

    await client.connect();
    return client;
  } catch (err) {
    console.error("❌ Redis init error:", err);
    return null;
  }
}

/**
 * Check if Redis is ready
 */
function isReady() {
  return isReadyFlag && client && client.isOpen;
}

/**
 * Get Redis client
 */
function getClient() {
  return client;
}

// Auto-init
initRedis();

module.exports = {
  initRedis,
  isReady,
  getClient,
};

