/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    // Use ts-jest for TypeScript
    preset: 'ts-jest',

    // Node environment for backend testing
    testEnvironment: 'node',

    // Root directory for tests
    rootDir: '.',

    // Look for test files in src directory
    roots: ['<rootDir>/src'],

    // Test file patterns
    testRegex: '.*\\.spec\\.ts$',

    // Transform TypeScript files
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest'
    },

    // Module path aliases (match tsconfig.json)
    moduleNameMapper: {
        '^@/generated/(.*)$': '<rootDir>/generated/$1',
        '^@/(.*)$': '<rootDir>/src/$1'
    },

    // File extensions to consider
    moduleFileExtensions: ['js', 'json', 'ts'],

    // Coverage configuration
    collectCoverageFrom: [
        '**/*.(t|j)s',
        '!**/*.spec.(t|j)s',
        '!**/*.e2e-spec.(t|j)s',
        '!**/node_modules/**',
        '!**/dist/**'
    ],
    coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/src/main.ts', '.*\\.module\\.ts$'],
    coverageDirectory: './coverage',

    // Setup files to run before tests
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

    // Test timeout (useful for integration tests)
    testTimeout: 30000,

    // Clear mocks between tests
    clearMocks: true,

    // Verbose output
    verbose: true
}
