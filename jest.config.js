/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  // Clear mock state between tests automatically
  clearMocks: true,
  restoreMocks: true,
  // Show each test name in verbose output
  verbose: true,
  // Reasonable timeout for integration / perf tests
  testTimeout: 15000,
  // Global setup — set minimum env vars so modules that call requireEnv() at
  // module-load time don't throw before tests have a chance to mock them.
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  // setupFiles runs in each test process BEFORE the test module (and its
  // imports) are loaded. globalSetup writes to a parent process and does NOT
  // populate child env, so we need this file to seed env vars consumed at
  // module-load time by src/webhooks/* and src/index.ts.
  setupFiles: ['<rootDir>/tests/helpers/setupContractEnv.ts'],
};
