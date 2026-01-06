/**
 * Data Migration Utility
 * 
 * Migrates data from localStorage to Firestore when a user first signs in.
 * This ensures existing users don't lose their data when migrating to Firebase.
 */

import { 
    saveUserProfile, 
    saveTrainingSystem, 
    getUserProfile 
} from '../services/dbService.js';
import { 
    getUserProfile as getLocalUserProfile,
    getTrainingSystem as getLocalTrainingSystem,
    getOnboardingData,
    getUserRole
} from './storage.js';

/**
 * Migrate all localStorage data to Firestore for a user
 * @param {string} userId - Firebase user ID
 * @returns {Promise<void>}
 */
export async function migrateLocalStorageToFirestore(userId) {
    try {
        console.log('Starting data migration for user:', userId);
        
        // Check if user already has data in Firestore
        const existingProfile = await getUserProfile(userId);
        if (existingProfile) {
            console.log('User already has Firestore data, skipping migration');
            return;
        }
        
        // Migrate user profile
        await migrateUserProfile(userId);
        
        // Migrate training system
        await migrateTrainingSystem(userId);
        
        console.log('Data migration completed successfully');
    } catch (error) {
        console.error('Error during data migration:', error);
        // Don't throw - migration failure shouldn't block user
    }
}

/**
 * Migrate user profile from localStorage to Firestore
 * @param {string} userId - Firebase user ID
 */
async function migrateUserProfile(userId) {
    try {
        const localProfile = await getLocalUserProfile();
        const onboardingData = getOnboardingData();
        const { getUserRole } = await import('./storage.js');
        const userRole = await getUserRole();
        
        if (!localProfile && !onboardingData && !userRole) {
            console.log('No local profile data to migrate');
            return;
        }
        
        // Merge all profile data
        const profileData = {
            role: userRole || null,
            preferredDisciplines: localProfile?.preferredDisciplines || onboardingData?.primaryDiscipline || [],
            discomforts: localProfile?.discomforts || onboardingData?.discomforts || [],
            equipment: localProfile?.equipment || [],
            goals: localProfile?.goals || [],
            currentMilestones: localProfile?.currentMilestones || {},
            sedentaryImpact: onboardingData?.sedentaryImpact || null
        };
        
        // Save to Firestore
        await saveUserProfile(userId, profileData);
        console.log('User profile migrated successfully');
    } catch (error) {
        console.error('Error migrating user profile:', error);
        throw error;
    }
}

/**
 * Migrate training system from localStorage to Firestore
 * @param {string} userId - Firebase user ID
 */
async function migrateTrainingSystem(userId) {
    try {
        const localSystem = await getLocalTrainingSystem();
        
        if (!localSystem) {
            console.log('No training system to migrate');
            return;
        }
        
        // Save training system to Firestore
        await saveTrainingSystem(userId, localSystem);
        console.log('Training system migrated successfully');
    } catch (error) {
        console.error('Error migrating training system:', error);
        throw error;
    }
}

/**
 * Check if migration is needed
 * @param {string} userId - Firebase user ID
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function needsMigration(userId) {
    try {
        const hasFirestoreData = await getUserProfile(userId);
        const localProfile = await getLocalUserProfile();
        const localSystem = await getLocalTrainingSystem();
        const hasLocalData = localProfile || localSystem;
        
        return !hasFirestoreData && hasLocalData;
    } catch (error) {
        console.error('Error checking migration status:', error);
        return false;
    }
}

