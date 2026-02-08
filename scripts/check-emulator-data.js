/**
 * Helper script to check Firestore Emulator data and get user UID
 * Usage: node scripts/check-emulator-data.js
 * 
 * This script helps verify:
 * 1. If there's any user data in the emulator
 * 2. If there are completed sessions
 * 3. What UID to use for seeding
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Check if emulator is configured
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

console.log(`🔍 Checking Firestore ${isEmulator ? 'Emulator' : 'Production'} at ${emulatorHost}\n`);

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (isEmulator) {
    // Use emulator - no service account needed
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-regain'
    });
  } else {
    // Use production - need service account
    const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ serviceAccountKey.json not found at project root.');
      console.error('   For emulator: Set FIRESTORE_EMULATOR_HOST=localhost:8080');
      console.error('   For production: Place your Firebase service account key at project root.');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

const db = admin.firestore();

async function checkEmulatorData() {
  try {
    console.log('📊 Scanning Firestore Emulator...\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in the emulator.\n');
      console.log('📝 Next steps:');
      console.log('   1. Open your app at http://localhost:3000 (or your dev server)');
      console.log('   2. Sign in or create an account');
      console.log('   3. Complete at least ONE training session');
      console.log('   4. Run this script again to verify data exists\n');
      process.exit(0);
    }

    console.log(`✅ Found ${usersSnapshot.size} user(s) in the emulator:\n`);

    // Check each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`👤 User ID: ${userId}`);
      console.log(`   Email: ${userData.email || 'N/A'}`);
      console.log(`   Display Name: ${userData.displayName || 'N/A'}`);
      console.log(`   Role: ${userData.role || 'N/A'}`);

      // Check completed sessions
      const sessionsRef = db.collection('users').doc(userId).collection('completedSessions');
      const sessionsSnapshot = await sessionsRef.orderBy('date', 'desc').limit(5).get();

      if (sessionsSnapshot.empty) {
        console.log(`   ⚠️  No completed sessions found for this user.`);
        console.log(`   📝 You need to complete at least one session before seeding.\n`);
      } else {
        console.log(`   ✅ Found ${sessionsSnapshot.size} recent session(s):`);
        sessionsSnapshot.docs.forEach((doc, idx) => {
          const session = doc.data();
          console.log(`      ${idx + 1}. ${session.date || 'N/A'} - ${session.duration || 0} min`);
        });
        
        // Get total count
        const totalSessions = await sessionsRef.count().get();
        console.log(`   📊 Total completed sessions: ${totalSessions.data().count}\n`);

        // Check exercise history
        const historyRef = db.collection('users').doc(userId).collection('exerciseHistory');
        const historyCount = await historyRef.count().get();
        console.log(`   📈 Exercise history entries: ${historyCount.data().count}`);

        console.log(`\n🎯 Ready for seeding! Use this command:`);
        console.log(`   npm run seed:user-history -- --userId=${userId} --days=365 --sessionsPerWeek=4\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking emulator data:', error);
    console.error('\n💡 Make sure:');
    console.error('   1. Firebase emulators are running: npm run emulators:all');
    console.error('   2. FIRESTORE_EMULATOR_HOST is set (or defaults to localhost:8080)');
    process.exit(1);
  }
}

checkEmulatorData();

