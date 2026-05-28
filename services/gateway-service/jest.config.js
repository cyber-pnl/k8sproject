module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^redis$': '<rootDir>/services/gateway-service/__mocks__/redis.js',
    '^connect-redis$': '<rootDir>/services/gateway-service/__mocks__/connect-redis.js'
  }
};