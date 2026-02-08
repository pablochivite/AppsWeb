import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Check if using emulator
const useEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.USE_FIREBASE_EMULATOR === 'true';

if (useEmulator) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(`🔧 Using Firestore Emulator: ${emulatorHost}`);
  
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'regain-1b588'
  });
} else {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'serviceAccountKey.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Create or update user profile
 */
function createUserProfile(userId, email, displayName) {
  const now = admin.firestore.Timestamp.now();
  
  return {
    email: email || `user-${userId}@regain.app`,
    displayName: displayName || 'User',
    role: 'athlete',
    photoURL: null,
    
    // Profile Data
    preferredDisciplines: ['Pilates', 'Animal Flow', 'Yoga'],
    discomforts: ['lower back'],
    equipment: [],
    goals: ['strength', 'flexibility', 'mobility'],
    objectives: ['improve posture', 'reduce back pain'],
    
    // Baseline Assessment
    baselineAssessment: {
      mobility: {
        overheadReach: 4,
        shoulderRotation: 3,
        hipFlexibility: 3,
        overallScore: 3.3
      },
      rotation: {
        spinalRotation: 3,
        dailyRotationFrequency: 2,
        overallScore: 3.0
      },
      flexibility: {
        lowerBody: 3,
        upperBody: 3,
        overallScore: 3.0
      },
      physiological: {
        age: 30,
        activityLevel: 'moderately-active',
        height: 175,
        weight: 70,
        bodyFatPercent: 20,
        injuryHistory: 'Lower back pain from sedentary work'
      },
      baselineMetrics: {
        mobility: 66,
        rotation: 60,
        flexibility: 60
      },
      completedAt: now,
      version: '1.0'
    },
    
    // Activity Tracking
    currentStreak: 2,
    longestStreak: 5,
    totalSessions: 10,
    lastSessionDate: null,
    
    // Milestones
    currentMilestones: {},
    
    // Metadata
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
}

/**
 * Get all users from Auth (for emulator, we'll list from Firestore)
 */
async function listUsers() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Create profile for a specific user or list existing users
 */
async function main() {
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--userId='));
  const userId = userIdArg ? userIdArg.split('=')[1] : null;
  
  if (!userId) {
    console.log('📋 Listing existing users in Firestore...\n');
    const users = await listUsers();
    
    if (users.length === 0) {
      console.log('   No users found in Firestore.');
      console.log('\n💡 To create a user profile, run:');
      console.log('   node scripts/create-user-profile.js --userId=YOUR_USER_ID [--email=email@example.com] [--name="Display Name"]\n');
      return;
    }
    
    console.log(`   Found ${users.length} user(s):\n`);
    users.forEach(user => {
      console.log(`   • ${user.displayName || user.email || user.id}`);
      console.log(`     ID: ${user.id}`);
      console.log(`     Email: ${user.email || 'N/A'}`);
      console.log(`     Has baseline: ${user.baselineAssessment ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    console.log('💡 To create/update a user profile, run:');
    console.log('   node scripts/create-user-profile.js --userId=YOUR_USER_ID\n');
    return;
  }
  
  // Get email and name from args
  const emailArg = args.find(arg => arg.startsWith('--email='));
  const nameArg = args.find(arg => arg.startsWith('--name='));
  const email = emailArg ? emailArg.split('=')[1] : null;
  const displayName = nameArg ? nameArg.split('=')[1] : null;
  
  console.log(`🌱 Creating/updating user profile for: ${userId}\n`);
  
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    console.log('   ⚠️  User already exists, updating profile...');
    const existingData = userDoc.data();
    const updatedData = createUserProfile(
      userId,
      email || existingData.email,
      displayName || existingData.displayName
    );
    
    // Preserve existing data but update with defaults if missing
    const mergedData = {
      ...existingData,
      ...updatedData,
      // Don't overwrite existing baseline if it exists
      baselineAssessment: existingData.baselineAssessment || updatedData.baselineAssessment,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    await userRef.set(mergedData, { merge: true });
    console.log('   ✅ User profile updated');
  } else {
    console.log('   ➕ Creating new user profile...');
    const userData = createUserProfile(userId, email, displayName);
    await userRef.set(userData);
    console.log('   ✅ User profile created');
  }
  
  console.log('\n✨ Done!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

