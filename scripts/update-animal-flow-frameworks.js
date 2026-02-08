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
  const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found. Cannot connect to production Firestore.');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('🔧 Using Production Firestore');
}

const db = admin.firestore();

// Constants
const BATCH_SIZE = 400; // Commit every 400 operations to stay well under the 500 limit
const ANIMAL_FLOW_DISCIPLINE = 'animal-flow'; // Discipline is stored as "animal-flow" in Firestore
const TARGET_FRAMEWORK = 'push'; // Changed to lowercase as per user request
const OLD_FRAMEWORK = 'Full Body';

// Statistics tracking
let variationsUpdated = 0;
let variationsSkipped = 0;
let variationsProcessed = 0;

/**
 * Commit batch and return new batch if operation count reaches limit
 */
async function commitBatchIfNeeded(batch, operationCount) {
  if (operationCount >= BATCH_SIZE) {
    await batch.commit();
    console.log(`  ✓ Committed batch (${operationCount} operations)`);
    return { newBatch: db.batch(), resetCounter: true };
  }
  return { newBatch: batch, resetCounter: false };
}

/**
 * Update frameworks for a variation
 * Replaces "Full Body" with "push" and normalizes any existing "Push" to "push"
 */
function updateVariationFrameworks(variation) {
  const frameworks = variation.frameworks || [];
  
  // Check if variation has "Full Body" framework
  const hasFullBody = frameworks.some(f => 
    f.toLowerCase() === OLD_FRAMEWORK.toLowerCase()
  );
  
  // Check if variation already has "push" framework (case-insensitive)
  const hasPush = frameworks.some(f => 
    f.toLowerCase() === TARGET_FRAMEWORK.toLowerCase()
  );
  
  // Create new frameworks array, removing "Full Body" and normalizing "Push" to "push"
  let newFrameworks = frameworks
    .filter(f => f.toLowerCase() !== OLD_FRAMEWORK.toLowerCase()) // Remove "Full Body"
    .map(f => {
      // Normalize "Push" to "push" if it exists
      if (f.toLowerCase() === TARGET_FRAMEWORK.toLowerCase() && f !== TARGET_FRAMEWORK) {
        return TARGET_FRAMEWORK;
      }
      return f;
    });
  
  // Add "push" if not already present
  if (!hasPush) {
    newFrameworks.push(TARGET_FRAMEWORK);
  }
  
  // Only return if there are actual changes
  const originalSorted = [...frameworks].sort();
  const newSorted = [...newFrameworks].sort();
  const hasChanges = JSON.stringify(originalSorted) !== JSON.stringify(newSorted);
  
  return hasChanges ? newFrameworks : null;
}

/**
 * Main function to update Animal Flow variation frameworks
 */
async function updateAnimalFlowFrameworks() {
  try {
    console.log('\n📊 Starting Animal Flow framework update...\n');
    console.log(`Target: Replace "${OLD_FRAMEWORK}" with "${TARGET_FRAMEWORK}" for variations with discipline "${ANIMAL_FLOW_DISCIPLINE}"\n`);

    // Get all variations that have "animal-flow" in their disciplines array
    console.log(`📊 Fetching variations with discipline "${ANIMAL_FLOW_DISCIPLINE}" from Firestore...\n`);
    const variationsSnapshot = await db.collection('variations')
      .where('disciplines', 'array-contains', ANIMAL_FLOW_DISCIPLINE)
      .get();

    if (variationsSnapshot.empty) {
      console.log(`❌ No variations found with discipline "${ANIMAL_FLOW_DISCIPLINE}" in the disciplines array`);
      console.log('💡 Tip: Check if the discipline field uses a different format (e.g., "Animal Flow", "animal_flow", etc.)');
      return;
    }

    console.log(`✓ Found ${variationsSnapshot.size} variation(s) with discipline "${ANIMAL_FLOW_DISCIPLINE}"\n`);

    // Process each variation
    let batch = db.batch();
    let operationCount = 0;

    for (const variationDoc of variationsSnapshot.docs) {
      const variation = { id: variationDoc.id, ...variationDoc.data() };
      variationsProcessed++;
      
      console.log(`\n📝 Processing variation: ${variation.name || variation.id}`);
      
      const currentFrameworks = variation.frameworks || [];
      const newFrameworks = updateVariationFrameworks(variation);

      if (!newFrameworks) {
        console.log(`  ⏭️  Skipped: Already has ${TARGET_FRAMEWORK}, no ${OLD_FRAMEWORK} to replace`);
        variationsSkipped++;
        continue;
      }

      // Check if frameworks actually changed
      const frameworksChanged = JSON.stringify(currentFrameworks.sort()) !== JSON.stringify(newFrameworks.sort());
      
      if (!frameworksChanged) {
        console.log(`  ⏭️  Skipped: No changes needed`);
        variationsSkipped++;
        continue;
      }

      // Update variation in Firestore
      const variationRef = db.collection('variations').doc(variation.id);
      batch.update(variationRef, {
        frameworks: newFrameworks
      });
      operationCount++;

      console.log(`  ✓ Updated`);
      console.log(`    Old frameworks: [${currentFrameworks.join(', ')}]`);
      console.log(`    New frameworks: [${newFrameworks.join(', ')}]`);
      variationsUpdated++;

      // Commit batch if needed
      const batchResult = await commitBatchIfNeeded(batch, operationCount);
      batch = batchResult.newBatch;
      if (batchResult.resetCounter) {
        operationCount = 0;
      }
    }

    // Commit remaining batch
    if (operationCount > 0) {
      await batch.commit();
      console.log(`\n  ✓ Committed final batch (${operationCount} operations)`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Variations processed: ${variationsProcessed}`);
    console.log(`Variations updated: ${variationsUpdated}`);
    console.log(`Variations skipped: ${variationsSkipped}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error updating Animal Flow frameworks:', error);
    throw error;
  }
}

// Run the migration
updateAnimalFlowFrameworks()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

