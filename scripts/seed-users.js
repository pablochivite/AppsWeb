import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root (one level up from scripts/)
const projectRoot = path.resolve(__dirname, '..');

// Check if using emulator
const useEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.USE_FIREBASE_EMULATOR === 'true';

if (useEmulator) {
  // Use emulator
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(`🔧 Using Firestore Emulator: ${emulatorHost}`);
  
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'regain-1b588'
  });
} else {
  // Use production
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'serviceAccountKey.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Create a sample user profile for testing
 */
function createSampleUser(userId, email, displayName) {
  const now = admin.firestore.Timestamp.now();
  
  return {
    email: email,
    displayName: displayName,
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
        mobility: 66, // Converted from 3.3/5 * 100
        rotation: 60, // Converted from 3.0/5 * 100
        flexibility: 60 // Converted from 3.0/5 * 100
      },
      completedAt: now,
      version: '1.0'
    },
    
    // Activity Tracking
    currentStreak: 2,
    longestStreak: 5,
    totalSessions: 10,
    lastSessionDate: null,
    
    // Milestones (empty initially)
    currentMilestones: {},
    
    // Metadata
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
}

/**
 * Seed users collection with sample users
 */
async function seedUsers() {
  console.log('🌱 Starting users seeding...\n');

  const sampleUsers = [
    {
      id: 'test-user-1',
      email: 'test@regain.app',
      displayName: 'Test User'
    },
    {
      id: 'demo-user-1',
      email: 'demo@regain.app',
      displayName: 'Demo User'
    }
  ];

  const batch = db.batch();
  let usersCreated = 0;

  for (const user of sampleUsers) {
    const userRef = db.collection('users').doc(user.id);
    const userData = createSampleUser(user.id, user.email, user.displayName);
    
    batch.set(userRef, userData);
    usersCreated++;
    
    console.log(`  ✓ Prepared user: ${user.displayName} (${user.email})`);
  }

  // Commit batch
  await batch.commit();
  console.log(`\n✅ Committed ${usersCreated} users`);

  console.log('\n============================================================');
  console.log('✨ Users seeding completed successfully!');
  console.log('============================================================');
  console.log(`📊 Summary:`);
  console.log(`   • Users created: ${usersCreated}`);
  console.log('============================================================\n');

  // Print usage instructions
  console.log('📝 To use these users in your app:');
  console.log('   1. Make sure you\'re authenticated with one of these emails');
  console.log('   2. Or use the userId directly: test-user-1 or demo-user-1');
  console.log('   3. The users have complete profiles with baseline assessments\n');
}

// Run seeding
seedUsers()
  .then(() => {
    console.log('✅ Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  });

