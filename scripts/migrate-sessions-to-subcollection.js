/**
 * Migration Script: Move Sessions from Embedded Array to Sub-Collection
 * 
 * This script migrates existing training systems from the old structure
 * (sessions embedded as array in system document) to the new structure
 * (sessions stored as sub-collection documents).
 * 
 * Usage:
 *   node scripts/migrate-sessions-to-subcollection.js [userId]
 * 
 * Examples:
 *   node scripts/migrate-sessions-to-subcollection.js              # Migrate all users
 *   node scripts/migrate-sessions-to-subcollection.js abc123       # Migrate specific user
 * 
 * Requires:
 *   - Firebase Admin SDK (serviceAccountKey.json)
 *   - Node.js with firebase-admin package
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

/**
 * Migrate all training systems for a specific user
 * @param {string} userId - User ID
 */
async function migrateUserTrainingSystems(userId) {
    console.log(`\n📦 Migrating training systems for user: ${userId}`);
    
    const systemsRef = db.collection('users').doc(userId).collection('trainingSystems');
    const systemsSnapshot = await systemsRef.get();
    
    if (systemsSnapshot.empty) {
        console.log(`  ℹ️  No training systems found for user ${userId}`);
        return;
    }
    
    console.log(`  📋 Found ${systemsSnapshot.size} training system(s)`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const systemDoc of systemsSnapshot.docs) {
        const systemId = systemDoc.id;
        const systemData = systemDoc.data();
        const sessions = systemData.sessions || [];
        
        if (!Array.isArray(sessions) || sessions.length === 0) {
            console.log(`  ⏭️  System ${systemId}: No sessions to migrate`);
            continue;
        }
        
        console.log(`  🔄 Migrating system ${systemId} (${sessions.length} sessions)...`);
        
        try {
            const batch = db.batch();
            const sessionsRef = systemsRef.doc(systemId).collection('sessions');
            
            // Create session documents in sub-collection
            for (const session of sessions) {
                const sessionId = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const sessionRef = sessionsRef.doc(sessionId);
                
                const sessionData = {
                    ...session,
                    id: sessionId,
                    createdAt: session.createdAt ? admin.firestore.Timestamp.fromDate(new Date(session.createdAt)) : admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                
                batch.set(sessionRef, sessionData, { merge: true });
            }
            
            // Remove sessions array from system document
            const systemRef = systemsRef.doc(systemId);
            batch.update(systemRef, {
                sessions: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Commit batch
            await batch.commit();
            
            console.log(`  ✅ Successfully migrated ${sessions.length} sessions for system ${systemId}`);
            migratedCount++;
            
        } catch (error) {
            console.error(`  ❌ Error migrating system ${systemId}:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`\n  📊 Migration Summary:`);
    console.log(`     ✅ Migrated: ${migratedCount} system(s)`);
    console.log(`     ❌ Errors: ${errorCount} system(s)`);
}

/**
 * Migrate all users' training systems
 */
async function migrateAllUsers() {
    console.log('🚀 Starting migration of sessions to sub-collections...\n');
    
    try {
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        
        if (usersSnapshot.empty) {
            console.log('ℹ️  No users found in database');
            return;
        }
        
        console.log(`📋 Found ${usersSnapshot.size} user(s)`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            await migrateUserTrainingSystems(userId);
        }
        
        console.log('\n✨ Migration completed!');
        
    } catch (error) {
        console.error('❌ Fatal error during migration:', error);
        process.exit(1);
    }
}

/**
 * Migrate a specific user's training systems
 * @param {string} userId - User ID to migrate
 */
async function migrateSpecificUser(userId) {
    console.log(`🚀 Starting migration for user: ${userId}\n`);
    
    try {
        await migrateUserTrainingSystems(userId);
        console.log('\n✨ Migration completed!');
    } catch (error) {
        console.error('❌ Fatal error during migration:', error);
        process.exit(1);
    }
}

// Main execution
const args = process.argv.slice(2);

if (args.length > 0) {
    // Migrate specific user
    const userId = args[0];
    migrateSpecificUser(userId)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
} else {
    // Migrate all users
    migrateAllUsers()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

export {
    migrateUserTrainingSystems,
    migrateAllUsers,
    migrateSpecificUser
};

