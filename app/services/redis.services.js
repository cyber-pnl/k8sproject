const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: "redis",
    port: 6379,
  },
});

redisClient.connect()
  .then(() => console.log("Redis connected"))
  .catch(console.error);

module.exports = redisClient;
