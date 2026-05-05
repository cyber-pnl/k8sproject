module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{js}',
    '!src/shared/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'jest-report.xml' }]
  ],
  testMatch: ['**/?(*.)+(spec|test).js'],
  moduleFileExtensions: ['js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^redis$': '<rootDir>/__mocks__/redis.js'
  }
};

