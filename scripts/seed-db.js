import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root (one level up from scripts/)
const projectRoot = path.resolve(__dirname, '..');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Constants
const BATCH_SIZE = 400; // Commit every 400 operations to stay well under the 500 limit
const DATA_DIR = path.join(__dirname, 'data');

// Statistics tracking
let totalExercisesUploaded = 0;
let totalVariationsUploaded = 0;
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
 * Upload exercises and variations from a single JSON file
 */
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processing ${fileName}...`);

  // Read and parse JSON file
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(fileContent);

  if (!data.exercises || !Array.isArray(data.exercises)) {
    console.log(`  ⚠️  Warning: No exercises array found in ${fileName}`);
  }
  if (!data.variations || !Array.isArray(data.variations)) {
    console.log(`  ⚠️  Warning: No variations array found in ${fileName}`);
  }

  let batch = db.batch();
  let operationCount = 0;

  // Upload exercises
  const exercises = data.exercises || [];
  for (const exercise of exercises) {
    if (!exercise.id) {
      console.log(`  ⚠️  Warning: Exercise missing ID, skipping:`, exercise);
      continue;
    }

    const exerciseRef = db.collection('exercises').doc(exercise.id);
    batch.set(exerciseRef, exercise, { merge: false });
    operationCount++;
    totalExercisesUploaded++;

    // Check if we need to commit and start a new batch
    const result = await commitBatchIfNeeded(batch, operationCount);
    batch = result.newBatch;
    if (result.resetCounter) {
      operationCount = 0;
    }
  }

  // Upload variations
  const variations = data.variations || [];
  for (const variation of variations) {
    if (!variation.id) {
      console.log(`  ⚠️  Warning: Variation missing ID, skipping:`, variation);
      continue;
    }

    const variationRef = db.collection('variations').doc(variation.id);
    batch.set(variationRef, variation, { merge: false });
    operationCount++;
    totalVariationsUploaded++;

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
    console.log(`  ✓ Committed final batch (${operationCount} operations)`);
  }

  console.log(
    `  ✓ Completed ${fileName}: ${exercises.length} exercises, ${variations.length} variations`
  );
  filesProcessed++;
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  console.log(`📂 Reading files from: ${DATA_DIR}\n`);

  try {
    // Read all JSON files from the data directory
    const files = fs.readdirSync(DATA_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('❌ No JSON files found in scripts/data/ directory');
      process.exit(1);
    }

    console.log(`Found ${jsonFiles.length} JSON file(s):\n`);

    // Process each file sequentially
    for (const file of jsonFiles) {
      const filePath = path.join(DATA_DIR, file);
      await processFile(filePath);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ Seeding completed successfully!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   • Files processed: ${filesProcessed}`);
    console.log(`   • Total exercises uploaded: ${totalExercisesUploaded}`);
    console.log(`   • Total variations uploaded: ${totalVariationsUploaded}`);
    console.log(
      `   • Total documents uploaded: ${totalExercisesUploaded + totalVariationsUploaded}`
    );
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding script
seedDatabase();

