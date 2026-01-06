# Testing Checklist

This document contains comprehensive testing checklists for verifying that the authentication flow, data migration, and existing features work correctly after the Firebase integration.

## 🔐 Authentication Flow Testing

### Sign Up (New User)
- [ ] Navigate to app - should show login overlay
- [ ] Click "Don't have an account? Sign Up"
- [ ] Fill in name, email, and password (minimum 6 characters)
- [ ] Submit signup form
- [ ] Verify: Loading state shows during signup
- [ ] Verify: Auth overlay hides after successful signup
- [ ] Verify: User is redirected to onboarding (no role set yet)
- [ ] Verify: User profile is created in Firestore with email and displayName

### Sign In (Existing User)
- [ ] Navigate to app - should show login overlay if not authenticated
- [ ] Enter valid email and password
- [ ] Submit login form
- [ ] Verify: Loading state shows during login
- [ ] Verify: Auth overlay hides after successful login
- [ ] Verify: User proceeds to appropriate page (onboarding if no role, or app if role exists)

### Google Sign In
- [ ] Click "Sign in with Google" button
- [ ] Complete Google OAuth flow
- [ ] Verify: Auth overlay hides after successful login
- [ ] Verify: User profile is created if new user
- [ ] Verify: Existing user profile is loaded

### Password Reset
- [ ] Click "Forgot password?" link
- [ ] Enter email address
- [ ] Submit reset form
- [ ] Verify: Success message is shown
- [ ] Verify: Email is received (check inbox)
- [ ] Verify: Password can be reset via email link

### Sign Out
- [ ] While authenticated, find and click sign out button
- [ ] Verify: User is signed out
- [ ] Verify: Auth overlay is shown again
- [ ] Verify: No user data is accessible after sign out

### Error Handling
- [ ] Try to sign in with invalid email format
- [ ] Verify: Error message is shown
- [ ] Try to sign in with wrong password
- [ ] Verify: Error message is shown ("Incorrect password")
- [ ] Try to sign up with existing email
- [ ] Verify: Error message is shown ("Account already exists")
- [ ] Try to sign up with password < 6 characters
- [ ] Verify: Error message is shown

### Authentication State Persistence
- [ ] Sign in successfully
- [ ] Refresh the page
- [ ] Verify: User remains signed in
- [ ] Verify: No auth overlay is shown
- [ ] Verify: User proceeds directly to app

---

## 📦 Data Migration Testing

### New User (No localStorage Data)
- [ ] Clear all localStorage
- [ ] Sign up as new user
- [ ] Complete onboarding
- [ ] Verify: Profile is saved directly to Firestore
- [ ] Verify: Role is saved to Firestore
- [ ] Verify: No migration errors in console

### Existing User (With localStorage Data)
- [ ] **Before migration test:**
  - [ ] Set localStorage data manually:
    ```javascript
    localStorage.setItem('userRole', 'athlete');
    localStorage.setItem('onboardingData', JSON.stringify({
      sedentaryImpact: 'moderate',
      discomforts: ['lower-back'],
      primaryDiscipline: ['strength']
    }));
    localStorage.setItem('userProfile', JSON.stringify({
      preferredDisciplines: ['strength'],
      discomforts: ['lower-back'],
      equipment: [],
      goals: []
    }));
    localStorage.setItem('trainingSystem', JSON.stringify({
      startDate: new Date().toISOString(),
      sessions: [/* some session data */]
    }));
    ```
- [ ] Sign up or sign in (first time with Firebase)
- [ ] Verify: Migration runs automatically
- [ ] Check console for migration logs
- [ ] Verify: Profile data is migrated to Firestore
- [ ] Verify: Training system is migrated to Firestore
- [ ] Verify: Role is migrated to Firestore
- [ ] Verify: localStorage data still exists (for fallback)

### Migration Edge Cases
- [ ] Sign in with existing Firestore data
- [ ] Verify: Migration does NOT overwrite existing Firestore data
- [ ] Verify: Console shows "User already has Firestore data, skipping migration"
- [ ] Sign in with empty localStorage
- [ ] Verify: Migration runs without errors (no data to migrate)
- [ ] Verify: New profile is created in Firestore

### Verify Migration Data Integrity
- [ ] After migration, check Firestore console:
  - [ ] User document exists at `users/{userId}`
  - [ ] Profile has correct role
  - [ ] Profile has correct preferredDisciplines
  - [ ] Profile has correct discomforts
  - [ ] Training system exists at `users/{userId}/trainingSystems/{systemId}`
  - [ ] Training system has correct sessions array

---

## ✅ Existing Features Testing

### Athlete Dashboard
- [ ] Sign in as athlete
- [ ] Verify: Home page loads correctly
- [ ] Verify: Calendar page loads correctly
- [ ] Verify: Modus Operandi page loads correctly
- [ ] Verify: Explore page loads correctly
- [ ] Verify: Profile page loads correctly

### Training System Generation
- [ ] Sign in as athlete (with completed onboarding)
- [ ] Navigate to home page
- [ ] If no training system exists, click "Generate My First Plan"
- [ ] Verify: Loading state shows during generation
- [ ] Verify: Training system is generated
- [ ] Verify: Training system is saved to Firestore
- [ ] Verify: First session is displayed on dashboard
- [ ] Verify: Session phases are expandable/collapsible

### Calendar View
- [ ] Navigate to calendar page
- [ ] Verify: Calendar renders correctly (weekly view by default)
- [ ] Verify: Sessions are displayed on correct dates
- [ ] Verify: Today's date is highlighted
- [ ] Click toggle to switch to monthly view
- [ ] Verify: Calendar switches to monthly view
- [ ] Verify: Sessions are still visible in monthly view
- [ ] Scroll to navigate between weeks/months
- [ ] Verify: Calendar updates correctly
- [ ] Verify: View preference is saved (refresh page, preference persists)

### Session View (Workout Player)
- [ ] From dashboard, click "Start" on a session
- [ ] Verify: Full-screen session overlay appears
- [ ] Verify: Current exercise is displayed
- [ ] Verify: Progress bar shows correct progress
- [ ] Verify: Phase indicator shows current phase
- [ ] Click "Complete Set" button
- [ ] Verify: Set counter increments
- [ ] Verify: Progress updates
- [ ] Complete all sets in a variation
- [ ] Verify: Moves to next variation
- [ ] Pause session
- [ ] Verify: Progress is saved
- [ ] Exit session
- [ ] Resume session from dashboard
- [ ] Verify: Progress is restored
- [ ] Complete entire session
- [ ] Verify: Milestones are updated
- [ ] Verify: Session progress is cleared

### Exercise Swapping
- [ ] From dashboard, expand a phase
- [ ] Click swap icon on an exercise
- [ ] Verify: Alternative exercise is found
- [ ] Verify: Exercise is swapped in session
- [ ] Verify: Training system is updated in Firestore

### Role-Based Navigation
- [ ] Sign in as athlete
- [ ] Verify: Sidebar shows athlete navigation items
- [ ] Sign out and sign up as coach
- [ ] Verify: Sidebar shows coach navigation items
- [ ] Verify: Coach home page is accessible
- [ ] Verify: Coach calendar is accessible
- [ ] Verify: Coach clients page is accessible

### Onboarding Flow
- [ ] Sign up as new user
- [ ] Select "Athlete" role
- [ ] Verify: Onboarding questions appear
- [ ] Answer Question 1 (Sedentary Impact)
- [ ] Verify: Moves to Question 2
- [ ] Answer Question 2 (Discomforts - select at least one)
- [ ] Verify: Moves to Question 3
- [ ] Answer Question 3 (Disciplines - select at least one)
- [ ] Verify: "Continue" button is enabled
- [ ] Click Continue
- [ ] Verify: Onboarding completes
- [ ] Verify: Profile is saved to Firestore
- [ ] Verify: User proceeds to athlete home page

### Multi-Device Sync (Manual Testing)
- [ ] Sign in on Device 1
- [ ] Generate a training system
- [ ] Sign in on Device 2 (same account)
- [ ] Verify: Training system appears on Device 2
- [ ] Make a change on Device 1 (swap exercise, complete session)
- [ ] Refresh Device 2
- [ ] Verify: Changes appear on Device 2

---

## 🎨 UI/UX Testing

### Visual Consistency
- [ ] All pages load without layout shifts
- [ ] Glass morphism effects are consistent
- [ ] Colors and fonts are consistent
- [ ] Icons are displayed correctly
- [ ] Animations are smooth

### Responsive Design
- [ ] Test on desktop (1920x1080, 1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667, 414x896)
- [ ] Verify: Sidebar is accessible on all screen sizes
- [ ] Verify: Calendar is usable on mobile
- [ ] Verify: Session view is usable on mobile
- [ ] Verify: Forms are usable on mobile

### Loading States
- [ ] Verify: Loading indicators show during async operations
- [ ] Verify: Buttons are disabled during loading
- [ ] Verify: No duplicate submissions possible

### Error States
- [ ] Verify: Error messages are user-friendly
- [ ] Verify: Error messages are visible (not hidden)
- [ ] Verify: App doesn't crash on errors
- [ ] Verify: Errors are logged to console for debugging

---

## 🔍 Console Error Checking

After each test, check browser console:
- [ ] No unhandled promise rejections
- [ ] No Firebase errors (auth, firestore)
- [ ] No undefined variable errors
- [ ] No async/await issues
- [ ] Migration logs appear correctly (when applicable)
- [ ] Auth state change logs appear correctly

---

## 📝 Notes

### Test Data Setup
Before testing, ensure:
1. Firebase project is configured with `.env` file
2. Firestore database is created
3. Authentication is enabled (Email/Password and Google)

### Browser Compatibility
Test on:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if possible)

### Known Limitations
- localStorage fallback is maintained for offline scenarios
- Session progress is stored in localStorage (not synced across devices)
- Calendar view preferences are stored in localStorage (user-specific per device)

