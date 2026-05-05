module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^redis$': '<rootDir>/__mocks__/redis.js',
    '^connect-redis$': '<rootDir>/__mocks__/connect-redis.js'
  }
};

