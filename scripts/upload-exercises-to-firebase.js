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
const SCRIPTS_DATA_DIR = path.join(__dirname, 'data');

// Statistics tracking
let exercisesLoaded = 0;
let variationsLoaded = 0;
let exercisesUploaded = 0;
let variationsUploaded = 0;
let exercisesDeleted = 0;
let variationsDeleted = 0;

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
 * Load exercises and variations from scripts/data/*.json files
 * These files have separate exercises and variations arrays
 */
function loadFromScriptsDataFiles() {
  const exercises = new Map(); // exerciseId -> exercise data
  const variations = []; // Array of all variations with exerciseId
  
  console.log(`📂 Reading JSON files from: ${SCRIPTS_DATA_DIR}`);
  
  if (!fs.existsSync(SCRIPTS_DATA_DIR)) {
    console.log(`  ⚠️  Directory not found, skipping`);
    return { exercises, variations };
  }
  
  const files = fs.readdirSync(SCRIPTS_DATA_DIR);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log(`  ⚠️  No JSON files found`);
    return { exercises, variations };
  }
  
  console.log(`  Found ${jsonFiles.length} JSON file(s)\n`);
  
  for (const file of jsonFiles) {
    const filePath = path.join(SCRIPTS_DATA_DIR, file);
    console.log(`  📄 Processing ${file}...`);
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Process exercises
      if (data.exercises && Array.isArray(data.exercises)) {
        for (const exercise of data.exercises) {
          if (!exercise.id) {
            console.log(`    ⚠️  Exercise missing ID, skipping`);
            continue;
          }
          
          // Merge with existing exercise if it exists, otherwise add new
          if (exercises.has(exercise.id)) {
            // Merge data, keeping existing but updating with new fields
            const existing = exercises.get(exercise.id);
            exercises.set(exercise.id, { ...existing, ...exercise });
          } else {
            exercises.set(exercise.id, exercise);
            exercisesLoaded++;
          }
        }
      }
      
      // Process variations
      if (data.variations && Array.isArray(data.variations)) {
        for (const variation of data.variations) {
          if (!variation.id) {
            console.log(`    ⚠️  Variation missing ID, skipping`);
            continue;
          }
          
          if (!variation.exerciseId) {
            console.log(`    ⚠️  Variation ${variation.id} missing exerciseId, skipping`);
            continue;
          }
          
          variations.push(variation);
          variationsLoaded++;
        }
      }
      
      console.log(`    ✓ Processed ${file}`);
    } catch (error) {
      console.error(`    ❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n  ✓ Loaded ${exercises.size} exercises and ${variations.length} variations from scripts/data/\n`);
  
  return { exercises, variations };
}

/**
 * Delete all existing exercises and variations from Firebase
 */
async function deleteExistingData() {
  console.log('🗑️  Step 1: Deleting existing exercises and variations from Firebase...\n');
  
  let batch = db.batch();
  let operationCount = 0;
  
  // Get all exercises
  const exercisesSnapshot = await db.collection('ejercicios').get();
  console.log(`  Found ${exercisesSnapshot.size} existing exercises`);
  
  // Delete all variations first (subcollections)
  for (const exerciseDoc of exercisesSnapshot.docs) {
    const variationsSnapshot = await exerciseDoc.ref.collection('variaciones').get();
    
    for (const variationDoc of variationsSnapshot.docs) {
      batch.delete(variationDoc.ref);
      operationCount++;
      variationsDeleted++;
      
      const result = await commitBatchIfNeeded(batch, operationCount);
      batch = result.newBatch;
      if (result.resetCounter) {
        operationCount = 0;
      }
    }
    
    // Delete the exercise document
    batch.delete(exerciseDoc.ref);
    operationCount++;
    exercisesDeleted++;
    
    const result = await commitBatchIfNeeded(batch, operationCount);
    batch = result.newBatch;
    if (result.resetCounter) {
      operationCount = 0;
    }
  }
  
  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
    console.log(`  ✓ Committed final delete batch (${operationCount} operations)\n`);
  }
  
  console.log(`  ✓ Deleted ${exercisesDeleted} exercises and ${variationsDeleted} variations\n`);
}

/**
 * Upload exercises to Firebase
 */
async function uploadExercises(exercisesMap) {
  console.log('📤 Step 2: Uploading exercises to Firebase...\n');
  
  let batch = db.batch();
  let operationCount = 0;
  
  for (const [exerciseId, exerciseData] of exercisesMap) {
    const exerciseRef = db.collection('ejercicios').doc(exerciseId);
    
    // Prepare exercise document (ensure id is included)
    const exerciseDoc = {
      id: exerciseId,
      ...exerciseData
    };
    
    batch.set(exerciseRef, exerciseDoc, { merge: false }); // Overwrite completely
    operationCount++;
    exercisesUploaded++;
    
    console.log(`  ✓ Exercise: ${exerciseData.name || exerciseId}`);
    
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
  
  console.log(`  ✓ Uploaded ${exercisesUploaded} exercises\n`);
}

/**
 * Upload variations to Firebase (as subcollections)
 */
async function uploadVariations(variationsArray) {
  console.log('📤 Step 3: Uploading variations to Firebase...\n');
  
  // Group variations by exerciseId
  const variationsByExercise = new Map();
  for (const variation of variationsArray) {
    const exerciseId = variation.exerciseId;
    if (!variationsByExercise.has(exerciseId)) {
      variationsByExercise.set(exerciseId, []);
    }
    variationsByExercise.get(exerciseId).push(variation);
  }
  
  console.log(`  Grouped ${variationsArray.length} variations into ${variationsByExercise.size} exercises\n`);
  
  let batch = db.batch();
  let operationCount = 0;
  
  for (const [exerciseId, variations] of variationsByExercise) {
    const exerciseRef = db.collection('ejercicios').doc(exerciseId);
    
    // Check if exercise exists
    const exerciseDoc = await exerciseRef.get();
    if (!exerciseDoc.exists) {
      console.log(`  ⚠️  Exercise ${exerciseId} does not exist, skipping ${variations.length} variations`);
      continue;
    }
    
    for (const variation of variations) {
      const variationRef = exerciseRef.collection('variaciones').doc(variation.id);
      
      // Prepare variation document (ensure id and exerciseId are included)
      const variationDoc = {
        id: variation.id,
        exerciseId: exerciseId,
        ...variation
      };
      
      batch.set(variationRef, variationDoc, { merge: false }); // Overwrite completely
      operationCount++;
      variationsUploaded++;
      
      const result = await commitBatchIfNeeded(batch, operationCount);
      batch = result.newBatch;
      if (result.resetCounter) {
        operationCount = 0;
      }
    }
    
    console.log(`  ✓ Exercise ${exerciseId}: ${variations.length} variations`);
  }
  
  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
    console.log(`  ✓ Committed final variations batch (${operationCount} operations)\n`);
  }
  
  console.log(`  ✓ Uploaded ${variationsUploaded} variations\n`);
}

/**
 * Main upload function
 */
async function uploadExercisesToFirebase() {
  console.log('🚀 Starting upload of exercises and variations to Firebase...\n');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Step 1: Load all exercises and variations from JSON files
    console.log('📖 Loading exercises and variations from JSON files...\n');
    
    const scriptsData = loadFromScriptsDataFiles();
    
    // Use exercises and variations from scripts/data
    const allExercises = scriptsData.exercises;
    const allVariations = scriptsData.variations;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary of loaded data:');
    console.log(`   • Total exercises: ${allExercises.size}`);
    console.log(`   • Total variations: ${allVariations.length}`);
    console.log('='.repeat(60) + '\n');
    
    if (allExercises.size === 0) {
      console.log('❌ No exercises found in JSON files. Exiting.');
      process.exit(1);
    }
    
    // Step 2: Delete existing data
    await deleteExistingData();
    
    // Step 3: Upload exercises
    await uploadExercises(allExercises);
    
    // Step 4: Upload variations
    await uploadVariations(allVariations);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ Upload completed successfully!');
    console.log('='.repeat(60));
    console.log(`📊 Final Summary:`);
    console.log(`   • Exercises loaded: ${exercisesLoaded}`);
    console.log(`   • Variations loaded: ${variationsLoaded}`);
    console.log(`   • Exercises deleted: ${exercisesDeleted}`);
    console.log(`   • Variations deleted: ${variationsDeleted}`);
    console.log(`   • Exercises uploaded: ${exercisesUploaded}`);
    console.log(`   • Variations uploaded: ${variationsUploaded}`);
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during upload:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the upload script
uploadExercisesToFirebase();
