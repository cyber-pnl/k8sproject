const RedisStore = jest.fn(() => ({
  on: jest.fn(),
  destroy: jest.fn((sid, callback) => callback()),
  get: jest.fn(),
  set: jest.fn(),
  touch: jest.fn(),
  // Add more methods as needed
}));

module.exports = { RedisStore };

