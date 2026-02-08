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

// Statistics tracking
let exercisesUpdated = 0;
let exercisesSkipped = 0;
let exercisesNotFound = 0;
let variationsUpdated = 0;
let variationsSkipped = 0;
let variationsNotFound = 0;
let filesProcessed = 0;

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
 * Load all exercises and their frameworks from JSON files
 * @returns {Map<string, string[]>} Map of exerciseId -> frameworks array
 */
function loadFrameworksFromJSON() {
  const exerciseFrameworksMap = new Map();
  
  console.log(`📂 Reading JSON files from: ${DATA_DIR}\n`);
  
  // Read all JSON files from the data directory
  const files = fs.readdirSync(DATA_DIR);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log('❌ No JSON files found in scripts/data/ directory');
    return exerciseFrameworksMap;
  }
  
  console.log(`Found ${jsonFiles.length} JSON file(s):\n`);
  
  // Process each file
  for (const file of jsonFiles) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`📄 Processing ${file}...`);
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Process exercises
      const exercises = data.exercises || [];
      let exercisesInFile = 0;
      
      for (const exercise of exercises) {
        if (!exercise.id) {
          console.log(`  ⚠️  Warning: Exercise missing ID, skipping`);
          continue;
        }
        
        if (exercise.frameworks && Array.isArray(exercise.frameworks) && exercise.frameworks.length > 0) {
          exerciseFrameworksMap.set(exercise.id, exercise.frameworks);
          exercisesInFile++;
        } else {
          console.log(`  ⚠️  Exercise "${exercise.name || exercise.id}" has no frameworks, skipping`);
        }
      }
      
      console.log(`  ✓ Loaded ${exercisesInFile} exercises with frameworks from ${file}`);
      filesProcessed++;
      
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n✓ Total exercises with frameworks loaded: ${exerciseFrameworksMap.size}\n`);
  
  return exerciseFrameworksMap;
}

/**
 * Update exercises in Firebase with frameworks from JSON
 */
async function updateExercises(exerciseFrameworksMap) {
  console.log('🔄 Step 1: Updating exercises with frameworks...\n');
  
  let batch = db.batch();
  let operationCount = 0;
  
  // Get all exercises from Firebase
  const exercisesSnapshot = await db.collection('exercises').get();
  const exercises = exercisesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Found ${exercises.length} exercises in Firebase\n`);
  
  // Update each exercise that has frameworks in the JSON
  for (const exercise of exercises) {
    const frameworks = exerciseFrameworksMap.get(exercise.id);
    
    if (!frameworks) {
      exercisesNotFound++;
      continue;
    }
    
    // Check if frameworks are already the same (avoid unnecessary updates)
    const currentFrameworks = exercise.frameworks;
    if (currentFrameworks && 
        Array.isArray(currentFrameworks) && 
        currentFrameworks.length === frameworks.length &&
        currentFrameworks.every(f => frameworks.includes(f))) {
      exercisesSkipped++;
      continue;
    }
    
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
  
  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
    console.log(`  ✓ Committed final exercises batch (${operationCount} operations)\n`);
  }
}

/**
 * Update variations in Firebase with frameworks from their parent exercises
 */
async function updateVariations(exerciseFrameworksMap) {
  console.log('🔄 Step 2: Updating variations with frameworks from parent exercises...\n');
  
  let batch = db.batch();
  let operationCount = 0;
  
  // Get all variations from Firebase
  const variationsSnapshot = await db.collection('variations').get();
  const variations = variationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Found ${variations.length} variations in Firebase\n`);
  
  // Update each variation with frameworks from its parent exercise
  for (const variation of variations) {
    const exerciseId = variation.exerciseId;
    
    if (!exerciseId) {
      variationsSkipped++;
      continue;
    }
    
    const frameworks = exerciseFrameworksMap.get(exerciseId);
    
    if (!frameworks) {
      variationsNotFound++;
      continue;
    }
    
    // Check if frameworks are already the same (avoid unnecessary updates)
    const currentFrameworks = variation.frameworks;
    if (currentFrameworks && 
        Array.isArray(currentFrameworks) && 
        currentFrameworks.length === frameworks.length &&
        currentFrameworks.every(f => frameworks.includes(f))) {
      variationsSkipped++;
      continue;
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
  
  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
    console.log(`  ✓ Committed final variations batch (${operationCount} operations)\n`);
  }
}

/**
 * Main synchronization function
 */
async function syncFrameworks() {
  console.log('🔄 Starting framework synchronization from JSON files...\n');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Step 1: Load frameworks from JSON files
    const exerciseFrameworksMap = loadFrameworksFromJSON();
    
    if (exerciseFrameworksMap.size === 0) {
      console.log('❌ No frameworks found in JSON files. Exiting.');
      process.exit(1);
    }
    
    // Step 2: Update exercises in Firebase
    await updateExercises(exerciseFrameworksMap);
    
    // Step 3: Update variations in Firebase
    await updateVariations(exerciseFrameworksMap);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ Framework synchronization completed!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   • JSON files processed: ${filesProcessed}`);
    console.log(`   • Exercises:`);
    console.log(`     - Updated: ${exercisesUpdated}`);
    console.log(`     - Skipped (already up to date): ${exercisesSkipped}`);
    console.log(`     - Not found in JSON: ${exercisesNotFound}`);
    console.log(`   • Variations:`);
    console.log(`     - Updated: ${variationsUpdated}`);
    console.log(`     - Skipped (already up to date): ${variationsSkipped}`);
    console.log(`     - Not found (no exerciseId or exercise not in JSON): ${variationsNotFound}`);
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during synchronization:', error);
    process.exit(1);
  }
}

// Run the synchronization script
syncFrameworks();

