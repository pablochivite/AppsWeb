# Phase 1: Foundation & Architecture Setup - Implementation Checklist

This checklist guides you through setting up the Firebase foundation for your REGAIN application.

---

## Prerequisites

- [ ] Node.js installed (v18 or higher)
- [ ] npm or yarn package manager
- [ ] Firebase account created
- [ ] Firebase project created in Firebase Console

---

## Step 1: Initialize Vite Project

### 1.1 Install Dependencies

```bash
npm install
```

This will install:
- `vite` (build tool and dev server)
- `firebase` (Firebase SDK)

### 1.2 Verify Vite Configuration

- [ ] Check that `vite.config.js` exists and is configured correctly
- [ ] Verify `package.json` has the correct scripts:
  - `npm run dev` - Start development server
  - `npm run build` - Build for production
  - `npm run preview` - Preview production build

### 1.3 Test Vite Setup

```bash
npm run dev
```

- [ ] Development server starts on `http://localhost:3000`
- [ ] Application loads without errors
- [ ] Check browser console for any import errors

---

## Step 2: Firebase Project Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard:
   - [ ] Enter project name (e.g., "regain-app")
   - [ ] Enable/disable Google Analytics (optional)
   - [ ] Complete project creation

### 2.2 Enable Firebase Services

#### Enable Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click **Get Started**
3. Enable **Email/Password** provider:
   - [ ] Click "Email/Password"
   - [ ] Toggle "Enable"
   - [ ] Save

4. (Optional) Enable **Google** provider for social login:
   - [ ] Click "Google"
   - [ ] Toggle "Enable"
   - [ ] Enter support email
   - [ ] Save

#### Enable Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll add security rules later)
4. Select a location (choose closest to your users)
5. Click **Enable**

### 2.3 Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click **Web** icon (`</>`) to add a web app
4. Register app:
   - [ ] Enter app nickname (e.g., "REGAIN Web")
   - [ ] (Optional) Check "Also set up Firebase Hosting"
   - [ ] Click **Register app**
5. Copy the Firebase configuration object

### 2.4 Configure Environment Variables

1. Copy `env.template` to `.env`:
   ```bash
   cp env.template .env
   ```
   (On Windows: `copy env.template .env`)

2. Open `.env` and fill in your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key-here
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

   - [ ] All environment variables filled in
   - [ ] `.env` file is in `.gitignore` (should be automatic)

3. **Important**: Never commit `.env` to version control!

---

## Step 3: Verify Firebase Configuration

### 3.1 Test Firebase Initialization

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser console (F12)
3. Check for Firebase initialization message:
   - [ ] Should see: `✅ Firebase initialized successfully`
   - [ ] No error messages about missing environment variables

### 3.2 Test Firebase Connection

Create a temporary test file `test-firebase.js`:

```javascript
import { auth, db } from './firebase.config.js';

console.log('Auth:', auth);
console.log('DB:', db);
```

- [ ] No import errors
- [ ] Firebase services are initialized

---

## Step 4: Service Layer Verification

### 4.1 Verify Service Files Exist

- [ ] `js/services/authService.js` exists
- [ ] `js/services/dbService.js` exists
- [ ] Both files export the expected functions

### 4.2 Test Service Imports

In browser console or a test file:

```javascript
import { signIn, signUp, getCurrentUser } from './js/services/authService.js';
import { saveUserProfile, getUserProfile } from './js/services/dbService.js';

console.log('Auth service:', { signIn, signUp, getCurrentUser });
console.log('DB service:', { saveUserProfile, getUserProfile });
```

- [ ] No import errors
- [ ] Functions are available

---

## Step 5: Update HTML Entry Point

### 5.1 Update index.html

The `index.html` should already have:
```html
<script type="module" src="js/app.js"></script>
```

- [ ] Verify the script tag uses `type="module"`
- [ ] Verify the path is correct

### 5.2 Test Module Loading

- [ ] Application loads without errors
- [ ] Check browser console for module import errors
- [ ] All ES6 modules resolve correctly

---

## Step 6: Firestore Security Rules (Basic)

### 6.1 Set Up Basic Security Rules

1. In Firebase Console, go to **Build > Firestore Database > Rules**
2. Replace with basic rules (for development only):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users to their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /trainingSystems/{systemId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /milestones/{milestoneId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. Click **Publish**

- [ ] Rules are published
- [ ] No syntax errors

**⚠️ Note**: These are basic rules. Production rules should be more restrictive.

---

## Step 7: Create Firestore Indexes (If Needed)

Firestore will auto-create indexes for simple queries. For complex queries:

1. Go to **Firestore Database > Indexes**
2. Firestore will prompt you to create indexes when needed
3. Click the link in the error message to create the index

- [ ] No index errors in console (for now)

---

## Step 8: Test Authentication Flow (Manual)

### 8.1 Test Sign Up

In browser console:

```javascript
import { signUp } from './js/services/authService.js';

signUp('test@example.com', 'password123', 'Test User')
  .then(user => console.log('Signed up:', user))
  .catch(error => console.error('Error:', error));
```

- [ ] User is created in Firebase Authentication
- [ ] No errors

### 8.2 Test Sign In

```javascript
import { signIn } from './js/services/authService.js';

signIn('test@example.com', 'password123')
  .then(user => console.log('Signed in:', user))
  .catch(error => console.error('Error:', error));
```

- [ ] User can sign in
- [ ] Current user is available

### 8.3 Test Sign Out

```javascript
import { signOutUser } from './js/services/authService.js';

signOutUser()
  .then(() => console.log('Signed out'))
  .catch(error => console.error('Error:', error));
```

- [ ] User is signed out
- [ ] Current user is null

---

## Step 9: Test Database Operations (Manual)

### 9.1 Test Save User Profile

```javascript
import { getCurrentUser } from './js/services/authService.js';
import { saveUserProfile } from './js/services/dbService.js';

const user = getCurrentUser();
if (user) {
  saveUserProfile(user.uid, {
    role: 'athlete',
    preferredDisciplines: ['Pilates'],
    discomforts: ['lower back'],
    equipment: []
  })
    .then(() => console.log('Profile saved'))
    .catch(error => console.error('Error:', error));
}
```

- [ ] Profile is saved to Firestore
- [ ] Check Firebase Console > Firestore to verify document exists

### 9.2 Test Get User Profile

```javascript
import { getCurrentUser } from './js/services/authService.js';
import { getUserProfile } from './js/services/dbService.js';

const user = getCurrentUser();
if (user) {
  getUserProfile(user.uid)
    .then(profile => console.log('Profile:', profile))
    .catch(error => console.error('Error:', error));
}
```

- [ ] Profile is retrieved from Firestore
- [ ] Data matches what was saved

---

## Step 10: Documentation Review

- [ ] Read `FIRESTORE_SCHEMA.md` to understand data structure
- [ ] Understand the sub-collection pattern
- [ ] Review service layer API in `authService.js` and `dbService.js`

---

## Troubleshooting

### Common Issues

1. **"Missing Firebase environment variables" warning**
   - Solution: Check `.env` file exists and has all required variables
   - Verify variable names start with `VITE_`

2. **Module import errors**
   - Solution: Ensure all imports use correct paths
   - Check that `vite.config.js` has correct alias configuration

3. **Firebase initialization errors**
   - Solution: Verify Firebase config values in `.env`
   - Check Firebase project is active in Firebase Console

4. **CORS errors**
   - Solution: Ensure Firebase project allows your domain
   - Check Firebase Console > Authentication > Settings > Authorized domains

5. **Firestore permission errors**
   - Solution: Check security rules are published
   - Verify user is authenticated before accessing Firestore

---

## Next Steps (Phase 2)

After completing Phase 1, you're ready for:

1. **UI Integration**: Connect existing UI components to service layer
2. **Authentication UI**: Create login/signup forms
3. **Data Migration**: Migrate localStorage data to Firestore
4. **Real-time Updates**: Add Firestore listeners for real-time sync
5. **Error Handling**: Add user-friendly error messages
6. **Loading States**: Add loading indicators for async operations

---

## Verification Checklist

Before moving to Phase 2, ensure:

- [ ] Vite dev server runs without errors
- [ ] Firebase initializes successfully
- [ ] Environment variables are configured
- [ ] Service layer files exist and are importable
- [ ] Can manually test auth operations (sign up, sign in, sign out)
- [ ] Can manually test database operations (save, get profile)
- [ ] Firestore security rules are published
- [ ] Documentation is reviewed

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Firebase Console for service status
3. Review Firebase documentation: https://firebase.google.com/docs
4. Review Vite documentation: https://vitejs.dev/

---

**Status**: ✅ Phase 1 Foundation Complete

Once all checkboxes are complete, you're ready to proceed with Phase 2: UI Integration and Data Migration.

