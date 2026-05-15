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
  coverageThreshold: {
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
  // src/index.ts calls app.listen() at module load, which keeps Jest's
  // event loop alive past the last test. Force exit so CI doesn't hang.
  forceExit: true,
  // Global setup — set minimum env vars so modules that call requireEnv() at
  // module-load time don't throw before tests have a chance to mock them.
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
};
