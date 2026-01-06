# Architecture Decisions - Phase 1

This document explains the architectural decisions made during Phase 1 of the Firebase migration.

---

## 1. Build Tool: Vite

**Decision**: Use Vite as the build tool instead of Webpack, Parcel, or no build tool.

**Rationale**:
- **Fast HMR**: Vite provides near-instant hot module replacement during development
- **ESM Native**: Works seamlessly with ES6 modules (which the project already uses)
- **Environment Variables**: Built-in support for `.env` files with `import.meta.env`
- **Zero Config**: Minimal configuration needed for our use case
- **Modern**: Uses native ES modules in development, only bundles for production

**Alternatives Considered**:
- **No build tool**: Would require manual environment variable handling and no optimization
- **Webpack**: More complex configuration, slower dev server
- **Parcel**: Good alternative, but Vite is faster and more modern

---

## 2. Firebase Configuration: Environment Variables

**Decision**: Store Firebase config in `.env` file, loaded via `import.meta.env.VITE_*`.

**Rationale**:
- **Security**: Keeps sensitive credentials out of version control
- **Flexibility**: Easy to switch between dev/staging/production environments
- **Vite Integration**: Native support for environment variables
- **Best Practice**: Industry standard for managing configuration

**Implementation**:
- All Firebase config values prefixed with `VITE_` (required by Vite)
- Template file (`env.template`) provided for easy setup
- `.env` is in `.gitignore` to prevent accidental commits

---

## 3. Service Layer Pattern

**Decision**: Create abstraction layer (`authService.js`, `dbService.js`) between UI and Firebase.

**Rationale**:
- **Separation of Concerns**: UI components don't need to know about Firebase implementation
- **Testability**: Easy to mock services for unit testing
- **Maintainability**: Changes to Firebase API only require updates in one place
- **Consistency**: Centralized error handling and data transformation
- **Future-Proofing**: Easy to swap Firebase for another backend if needed

**Structure**:
```
UI Components
    ↓
Service Layer (authService, dbService)
    ↓
Firebase SDK
    ↓
Firebase Services
```

**Benefits**:
- UI code: `await saveUserProfile(userId, data)`
- Instead of: `await setDoc(doc(db, 'users', userId), data)`

---

## 4. Firestore Schema: Sub-Collection Pattern

**Decision**: Use sub-collections for user-specific data: `users/{uid}/trainingSystems/{systemId}`.

**Rationale**:
- **Security**: Easy to enforce user-level access control
- **Scalability**: Each user's data is isolated, preventing document size limits
- **Organization**: Clear hierarchy matches the data model
- **Query Performance**: Can query user's sub-collections efficiently

**Structure**:
```
users/
  {uid}/                    # User document (profile)
    trainingSystems/         # Sub-collection
      {systemId}/            # Training system document
    milestones/              # Sub-collection (future)
      {milestoneId}/         # Milestone document
```

**Alternative Considered**: Flat collections with `userId` field
- **Rejected because**: Harder to secure, requires composite indexes, less organized

---

## 5. Data Denormalization: Sessions in Training Systems

**Decision**: Store sessions as an array within the training system document.

**Rationale**:
- **Read Performance**: Single document read gets all sessions
- **Atomicity**: Can update entire system atomically
- **Simplicity**: Matches current localStorage structure
- **Size**: Training systems are small enough (typically < 1MB per document)

**Trade-offs**:
- **Document Size Limit**: Firestore has 1MB document limit (acceptable for weekly systems)
- **Partial Updates**: Must update entire document to change one session
- **Future Migration**: Can move to sub-collection if needed for larger systems

**Future Consideration**: If training systems grow large, migrate sessions to:
```
users/{uid}/trainingSystems/{systemId}/sessions/{sessionId}
```

---

## 6. Timestamp Handling: Firestore Timestamps

**Decision**: Use Firestore `Timestamp` type for all date fields, convert to ISO strings in service layer.

**Rationale**:
- **Type Safety**: Firestore Timestamps preserve timezone and precision
- **Query Support**: Can query and sort by Timestamps efficiently
- **Consistency**: Standard Firestore practice
- **Conversion**: Service layer handles conversion to/from ISO strings for app compatibility

**Implementation**:
- **Save**: Convert ISO strings → Firestore Timestamps
- **Read**: Convert Firestore Timestamps → ISO strings
- **Service Layer**: Handles all conversions transparently

---

## 7. Milestones: Nested Object vs Sub-Collection

**Decision**: Store milestones as nested object in user profile for MVP.

**Rationale**:
- **Simplicity**: Easier to read/write entire milestone state
- **Atomic Updates**: Can update all milestones in one operation
- **Size**: Milestones object is small (typically < 10KB)
- **Query Pattern**: No complex queries needed (just read user profile)

**Future Migration Path**:
If milestones grow large or need complex queries:
```
users/{uid}/milestones/{milestoneId}
```

**Current Structure**:
```javascript
{
  currentMilestones: {
    [exerciseId]: {
      [variationId]: sessionCount
    }
  }
}
```

---

## 8. Error Handling: Service Layer Wrappers

**Decision**: Wrap Firebase errors in service layer with user-friendly messages.

**Rationale**:
- **User Experience**: Firebase errors are technical; service layer provides context
- **Consistency**: All errors follow same format
- **Debugging**: Can log original Firebase errors while showing user-friendly messages
- **Centralization**: Error handling logic in one place

**Pattern**:
```javascript
try {
  await firebaseOperation();
} catch (error) {
  console.error('Technical error:', error);
  throw new Error(`User-friendly message: ${error.message}`);
}
```

---

## 9. Authentication: Email/Password + Google

**Decision**: Support both email/password and Google authentication.

**Rationale**:
- **User Choice**: Some users prefer social login, others prefer email
- **Conversion**: Social login reduces friction for new users
- **Flexibility**: Can add more providers later (Apple, Facebook, etc.)

**Implementation**:
- Email/password: Primary method (required)
- Google: Optional, can be added later
- Service layer abstracts both methods

---

## 10. Static Data: Exercises JSON

**Decision**: Keep exercises as static JSON file (for now).

**Rationale**:
- **Performance**: No database queries needed for exercise data
- **Versioning**: Can version control exercise definitions
- **Simplicity**: No need to manage exercise CRUD operations
- **Size**: JSON file is small enough to load on app start

**Future Consideration**: Move to Firestore if:
- Exercises need frequent updates
- Need to track exercise usage analytics
- Want to support user-created exercises

---

## 11. Development vs Production: Environment Detection

**Decision**: Use `VITE_ENV` environment variable to detect environment.

**Rationale**:
- **Conditional Logic**: Can enable/disable features based on environment
- **Debugging**: Can add extra logging in development
- **Firebase Emulators**: Can switch to local emulators in development

**Usage**:
```javascript
if (import.meta.env.VITE_ENV === 'development') {
  // Development-only code
}
```

---

## 12. File Structure: Services Directory

**Decision**: Create `js/services/` directory for service layer.

**Rationale**:
- **Organization**: Clear separation of concerns
- **Scalability**: Easy to add more services (e.g., `storageService.js`, `analyticsService.js`)
- **Convention**: Common pattern in modern web apps

**Structure**:
```
js/
  services/
    authService.js      # Authentication operations
    dbService.js         # Database operations
  core/                  # Existing core modules
  athlete/               # Existing athlete modules
  coach/                 # Existing coach modules
```

---

## Summary

These architectural decisions prioritize:
1. **Developer Experience**: Easy to develop and maintain
2. **User Experience**: Fast, reliable, secure
3. **Scalability**: Can grow as the app grows
4. **Maintainability**: Clear structure, easy to understand
5. **Best Practices**: Following industry standards

All decisions are documented and can be revisited as the application evolves.

