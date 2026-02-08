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

// Framework to Muscle Group Mappings
const FRAMEWORK_MUSCLE_MAPPINGS = {
  Push: {
    primary: ['chest', 'shoulders', 'triceps'],
    secondary: ['front delts', 'upper chest', 'pectorals', 'pecs']
  },
  Pull: {
    primary: ['back', 'biceps', 'rear delts'],
    secondary: ['lats', 'rhomboids', 'traps', 'latissimus', 'posterior delts']
  },
  Legs: {
    primary: ['quads', 'glutes', 'hamstrings', 'calves'],
    secondary: ['hip flexors', 'adductors', 'quadriceps', 'gluteus', 'gastrocnemius']
  },
  Upper: {
    primary: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    secondary: ['traps', 'rear delts', 'front delts', 'arms']
  },
  Lower: {
    primary: ['quads', 'glutes', 'hamstrings', 'calves'],
    secondary: ['hip flexors', 'adductors', 'abductors']
  },
  Core: {
    primary: ['abs', 'core', 'obliques'],
    secondary: ['lower back', 'hip flexors', 'abdominals', 'rectus abdominis']
  },
  'Full Body': {
    primary: ['chest', 'back', 'shoulders', 'quads', 'glutes', 'hamstrings', 'core'],
    secondary: ['biceps', 'triceps', 'calves', 'abs']
  }
};

/**
 * Infers frameworks from target muscles of an exercise or variation
 * @param {Object} targetMuscles - Object with primary and secondary muscle arrays
 * @returns {string[]} Array of inferred framework names
 */
function inferFrameworksFromMuscles(targetMuscles) {
  if (!targetMuscles) {
    return [];
  }

  const primaryMuscles = (targetMuscles.primary || []).map((m) => m.toLowerCase().trim());
  const secondaryMuscles = (targetMuscles.secondary || []).map((m) => m.toLowerCase().trim());
  const allMuscles = [...primaryMuscles, ...secondaryMuscles];

  if (allMuscles.length === 0) {
    return [];
  }

  const inferredFrameworks = [];
  const frameworkScores = {};

  // Score each framework based on muscle matches
  for (const [framework, mapping] of Object.entries(FRAMEWORK_MUSCLE_MAPPINGS)) {
    let score = 0;

    // Check primary muscle matches (higher weight)
    for (const muscle of primaryMuscles) {
      if (mapping.primary.some((fm) => muscle.includes(fm) || fm.includes(muscle))) {
        score += 3; // Primary matches are worth more
      } else if (mapping.secondary.some((fm) => muscle.includes(fm) || fm.includes(muscle))) {
        score += 1;
      }
    }

    // Check secondary muscle matches (lower weight)
    for (const muscle of secondaryMuscles) {
      if (mapping.primary.some((fm) => muscle.includes(fm) || fm.includes(muscle))) {
        score += 2;
      } else if (mapping.secondary.some((fm) => muscle.includes(fm) || fm.includes(muscle))) {
        score += 0.5;
      }
    }

    if (score > 0) {
      frameworkScores[framework] = score;
    }
  }

  // Determine which frameworks to include
  const maxScore = Math.max(...Object.values(frameworkScores), 0);
  const threshold = maxScore > 0 ? Math.max(1.5, maxScore * 0.3) : 0;

  for (const [framework, score] of Object.entries(frameworkScores)) {
    if (score >= threshold) {
      // Special handling for composite frameworks
      if (framework === 'Full Body') {
        // Only include Full Body if it's clearly a full body exercise
        if (score >= maxScore * 0.7) {
          inferredFrameworks.push(framework);
        }
      } else if (framework === 'Upper' || framework === 'Lower') {
        // Prefer specific frameworks (Push/Pull/Legs) over Upper/Lower when possible
        const hasSpecific = inferredFrameworks.some((f) => 
          ['Push', 'Pull', 'Legs'].includes(f)
        );
        if (!hasSpecific || score >= maxScore * 0.6) {
          inferredFrameworks.push(framework);
        }
      } else {
        inferredFrameworks.push(framework);
      }
    }
  }

  // Remove duplicates and sort by score (highest first)
  const uniqueFrameworks = Array.from(new Set(inferredFrameworks));
  uniqueFrameworks.sort((a, b) => (frameworkScores[b] || 0) - (frameworkScores[a] || 0));

  // Ensure at least one framework is returned if we have muscles
  if (uniqueFrameworks.length === 0 && allMuscles.length > 0) {
    // Fallback: assign based on most common muscle type
    const hasUpper = allMuscles.some(m => 
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'arms'].some(u => m.includes(u))
    );
    const hasLower = allMuscles.some(m => 
      ['quads', 'glutes', 'hamstrings', 'calves', 'legs'].some(l => m.includes(l))
    );
    const hasCore = allMuscles.some(m => 
      ['abs', 'core', 'obliques', 'abdominals'].some(c => m.includes(c))
    );

    if (hasUpper && hasLower) {
      uniqueFrameworks.push('Full Body');
    } else if (hasUpper) {
      uniqueFrameworks.push('Upper');
    } else if (hasLower) {
      uniqueFrameworks.push('Lower');
    } else if (hasCore) {
      uniqueFrameworks.push('Core');
    } else {
      uniqueFrameworks.push('Full Body'); // Default fallback
    }
  }

  return uniqueFrameworks;
}

/**
 * Gets frameworks for an exercise, inferring from variations if not present
 * @param {Object} exercise - Exercise object
 * @param {Array} variations - Array of variations for this exercise
 * @returns {string[]} Array of framework names
 */
function getExerciseFrameworks(exercise, variations) {
  // If exercise already has frameworks, use them
  if (exercise.frameworks && Array.isArray(exercise.frameworks) && exercise.frameworks.length > 0) {
    return exercise.frameworks;
  }

  // Otherwise, infer from variations' target muscles
  if (!variations || variations.length === 0) {
    return [];
  }

  // Collect all inferred frameworks from all variations
  const allInferredFrameworks = [];

  for (const variation of variations) {
    const targetMuscles = variation.target_muscles || {};
    const inferred = inferFrameworksFromMuscles(targetMuscles);
    allInferredFrameworks.push(...inferred);
  }

  // Return unique frameworks, most common first
  const frameworkCounts = {};
  for (const framework of allInferredFrameworks) {
    frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
  }

  const uniqueFrameworks = Object.keys(frameworkCounts);
  uniqueFrameworks.sort((a, b) => frameworkCounts[b] - frameworkCounts[a]);

  return uniqueFrameworks;
}

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
 * Main function to add frameworks manually to exercises and variations
 */
async function addFrameworksManually() {
  try {
    console.log('\n📊 Fetching exercises and variations from Firestore...\n');

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

    console.log(`✓ Grouped variations into ${variationsByExercise.size} exercises\n`);

    // Statistics
    let exercisesUpdated = 0;
    let exercisesSkipped = 0;
    let exercisesNoVariations = 0;
    let variationsUpdated = 0;
    let variationsSkipped = 0;
    let variationsNoExercise = 0;

    console.log('🔄 Step 1: Adding frameworks to exercises...\n');

    let batch = db.batch();
    let operationCount = 0;

    // Create a map to store exercise frameworks for later use
    const exerciseFrameworksMap = new Map();

    // First, infer and update frameworks for exercises
    for (const exercise of exercises) {
      const exerciseVariations = variationsByExercise.get(exercise.id) || [];
      
      if (exerciseVariations.length === 0) {
        exercisesNoVariations++;
        console.log(`  ⚠️  Exercise "${exercise.name || exercise.id}" has no variations, skipping`);
        continue;
      }

      // Infer frameworks from variations
      const inferredFrameworks = getExerciseFrameworks(exercise, exerciseVariations);
      
      if (inferredFrameworks.length === 0) {
        exercisesSkipped++;
        console.log(`  ⚠️  Exercise "${exercise.name || exercise.id}" - could not infer frameworks`);
        continue;
      }

      // Always update exercise with frameworks (even if it already has some, we'll overwrite)
      const exerciseRef = db.collection('exercises').doc(exercise.id);
      batch.update(exerciseRef, { frameworks: inferredFrameworks });
      operationCount++;
      exercisesUpdated++;
      exerciseFrameworksMap.set(exercise.id, inferredFrameworks);
      console.log(`  ✓ Exercise "${exercise.name || exercise.id}" -> frameworks: [${inferredFrameworks.join(', ')}]`);

      // Check if we need to commit and start a new batch
      const result = await commitBatchIfNeeded(batch, operationCount);
      batch = result.newBatch;
      if (result.resetCounter) {
        operationCount = 0;
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
    console.log('🔄 Step 2: Adding frameworks to variations from their parent exercises...\n');

    for (const variation of variations) {
      const exerciseId = variation.exerciseId;
      
      if (!exerciseId) {
        variationsNoExercise++;
        continue;
      }

      const exerciseFrameworks = exerciseFrameworksMap.get(exerciseId);
      
      if (!exerciseFrameworks || exerciseFrameworks.length === 0) {
        // Try to get frameworks from the exercise directly (in case it wasn't updated in this run)
        const exercise = exercises.find(e => e.id === exerciseId);
        if (exercise && exercise.frameworks && exercise.frameworks.length > 0) {
          exerciseFrameworksMap.set(exerciseId, exercise.frameworks);
        } else {
          continue; // Skip variations without exercise frameworks
        }
      }

      const frameworks = exerciseFrameworksMap.get(exerciseId) || [];

      // Always update variation with exercise frameworks (overwrite existing)
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
    console.log(`  - Skipped (no variations): ${exercisesNoVariations}`);
    console.log(`Total variations: ${variations.length}`);
    console.log(`  - Updated with exercise frameworks: ${variationsUpdated}`);
    console.log(`  - Skipped (no exerciseId): ${variationsNoExercise}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Process completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
addFrameworksManually()
  .then(() => {
    console.log('✨ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

