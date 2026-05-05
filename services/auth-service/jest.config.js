module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'jest-report.xml',
      suiteName: '{title}',
      classNameTemplate: '{classname}-{title}',
      titleTemplate: '{title}'
    }]
  ],
  coverageDirectory: './coverage',
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'clover'],
  moduleNameMapper: {
    '^redis$': '<rootDir>/../node_modules/redis'
  }
};
