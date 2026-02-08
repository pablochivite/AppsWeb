import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module __dirname emulation
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Check if we're using the emulator
const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR_HOST;

if (isEmulator) {
  // Use emulator - no service account needed
  console.log('🌐 Detected Firestore emulator, using emulator mode...');
  console.log(`   FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST || 'not set'}`);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-regain'
    });
  }
} else {
  // Use production - need service account
  const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(
      '❌ serviceAccountKey.json not found at project root.'
    );
    console.error('   For emulator: Set FIRESTORE_EMULATOR_HOST=localhost:8080');
    console.error('   For production: Place your Firebase service account key at project root.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8')
  );

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  
  console.log('🌐 Using production Firestore...');
}

const db = admin.firestore();

/**
 * Simple CLI arg parser: --userId=abc --days=365 --sessionsPerWeek=4
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    userId: null,
    days: 365,
    sessionsPerWeek: 4
  };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      config.userId = arg.split('=')[1];
    } else if (arg.startsWith('--days=')) {
      config.days = parseInt(arg.split('=')[1], 10) || config.days;
    } else if (arg.startsWith('--sessionsPerWeek=')) {
      config.sessionsPerWeek = parseInt(arg.split('=')[1], 10) || config.sessionsPerWeek;
    }
  }

  if (!config.userId) {
    console.error('Usage: node scripts/seed-user-history.js --userId=YOUR_UID [--days=365] [--sessionsPerWeek=4]');
    process.exit(1);
  }

  return config;
}

/**
 * Pick one existing completed session for the user as a template.
 * This ensures we respect the current training system structure (phases / blocks / exercises).
 */
async function getTemplateSession(userId) {
  const sessionsRef = db.collection('users').doc(userId).collection('completedSessions');
  const snap = await sessionsRef.orderBy('date', 'desc').limit(1).get();

  if (snap.empty) {
    throw new Error(
      'No completedSessions found for this user. Complete at least one real session before seeding.'
    );
  }

  const doc = snap.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Track progression state for each exercise/variation
 * This ensures coherent progression over time
 */
const progressionState = new Map(); // key: `${exerciseId}-${variationId}`, value: progression data

/**
 * Calculate realistic progression for an exercise based on:
 * - Time since first performance (weeks)
 * - Previous performance
 * - Training phase (progression, plateau, deload)
 */
function calculateProgression(exerciseKey, weeksSinceStart, previousWeight, previousReps, baseWeight, baseReps) {
  if (!progressionState.has(exerciseKey)) {
    // Initialize progression state
    progressionState.set(exerciseKey, {
      baseWeight: baseWeight || 0,
      baseReps: baseReps || 0,
      currentWeight: baseWeight || 0,
      currentReps: baseReps || 0,
      weeksSinceStart: 0,
      phase: 'progression', // progression, plateau, deload
      phaseWeeks: 0
    });
  }

  const state = progressionState.get(exerciseKey);
  state.weeksSinceStart = weeksSinceStart;
  
  // Update phase based on time
  if (state.phaseWeeks >= 4 && state.phase === 'progression') {
    // After 4 weeks of progression, enter plateau
    state.phase = 'plateau';
    state.phaseWeeks = 0;
  } else if (state.phaseWeeks >= 2 && state.phase === 'plateau') {
    // After 2 weeks plateau, deload
    state.phase = 'deload';
    state.phaseWeeks = 0;
  } else if (state.phaseWeeks >= 1 && state.phase === 'deload') {
    // After 1 week deload, back to progression
    state.phase = 'progression';
    state.phaseWeeks = 0;
  }

  state.phaseWeeks++;

  // Calculate new weight and reps based on phase
  let newWeight = previousWeight || state.currentWeight || baseWeight || 0;
  let newReps = previousReps || state.currentReps || baseReps || 0;

  if (state.phase === 'progression') {
    // Progressive overload: gradual increase
    // +2.5kg every 4 weeks, +1 rep every 2 weeks
    const weeksDiv4 = Math.floor(weeksSinceStart / 4);
    const weightIncrease = weeksSinceStart > 0 ? Math.max(0, weeksDiv4 * 2.5) : 0;
    const repsIncrease = weeksSinceStart > 0 && weeksSinceStart % 2 === 0 ? 1 : 0;
    
    // Apply progression with realistic variation
    newWeight = Math.max(0, Math.round((baseWeight || 0) + weightIncrease + (Math.random() * 2.5 - 1.25)));
    newReps = Math.max(1, Math.round((baseReps || 0) + repsIncrease + (Math.random() * 2 - 1)));
  } else if (state.phase === 'plateau') {
    // Plateau: maintain with slight variation
    newWeight = Math.max(0, Math.round(previousWeight + (Math.random() * 2.5 - 1.25)));
    newReps = Math.max(1, Math.round(previousReps + (Math.random() * 2 - 1)));
  } else if (state.phase === 'deload') {
    // Deload: reduce by 10-15%
    newWeight = Math.max(0, Math.round(previousWeight * (0.85 + Math.random() * 0.1)));
    newReps = Math.max(1, Math.round(previousReps * (0.9 + Math.random() * 0.1)));
  }

  state.currentWeight = newWeight;
  state.currentReps = newReps;

  return { weight: newWeight, reps: newReps };
}

/**
 * For a given template session and target date, create:
 * - completedSessions entry for that date
 * - exerciseHistory entries (append a new session for each exercise/variation)
 * - (Optionally) a basic sessionReport document
 */
async function createSyntheticSession(userId, template, targetDateIso, index, totalSessions, startDate) {
  const sessionsRef = db.collection('users').doc(userId).collection('completedSessions');

  // 1) Create / upsert completedSession for this date
  const base = { ...template };

  // Normalize fields that must change
  base.date = targetDateIso;

  // Calculate weeks since start for progression
  const sessionDate = new Date(targetDateIso + 'T18:00:00Z');
  const weeksSinceStart = Math.floor((sessionDate - startDate) / (7 * 24 * 60 * 60 * 1000));

  // Slightly vary duration (±10 %)
  if (typeof base.duration === 'number') {
    const factor = 0.9 + Math.random() * 0.2;
    base.duration = Math.round(base.duration * factor);
  }

  // Update timestamps
  const baseDate = new Date(targetDateIso + 'T18:00:00Z');
  base.startedAt = baseDate.toISOString();
  base.completedAt = new Date(baseDate.getTime() + (base.duration || 1800) * 1000).toISOString();

  // Ensure warmup/workoutPhase/cooldown structures exist
  base.warmup = base.warmup || { blocks: [], duration: 0 };
  base.workoutPhase = base.workoutPhase || base.workout || { blocks: [], duration: 0 };
  base.cooldown = base.cooldown || { blocks: [], duration: 0 };

  // Drop Firestore server timestamps / ids from template
  delete base.createdAt;
  delete base.updatedAt;

  // Write completedSession
  const newSessionRef = sessionsRef.doc(); // new id
  await newSessionRef.set(base, { merge: false });
  const sessionId = newSessionRef.id;

  // 2) Update exerciseHistory for each block's sets
  const historyRef = db.collection('users').doc(userId).collection('exerciseHistory');

  const allBlocks = [
    ...(base.warmup?.blocks || []),
    ...(base.workoutPhase?.blocks || []),
    ...(base.cooldown?.blocks || [])
  ];

  for (const block of allBlocks) {
    if (!block || !block.exerciseId || !Array.isArray(block.sets) || block.sets.length === 0) {
      continue;
    }

    const exerciseId = block.exerciseId;
    const variationId = block.variationId || block.variation_id || null;
    if (!variationId) continue;

    const exerciseKey = `${exerciseId}-${variationId}`;

    // Get previous performance from history
    const q = await historyRef
      .where('exerciseId', '==', exerciseId)
      .where('variationId', '==', variationId)
      .limit(1)
      .get();

    let previousWeight = 0;
    let previousReps = 0;
    let baseWeight = 0;
    let baseReps = 0;

    // Extract base values from template
    if (block.sets && block.sets.length > 0) {
      const firstSet = block.sets[0];
      baseWeight = typeof firstSet.weight === 'number' ? firstSet.weight : 0;
      baseReps = typeof firstSet.reps === 'number' ? firstSet.reps : 0;
    }

    // Get previous performance if history exists
    if (!q.empty) {
      const existingDoc = q.docs[0];
      const data = existingDoc.data();
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        const lastSets = Array.isArray(lastSession.sets) ? lastSession.sets : [];
        if (lastSets.length > 0) {
          const lastSet = lastSets[lastSets.length - 1];
          previousWeight = typeof lastSet.weight === 'number' ? lastSet.weight : baseWeight;
          previousReps = typeof lastSet.reps === 'number' ? lastSet.reps : baseReps;
        }
      }
    }

    // Calculate realistic progression
    const progression = calculateProgression(
      exerciseKey,
      weeksSinceStart,
      previousWeight,
      previousReps,
      baseWeight,
      baseReps
    );

    // Generate synthetic sets with progression
    const numSets = block.sets.length;
    const syntheticSets = [];
    
    for (let i = 0; i < numSets; i++) {
      // Slight variation between sets (last set might be slightly lower)
      const setWeight = i === numSets - 1 
        ? Math.max(0, Math.round(progression.weight * (0.95 + Math.random() * 0.05))) // Last set slightly lower
        : Math.max(0, Math.round(progression.weight * (0.98 + Math.random() * 0.02))); // First sets consistent
      
      const setReps = Math.max(1, Math.round(progression.reps * (0.95 + Math.random() * 0.1))); // ±5% variation
      
      syntheticSets.push({
        setNumber: i + 1,
        weight: setWeight,
        reps: setReps,
        completed: true,
        ...(block.sets[i]?.time && { time: block.sets[i].time }),
        ...(block.sets[i]?.notes && { notes: block.sets[i].notes })
      });
    }

    // Update block with new sets
    block.sets = syntheticSets;

    const ts = admin.firestore.Timestamp.fromDate(baseDate);

    if (q.empty) {
      const docRef = historyRef.doc();
      await docRef.set({
        exerciseId,
        variationId,
        sessions: [
          {
            sessionId,
            date: ts,
            sets: syntheticSets
          }
        ],
        lastPerformedAt: ts,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const existingDoc = q.docs[0];
      const data = existingDoc.data();
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      sessions.push({
        sessionId,
        date: ts,
        sets: syntheticSets
      });

      await existingDoc.ref.update({
        sessions,
        lastPerformedAt: ts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  // Update the session document with the modified blocks (with progression)
  await newSessionRef.update({
    warmup: base.warmup,
    workoutPhase: base.workoutPhase,
    cooldown: base.cooldown
  });

  // 3) (Optional) Lightweight session report stub
  const reportsRef = db.collection('users').doc(userId).collection('sessionReports');
  await reportsRef.add({
    userId,
    sessionId,
    sessionDate: targetDateIso,
    macroStats: {
      totalVolume: 0,
      totalReps: 0
    },
    exerciseSummaries: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`  ✓ Created synthetic session #${index + 1} for ${targetDateIso} (id: ${sessionId})`);
}

async function main() {
  try {
    const { userId, days, sessionsPerWeek } = parseArgs();

    console.log('🌱 Seeding user history with realistic progression');
    console.log(`   userId=${userId}, days=${days}, sessionsPerWeek=${sessionsPerWeek}`);
    
    if (isEmulator) {
      console.log('   ✓ Using Firestore emulator');
    } else {
      console.log('   ⚠️  Using production Firestore (ensure you have proper permissions)');
    }

    const template = await getTemplateSession(userId);
    console.log(`   Using template session ${template.date || template.id} as baseline structure`);

    const today = new Date();
    const totalSessionsTarget = Math.round((days / 7) * sessionsPerWeek);
    
    // Calculate start date (days ago)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    console.log(`   Generating ${totalSessionsTarget} sessions with realistic progression...`);
    console.log(`   Start date: ${startDate.toISOString().split('T')[0]}`);
    console.log(`   End date: ${today.toISOString().split('T')[0]}\n`);

    // Clear progression state
    progressionState.clear();

    let created = 0;
    const trainingDays = [1, 3, 5, 6]; // Mon, Wed, Fri, Sat (adjust based on sessionsPerWeek)
    
    for (let i = 1; i <= days && created < totalSessionsTarget; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);

      // Distribute sessions across training days
      const dayOfWeek = d.getDay(); // 0=Sun .. 6=Sat
      const isTrainingDay = trainingDays.includes(dayOfWeek);
      if (!isTrainingDay) continue;

      const isoDate = d.toISOString().split('T')[0];
      await createSyntheticSession(userId, template, isoDate, created, totalSessionsTarget, startDate);
      created++;
      
      // Progress indicator
      if (created % 10 === 0) {
        console.log(`   Progress: ${created}/${totalSessionsTarget} sessions created...`);
      }
    }

    console.log(`\n✅ Seeding completed. Created ${created} synthetic sessions.`);
    console.log(`   Each exercise now has ${created} historical data points with realistic progression.`);
    console.log(`   Progression includes: gradual weight increases, rep progressions, plateaus, and deloads.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding user history:', err);
    process.exit(1);
  }
}

main();


