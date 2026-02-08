# Test State Cleanup Solution

## Overview

This document describes the robust state cleanup solution implemented to ensure clean browser state before every E2E test run. This solves the issue where Firebase Auth persistence was causing tests to fail because users remained logged in from previous sessions.

## Problem

Firebase Auth uses browser persistence (localStorage and IndexedDB) to maintain authentication state across page reloads. This caused E2E tests to fail because:

1. **Cached Sessions**: If a user logged in manually, the session persisted in the browser
2. **Auth Overlay Not Showing**: Tests expected the auth overlay to appear, but it was hidden because the user was already authenticated
3. **State Pollution**: Previous test runs left authentication state that interfered with new tests

## Solution

The solution implements comprehensive state cleanup that runs automatically before each test:

### Components

1. **Test Helpers** (`tests/e2e/utils/test-helpers.ts`)
   - `clearBrowserStorage()`: Clears localStorage and sessionStorage
   - `clearFirebasePersistence()`: Clears Firebase IndexedDB databases
   - `signOutFirebaseAuth()`: Signs out from Firebase Auth
   - `clearTestState()`: Comprehensive cleanup function that calls all above

2. **Auth Fixtures** (`tests/e2e/fixtures/auth.fixtures.ts`)
   - Automatically clears state before each test by overriding the `page` fixture
   - All tests using these fixtures get clean state automatically

## How It Works

### Automatic Cleanup (Recommended)

Tests using the auth fixtures automatically get clean state:

```typescript
import { test, expect } from '../fixtures/auth.fixtures';

test('my test', async ({ page, authPage }) => {
  // State is automatically cleared before this test runs
  await page.goto('/');
  await authPage.waitForAuthOverlay(); // Will always show now
});
```

The cleanup happens in the `page` fixture override:
- Clears localStorage
- Clears sessionStorage  
- Clears Firebase IndexedDB persistence
- Signs out from Firebase Auth
- Waits for cleanup to complete

### Manual Cleanup (If Needed)

If you need to clear state manually in a test:

```typescript
import { clearTestState } from '../utils/test-helpers';

test('my test', async ({ page }) => {
  await clearTestState(page);
  await page.goto('/');
});
```

## What Gets Cleared

1. **localStorage**: All localStorage data is cleared
2. **sessionStorage**: All sessionStorage data is cleared
3. **Firebase IndexedDB**: All Firebase-related IndexedDB databases are deleted:
   - `firebaseLocalStorageDb`
   - `firebaseLocalStorageDb:[PROJECT_ID]`
   - `firebase:authUser:[PROJECT_ID]:[default]`
   - Any database containing "firebase" or "firestore" in the name
4. **Firebase Auth**: Attempts to sign out the current user

## Production Impact

**Important**: This solution does NOT affect production authentication persistence. The cleanup only happens in test contexts. Production users will continue to stay logged in across page reloads as expected.

## Test Files Using This Solution

All E2E tests automatically benefit from this cleanup:

- `tests/e2e/auth/login.spec.ts`
- `tests/e2e/auth/signup.spec.ts`
- `tests/e2e/navigation/routing.spec.ts`
- `tests/e2e/onboarding/athlete-onboarding.spec.ts`
- `tests/e2e/athlete/plan-generation.spec.ts`

## Troubleshooting

### Tests Still Failing with "Auth Overlay Not Visible"

1. **Check if you're using the fixtures**: Ensure your test imports from `../fixtures/auth.fixtures`
2. **Verify cleanup is running**: Add a console.log in `clearTestState()` to verify it's being called
3. **Check for timing issues**: The cleanup waits 300ms after completion - if tests are too fast, increase the wait time
4. **Manual cleanup**: Try calling `clearTestState(page)` manually in your test

### IndexedDB Cleanup Failing

IndexedDB cleanup may fail silently if:
- The database is in use by another tab
- The browser doesn't support IndexedDB
- The database name pattern doesn't match

This is acceptable - the cleanup will still clear localStorage and attempt Firebase signOut.

### Firebase SignOut Not Working

Firebase signOut may not work if:
- Firebase isn't loaded yet when cleanup runs
- The app doesn't expose Firebase Auth in the expected way

The cleanup handles this gracefully by:
- Navigating to the app first to ensure Firebase is loaded
- Clearing IndexedDB persistence (which removes auth tokens)
- Continuing even if signOut fails

## Implementation Details

### Cleanup Order

1. Sign out from Firebase Auth (if possible)
2. Clear browser storage (localStorage, sessionStorage)
3. Clear Firebase IndexedDB persistence
4. Wait 300ms for cleanup to complete

### Error Handling

All cleanup functions are designed to fail gracefully:
- Errors are logged as warnings, not thrown
- Tests continue even if some cleanup steps fail
- Multiple cleanup strategies ensure at least some state is cleared

## Future Improvements

Potential enhancements:
1. Add a global setup hook in `playwright.config.ts` for additional cleanup
2. Add cleanup verification (check that state is actually cleared)
3. Add cleanup metrics/logging for debugging
4. Support for clearing other browser storage (cookies, cache)

