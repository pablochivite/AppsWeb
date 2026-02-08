import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const DATA_DIR = path.join(__dirname, 'data');

// Statistics tracking
let totalExercisesFixed = 0;
let filesProcessed = 0;
const fixedExercises = [];

/**
 * Check if an exercise has tag bloating
 * @param {Object} exercise - Exercise object
 * @returns {boolean} True if exercise has tag bloating
 */
function hasTagBloating(exercise) {
  const frameworks = exercise.frameworks || [];
  
  if (frameworks.length === 0) {
    return false;
  }
  
  const frameworksLower = frameworks.map(f => f.toLowerCase());
  const hasFullBody = frameworksLower.includes('full body');
  
  // Criterion 1: 5+ frameworks
  if (frameworks.length >= 5) {
    return true;
  }
  
  // Criterion 2: Conflicting frameworks (Push + Pull + Legs simultaneously)
  const hasPush = frameworksLower.includes('push');
  const hasPull = frameworksLower.includes('pull');
  const hasLegs = frameworksLower.includes('legs');
  
  if (hasPush && hasPull && hasLegs) {
    return true;
  }
  
  // Criterion 3: Full Body + 3+ other specific frameworks
  // Specific frameworks are: Push, Pull, Legs, Core, Back, Chest, Upper Body, Lower Body
  const specificFrameworks = ['push', 'pull', 'legs', 'core', 'back', 'chest', 'upper body', 'lower body'];
  const specificCount = frameworksLower.filter(f => specificFrameworks.includes(f)).length;
  
  if (hasFullBody && specificCount >= 3) {
    return true;
  }
  
  return false;
}

/**
 * Process a single JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Object} Statistics about the file processing
 */
function processFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processing ${fileName}...`);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    if (!data.exercises || !Array.isArray(data.exercises)) {
      console.log(`  ⚠️  Warning: No exercises array found in ${fileName}`);
      return { fixed: 0, total: 0 };
    }
    
    let fixedInFile = 0;
    const exercises = data.exercises;
    
    // Process each exercise
    for (const exercise of exercises) {
      if (hasTagBloating(exercise)) {
        const oldFrameworks = [...(exercise.frameworks || [])];
        exercise.frameworks = ['Full Body'];
        fixedInFile++;
        totalExercisesFixed++;
        
        fixedExercises.push({
          file: fileName,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          oldFrameworks: oldFrameworks,
          newFrameworks: ['Full Body']
        });
        
        console.log(`  ✓ Fixed: "${exercise.name || exercise.id}"`);
        console.log(`    Old: [${oldFrameworks.join(', ')}]`);
        console.log(`    New: [Full Body]`);
      }
    }
    
    // Write updated data back to file
    if (fixedInFile > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  ✅ Updated ${fileName} with ${fixedInFile} fixes`);
    } else {
      console.log(`  ✓ No tag bloating found in ${fileName}`);
    }
    
    return { fixed: fixedInFile, total: exercises.length };
    
  } catch (error) {
    console.error(`  ❌ Error processing ${fileName}:`, error.message);
    return { fixed: 0, total: 0 };
  }
}

/**
 * Main function to fix tag bloating
 */
function fixTagBloating() {
  console.log('🔧 Starting tag bloating fix...\n');
  console.log('='.repeat(60));
  console.log('Tag Bloating Criteria:');
  console.log('  1. Exercises with 5+ frameworks');
  console.log('  2. Exercises with Push + Pull + Legs simultaneously');
  console.log('  3. Exercises with Full Body + 3+ other specific frameworks');
  console.log('='.repeat(60) + '\n');
  
  // Read all JSON files from data directory
  const files = fs.readdirSync(DATA_DIR);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log('❌ No JSON files found in scripts/data/ directory');
    process.exit(1);
  }
  
  console.log(`Found ${jsonFiles.length} JSON file(s):\n`);
  
  const fileStats = [];
  
  // Process each file
  for (const file of jsonFiles) {
    const filePath = path.join(DATA_DIR, file);
    const stats = processFile(filePath);
    fileStats.push({ file, ...stats });
    filesProcessed++;
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('✨ Tag bloating fix completed!');
  console.log('='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   • Files processed: ${filesProcessed}`);
  console.log(`   • Total exercises fixed: ${totalExercisesFixed}`);
  console.log('\n📋 File-by-file breakdown:');
  
  for (const stat of fileStats) {
    console.log(`   • ${stat.file}: ${stat.fixed} fixed out of ${stat.total} exercises`);
  }
  
  if (fixedExercises.length > 0) {
    console.log('\n📝 Detailed changes:');
    for (const fix of fixedExercises) {
      console.log(`\n   Exercise: ${fix.exerciseName} (${fix.exerciseId})`);
      console.log(`   File: ${fix.file}`);
      console.log(`   Old frameworks: [${fix.oldFrameworks.join(', ')}]`);
      console.log(`   New frameworks: [${fix.newFrameworks.join(', ')}]`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All JSON files have been updated.');
  console.log('💡 Next step: Run scripts/sync-frameworks-from-json.js to sync changes to Firebase');
  console.log('='.repeat(60) + '\n');
  
  process.exit(0);
}

// Run the fix
fixTagBloating();

