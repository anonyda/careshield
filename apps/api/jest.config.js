/** Unit tests: pure logic, no database. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};
