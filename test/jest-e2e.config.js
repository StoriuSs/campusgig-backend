/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    // Use ts-jest for TypeScript
    preset: 'ts-jest',

    // Node environment
    testEnvironment: 'node',

    // Root directory
    rootDir: '..',

    // Look for E2E tests in test directory
    roots: ['<rootDir>/test'],

    // E2E test file pattern
    testRegex: '.e2e-spec.ts$',

    // Transform TypeScript files
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest'
    },

    // Module path aliases (match tsconfig.json)
    moduleNameMapper: {
        '^@/generated/(.*)$': '<rootDir>/generated/$1',
        '^@/(.*)$': '<rootDir>/src/$1'
    },

    // File extensions
    moduleFileExtensions: ['js', 'json', 'ts'],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

    // Transform ESM modules (jose and other ESM-only packages)
    transformIgnorePatterns: ['node_modules/(?!(jose)/)'],

    // Longer timeout for E2E tests (they spin up the full app)
    testTimeout: 60000,

    // Clear mocks between tests
    clearMocks: true,

    // Verbose output
    verbose: true
}
