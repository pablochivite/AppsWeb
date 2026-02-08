/**
 * Copy user data from Firebase Production to Emulator
 * Usage: node scripts/copy-user-to-emulator.js --userId=USER_ID
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Initialize production Firebase (using service account)
const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found at project root.');
  console.error('   This script needs production credentials to copy data.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize production admin
const productionApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
}, 'production');

const productionDb = admin.firestore(productionApp);

// Initialize emulator admin
const emulatorApp = admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'regain-1b588'
}, 'emulator');

// Set emulator host
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const emulatorDb = admin.firestore(emulatorApp);

/**
 * Convert Firestore data to plain objects (handles Timestamps, etc.)
 */
function toPlainObject(data) {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data instanceof admin.firestore.Timestamp) {
    return data;
  }
  
  if (data instanceof Date) {
    return admin.firestore.Timestamp.fromDate(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => toPlainObject(item));
  }
  
  if (typeof data === 'object') {
    const plain = {};
    for (const [key, value] of Object.entries(data)) {
      plain[key] = toPlainObject(value);
    }
    return plain;
  }
  
  return data;
}

/**
 * Copy a document and all its subcollections
 */
async function copyDocumentWithSubcollections(
  sourceDb,
  targetDb,
  collectionPath,
  docId,
  depth = 0
) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}📄 Copying document: ${collectionPath}/${docId}`);
  
  // Handle nested paths (e.g., "users/uid/subcollection/docId")
  const pathParts = collectionPath.split('/');
  let sourceRef, targetRef;
  
  if (pathParts.length === 1) {
    // Top-level collection
    sourceRef = sourceDb.collection(collectionPath).doc(docId);
    targetRef = targetDb.collection(collectionPath).doc(docId);
  } else {
    // Nested path (subcollection)
    sourceRef = sourceDb.doc(`${collectionPath}/${docId}`);
    targetRef = targetDb.doc(`${collectionPath}/${docId}`);
  }
  
  // Get source document
  const sourceDoc = await sourceRef.get();
  
  if (!sourceDoc.exists) {
    console.log(`${indent}  ⚠️  Document does not exist in source`);
    return 0;
  }
  
  // Get document data
  const data = sourceDoc.data();
  const plainData = toPlainObject(data);
  
  // Write to target
  await targetRef.set(plainData);
  console.log(`${indent}  ✅ Document copied (${Object.keys(plainData).length} fields)`);
  
  let totalSubDocs = 0;
  
  // Get all subcollections
  const subcollections = await sourceRef.listCollections();
  
  if (subcollections.length > 0) {
    console.log(`${indent}  📁 Found ${subcollections.length} subcollection(s)`);
  }
  
  for (const subcollection of subcollections) {
    const subcollectionPath = `${collectionPath}/${docId}/${subcollection.id}`;
    console.log(`${indent}  📁 Copying subcollection: ${subcollection.id}`);
    
    // Get all documents in subcollection
    const subcollectionDocs = await subcollection.get();
    
    if (subcollectionDocs.size === 0) {
      console.log(`${indent}    ⚠️  Subcollection ${subcollection.id} is empty`);
      continue;
    }
    
    // Copy each document in the subcollection
    for (const subDoc of subcollectionDocs.docs) {
      const subDocCount = await copyDocumentWithSubcollections(
        sourceDb,
        targetDb,
        subcollectionPath,
        subDoc.id,
        depth + 1
      );
      totalSubDocs += subDocCount;
    }
    
    console.log(`${indent}  ✅ Subcollection ${subcollection.id} copied (${subcollectionDocs.size} documents)`);
    totalSubDocs += subcollectionDocs.size;
  }
  
  return 1 + totalSubDocs; // Return count of documents copied
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--userId='));
  const userId = userIdArg ? userIdArg.split('=')[1] : null;
  
  if (!userId) {
    console.error('❌ User ID is required');
    console.log('\nUsage:');
    console.log('  node scripts/copy-user-to-emulator.js --userId=YOUR_USER_ID\n');
    process.exit(1);
  }
  
  console.log('🔄 Copying user data from Production to Emulator\n');
  console.log(`👤 User ID: ${userId}`);
  console.log(`📦 Source: Production Firebase`);
  console.log(`📦 Target: Firestore Emulator (${process.env.FIRESTORE_EMULATOR_HOST})\n`);
  
  try {
    // Check if user exists in production
    const productionUserRef = productionDb.collection('users').doc(userId);
    const productionUserDoc = await productionUserRef.get();
    
    if (!productionUserDoc.exists) {
      console.error(`❌ User ${userId} not found in production`);
      process.exit(1);
    }
    
    console.log('✅ User found in production\n');
    
    // Copy main user document
    let totalDocs = await copyDocumentWithSubcollections(
      productionDb,
      emulatorDb,
      'users',
      userId,
      0
    );
    
    // Explicitly check and copy common subcollections
    const subcollectionsToCheck = [
      'completedSessions',
      'exerciseHistory',
      'trainingSystems',
      'sessionReports',
      'milestones'
    ];
    
    const userRef = productionDb.collection('users').doc(userId);
    let subcollectionCount = 0;
    
    for (const subcollectionName of subcollectionsToCheck) {
      const subcollectionRef = userRef.collection(subcollectionName);
      const snapshot = await subcollectionRef.limit(1).get();
      
      if (!snapshot.empty) {
        console.log(`\n📁 Found subcollection: ${subcollectionName}`);
        const allDocs = await subcollectionRef.get();
        console.log(`   📄 Copying ${allDocs.size} document(s)...`);
        
        const batch = emulatorDb.batch();
        let batchCount = 0;
        
        for (const doc of allDocs.docs) {
          const targetRef = emulatorDb
            .collection('users')
            .doc(userId)
            .collection(subcollectionName)
            .doc(doc.id);
          
          const data = toPlainObject(doc.data());
          batch.set(targetRef, data);
          batchCount++;
          
          // Firestore batch limit is 500
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
        
        console.log(`   ✅ Copied ${allDocs.size} document(s) from ${subcollectionName}`);
        subcollectionCount += allDocs.size;
      }
    }
    
    totalDocs += subcollectionCount;
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ User data copied successfully!');
    console.log('='.repeat(60));
    console.log(`\n📋 Summary:`);
    console.log(`   • Main user document: 1`);
    console.log(`   • Subcollection documents: ${subcollectionCount}`);
    console.log(`   • Total documents copied: ${totalDocs}`);
    console.log('\n💡 You can now test with real user data in the emulator!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error copying user data:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    // Clean up
    await productionApp.delete();
    await emulatorApp.delete();
  }
}

main();

