# Testing Structure Implementation

## Overview

A comprehensive testing structure has been implemented following a **Feature-Based** directory organization with strict separation of concerns between E2E and unit tests.

## Directory Structure

```
tests/
├── e2e/                          # Playwright E2E Tests
│   ├── auth/                     # Authentication flows
│   │   ├── login.spec.ts
│   │   └── signup.spec.ts
│   ├── onboarding/               # Onboarding flows
│   │   └── athlete-onboarding.spec.ts
│   ├── athlete/                   # Athlete features
│   │   └── plan-generation.spec.ts
│   ├── coach/                     # Coach features (placeholder)
│   ├── navigation/                # Navigation tests
│   │   └── routing.spec.ts
│   ├── fixtures/                  # Test fixtures
│   │   ├── auth.fixtures.ts
│   │   ├── test-data.fixtures.ts
│   │   └── page-objects/          # Page Object Models
│   │       ├── auth.page.ts
│   │       ├── dashboard.page.ts
│   │       └── onboarding.page.ts
│   └── utils/                     # E2E utilities
│       └── test-helpers.ts
│
├── unit/                          # Vitest Unit Tests
│   ├── core/                      # Core logic tests
│   │   ├── workout-engine.test.ts
│   │   └── router.test.ts
│   ├── services/                  # Service layer tests (placeholder)
│   ├── athlete/                   # Athlete module tests (placeholder)
│   ├── coach/                     # Coach module tests (placeholder)
│   ├── onboarding/                # Onboarding module tests (placeholder)
│   └── utils/                     # Unit test utilities
│       ├── test-setup.ts
│       └── mocks/
│           └── firebase.mock.ts
│
└── integration/                   # Integration Tests (placeholder)
    ├── api/
    └── workflows/
```

## Configuration Files

### 1. `playwright.config.ts`
- **Scope**: Only `tests/e2e/**/*.spec.ts`
- **Purpose**: E2E browser testing
- **Features**:
  - Automatic dev server startup
  - Multiple browser support (Chromium, Firefox, WebKit)
  - Screenshot and video on failure
  - HTML reporting

### 2. `vitest.config.ts`
- **Scope**: Only `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`
- **Purpose**: Unit and integration testing
- **Features**:
  - jsdom environment for DOM testing
  - Coverage reporting
  - Path aliases (`@/` and `@tests/`)

### 3. `tsconfig.json`
- TypeScript configuration for test files
- Path aliases configured
- Includes Playwright and Vitest types

## Key Features

### ✅ Separation of Concerns
- **Playwright**: Only executes `.spec.ts` files in `tests/e2e/`
- **Vitest**: Only executes `.test.ts` files in `tests/unit/` and `tests/integration/`
- **No conflicts**: Different file patterns and directory scoping

### ✅ Feature-Based Organization
- Tests grouped by domain (Auth, Onboarding, Athlete, Coach)
- Easy to locate and maintain
- Supports parallel execution by feature

### ✅ Page Object Model
- Reusable page objects in `tests/e2e/page-objects/`
- Encapsulates UI interactions
- Reduces test maintenance

### ✅ Test Fixtures
- Authentication helpers (`loginAsAthlete`, `loginAsCoach`)
- Test data generators
- Reusable across tests

## NPM Scripts

```bash
# Run all tests
npm test

# Unit tests
npm run test:unit              # Run once
npm run test:unit:watch        # Watch mode
npm run test:unit:ui           # UI mode
npm run test:unit:coverage     # With coverage

# E2E tests
npm run test:e2e               # Run all
npm run test:e2e:ui            # UI mode
npm run test:e2e:headed        # Headed mode
npm run test:e2e:debug         # Debug mode
npm run test:e2e:report        # View report
```

## Next Steps

### 1. Install Dependencies
```bash
npm install
```

This will install:
- `@playwright/test` - E2E testing
- `vitest` - Unit/integration testing
- `@vitest/ui` - Vitest UI
- `jsdom` - DOM environment for unit tests
- `typescript` - TypeScript support
- `@types/node` - Node types

### 2. Set Up Test Environment
1. Copy `.env.example` to `.env`
2. Fill in test user credentials:
   ```env
   TEST_ATHLETE_EMAIL=athlete@test.com
   TEST_ATHLETE_PASSWORD=testpass123
   TEST_COACH_EMAIL=coach@test.com
   TEST_COACH_PASSWORD=testpass123
   ```

### 3. Create Test Users
Before running E2E tests, ensure test users exist in Firebase:
- Athlete user with email from `TEST_ATHLETE_EMAIL`
- Coach user with email from `TEST_COACH_EMAIL`

### 4. Run Initial Tests
```bash
# Install Playwright browsers
npx playwright install

# Run unit tests
npm run test:unit

# Run E2E tests (requires dev server running)
npm run test:e2e
```

## Test Coverage

### Currently Implemented

#### E2E Tests
- ✅ Authentication (login, signup)
- ✅ Athlete onboarding flow
- ✅ Plan generation
- ✅ Navigation/routing

#### Unit Tests
- ✅ Workout engine core functions
- ✅ Router functionality
- ✅ Firebase mocks

### To Be Implemented

#### E2E Tests
- [ ] Google OAuth login
- [ ] Password reset flow
- [ ] Session execution flow
- [ ] Exercise swap functionality
- [ ] Calendar interactions
- [ ] Explore page (exercise browsing)
- [ ] Coach features (client management, plan builder)
- [ ] Profile management

#### Unit Tests
- [ ] Service layer (authService, dbService)
- [ ] Athlete modules (dashboard, calendar, session-view)
- [ ] Coach modules (dashboard, client-list, plan-builder)
- [ ] Onboarding manager
- [ ] Storage utilities
- [ ] UI utilities

#### Integration Tests
- [ ] Firestore operations
- [ ] Authentication flow integration
- [ ] Complete training workflow

## Best Practices

1. **Use fixtures** for common setup (authentication, test data)
2. **Use page objects** for UI interactions in E2E tests
3. **Keep tests isolated** - each test should be independent
4. **Use descriptive test names** - describe what is being tested
5. **Mock external dependencies** in unit tests
6. **Use test data factories** for generating test data
7. **Follow AAA pattern** - Arrange, Act, Assert

## Troubleshooting

### Playwright Issues
- **Browsers not installed**: Run `npx playwright install`
- **Tests timing out**: Increase timeout in `playwright.config.ts`
- **Dev server not starting**: Check `npm run dev` works manually

### Vitest Issues
- **Module resolution errors**: Check `vitest.config.ts` path aliases
- **DOM not available**: Ensure `jsdom` is installed
- **Firebase mocks not working**: Check import paths in test files

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

