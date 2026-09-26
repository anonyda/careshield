/** API e2e tests: real Postgres in the `test` schema (DATABASE_URL_TEST). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: { '^.+\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  testTimeout: 30000,
};
