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
const TARGET_WORKFLOW = 'Push';

// Statistics tracking
let variationsUpdated = 0;
let variationsSkipped = 0;

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
 * Main function to update Animal Flow variation workflows
 */
async function updateAnimalFlowWorkflows() {
  try {
    console.log('\n📊 Starting Animal Flow workflow update...\n');
    console.log(`Target: Set workflow to "${TARGET_WORKFLOW}" for ${ANIMAL_FLOW_DISCIPLINE} variations\n`);

    // Get all variations and filter by Animal Flow exerciseId
    console.log('📊 Fetching all variations from Firestore...\n');
    const variationsSnapshot = await db.collection('variations').get();
    
    // Filter variations that belong to Animal Flow exercises
    // Animal Flow exercises typically have IDs starting with "animal-flow-" or similar
    const animalFlowVariations = [];
    variationsSnapshot.docs.forEach(doc => {
      const variation = { id: doc.id, ...doc.data() };
      const exerciseId = variation.exerciseId || '';
      
      // Check if exerciseId starts with animal-flow patterns
      if (exerciseId.toLowerCase().includes('animal-flow') || 
          exerciseId.toLowerCase().includes('animalflow') ||
          exerciseId.toLowerCase().startsWith('beast') ||
          exerciseId.toLowerCase().startsWith('crab') ||
          exerciseId.toLowerCase().startsWith('ape')) {
        animalFlowVariations.push(variation);
      }
    });

    console.log(`✓ Found ${variationsSnapshot.size} total variation(s)`);
    console.log(`✓ Found ${animalFlowVariations.length} Animal Flow variation(s)\n`);

    if (animalFlowVariations.length === 0) {
      console.log(`❌ No Animal Flow variations found`);
      console.log('💡 Tip: Variations might be identified by exerciseId patterns. Check the exerciseId field in variations.');
      return;
    }

    // Process each Animal Flow variation
    let batch = db.batch();
    let operationCount = 0;

    for (const variation of animalFlowVariations) {
      const currentWorkflow = variation.workflow;

      // Check if workflow already is "Push"
      if (currentWorkflow === TARGET_WORKFLOW) {
        console.log(`  ⏭️  Skipped: ${variation.name || variation.id} (already has workflow "${TARGET_WORKFLOW}")`);
        variationsSkipped++;
        continue;
      }

      // Update variation in Firestore
      const variationRef = db.collection('variations').doc(variation.id);
      batch.update(variationRef, {
        workflow: TARGET_WORKFLOW
      });
      operationCount++;

      console.log(`  ✓ Updated: ${variation.name || variation.id}`);
      console.log(`    ExerciseId: ${variation.exerciseId || '(none)'}`);
      console.log(`    Old workflow: ${currentWorkflow || '(none)'}`);
      console.log(`    New workflow: ${TARGET_WORKFLOW}`);
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
    console.log(`Total Animal Flow variations found: ${animalFlowVariations.length}`);
    console.log(`Variations updated: ${variationsUpdated}`);
    console.log(`Variations skipped: ${variationsSkipped}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error updating Animal Flow workflows:', error);
    throw error;
  }
}

// Run the migration
updateAnimalFlowWorkflows()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

