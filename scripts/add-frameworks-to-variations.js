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

// Constants
const BATCH_SIZE = 400; // Commit every 400 operations to stay well under the 500 limit
const DATA_DIR = path.join(__dirname, 'data');

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
 * Load frameworks from data files
 */
function loadFrameworksFromDataFiles() {
  const frameworkMap = new Map();
  
  // Read all JSON files in data directory
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Process exercises
    if (data.exercises && Array.isArray(data.exercises)) {
      for (const exercise of data.exercises) {
        if (exercise.frameworks && Array.isArray(exercise.frameworks) && exercise.frameworks.length > 0) {
          // Use name as key (case-insensitive)
          const key = exercise.name.toLowerCase();
          frameworkMap.set(key, exercise.frameworks);
        }
      }
    }
  }
  
  return frameworkMap;
}

/**
 * Main function to add frameworks to exercises and variations
 */
async function addFrameworksToVariations() {
  try {
    console.log('\n📊 Loading frameworks from data files...\n');
    
    // Load frameworks from data files
    const frameworkMap = loadFrameworksFromDataFiles();
    console.log(`✓ Loaded frameworks for ${frameworkMap.size} exercises from data files\n`);

    console.log('📊 Fetching exercises and variations from Firestore...\n');

    // Get all exercises
    const exercisesSnapshot = await db.collection('exercises').get();
    const exercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✓ Found ${exercises.length} exercises`);

    // Get all variations
    const variationsSnapshot = await db.collection('variations').get();
    const variations = variationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✓ Found ${variations.length} variations\n`);

    // Statistics
    let exercisesUpdated = 0;
    let exercisesSkipped = 0;
    let variationsUpdated = 0;
    let variationsSkipped = 0;

    console.log('🔄 Processing exercises and updating variations...\n');

    let batch = db.batch();
    let operationCount = 0;

    // First, update exercises with frameworks from data files
    for (const exercise of exercises) {
      const exerciseName = (exercise.name || '').toLowerCase();
      const frameworks = frameworkMap.get(exerciseName) || exercise.frameworks || [];
      
      if (frameworks.length === 0) {
        exercisesSkipped++;
        continue;
      }

      // Check if exercise already has the same frameworks
      const existingFrameworks = exercise.frameworks || [];
      const frameworksMatch = 
        existingFrameworks.length === frameworks.length &&
        frameworks.every(f => existingFrameworks.includes(f));

      if (!frameworksMatch) {
        // Update exercise with frameworks
        const exerciseRef = db.collection('exercises').doc(exercise.id);
        batch.update(exerciseRef, { frameworks: frameworks });
        operationCount++;
        exercisesUpdated++;
        console.log(`  ✓ Exercise "${exercise.name || exercise.id}" -> frameworks: [${frameworks.join(', ')}]`);

        // Check if we need to commit and start a new batch
        const result = await commitBatchIfNeeded(batch, operationCount);
        batch = result.newBatch;
        if (result.resetCounter) {
          operationCount = 0;
        }
      }
    }

    // Commit exercises batch
    if (operationCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed exercises batch (${operationCount} operations)\n`);
      batch = db.batch();
      operationCount = 0;
    }

    // Now update variations with their exercise frameworks
    // Create a map of exerciseId -> exercise for quick lookup
    const exerciseMap = new Map();
    exercises.forEach(exercise => {
      const exerciseName = (exercise.name || '').toLowerCase();
      const frameworks = frameworkMap.get(exerciseName) || exercise.frameworks || [];
      exerciseMap.set(exercise.id, { ...exercise, frameworks });
    });

    // Group variations by exerciseId
    const variationsByExercise = new Map();
    variations.forEach(variation => {
      const exerciseId = variation.exerciseId;
      if (exerciseId) {
        if (!variationsByExercise.has(exerciseId)) {
          variationsByExercise.set(exerciseId, []);
        }
        variationsByExercise.get(exerciseId).push(variation);
      }
    });

    // Process each exercise and update its variations
    for (const exercise of exercises) {
      const exerciseData = exerciseMap.get(exercise.id);
      if (!exerciseData) continue;

      const frameworks = exerciseData.frameworks || [];
      if (frameworks.length === 0) {
        continue; // Skip exercises without frameworks
      }

      const exerciseVariations = variationsByExercise.get(exercise.id) || [];
      
      // Update each variation with the exercise's frameworks
      for (const variation of exerciseVariations) {
        // Check if variation already has the same frameworks
        const variationFrameworks = variation.frameworks || [];
        const frameworksMatch = 
          variationFrameworks.length === frameworks.length &&
          frameworks.every(f => variationFrameworks.includes(f));

        if (frameworksMatch) {
          variationsSkipped++;
          continue; // Skip if frameworks already match
        }

        // Update variation with exercise frameworks
        const variationRef = db.collection('variations').doc(variation.id);
        batch.update(variationRef, { frameworks: frameworks });
        operationCount++;
        variationsUpdated++;

        // Check if we need to commit and start a new batch
        const result = await commitBatchIfNeeded(batch, operationCount);
        batch = result.newBatch;
        if (result.resetCounter) {
          operationCount = 0;
        }
      }
    }

    // Commit remaining batch
    if (operationCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final variations batch (${operationCount} operations)`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total exercises: ${exercises.length}`);
    console.log(`  - Updated with frameworks: ${exercisesUpdated}`);
    console.log(`  - Skipped (no frameworks found): ${exercisesSkipped}`);
    console.log(`Total variations: ${variations.length}`);
    console.log(`  - Updated: ${variationsUpdated}`);
    console.log(`  - Skipped (already had frameworks): ${variationsSkipped}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Process completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
addFrameworksToVariations()
  .then(() => {
    console.log('✨ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
