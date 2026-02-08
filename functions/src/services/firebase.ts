/**
 * Firebase Service
 * 
 * This service handles all Firebase-related operations for the training graph.
 * Provides methods to load user profiles, exercise variations, and blacklists.
 */

import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../utils/admin-init";

/**
 * Obtiene el perfil completo del usuario desde Firebase
 * @param uid User ID
 * @returns User profile object with all fields from Firebase
 */
export async function getUserProfileFromFirebase(uid: string): Promise<any> {
  initializeFirebaseAdmin();
  const db = admin.firestore();
  
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`[Firebase Service] Usuario ${uid} no encontrado`);
  }
  
  return { uid, ...userDoc.data() };
}

/**
 * Obtiene todas las variaciones desde Firebase
 * Las variaciones están en subcolecciones: ejercicios/{exerciseId}/variaciones/{variationId}
 * @returns Array of all variation objects
 */
export async function getAllVariationsFromFirebase(): Promise<any[]> {
  initializeFirebaseAdmin();
  const db = admin.firestore();
  
  // 1. Obtener todos los ejercicios
  const exercisesRef = db.collection("ejercicios");
  const exercisesSnapshot = await exercisesRef.get();
  
  if (exercisesSnapshot.empty) {
    console.warn("[Firebase Service] No se encontraron ejercicios");
    return [];
  }
  
  // 2. Para cada ejercicio, obtener sus variaciones
  const variationPromises = exercisesSnapshot.docs.map(async (exerciseDoc) => {
    const variationsRef = exerciseDoc.ref.collection("variaciones");
    const variationsSnapshot = await variationsRef.get();
    
    // Mapear cada variación con su ID
    return variationsSnapshot.docs.map((variationDoc) => ({
      id: variationDoc.id,
      ...variationDoc.data()
    }));
  });
  
  // 3. Combinar todas las variaciones en un solo array
  const variationArrays = await Promise.all(variationPromises);
  const flattened = variationArrays.flat();
  
  console.log(
    `[Firebase Service] Cargadas ${flattened.length} variaciones ` +
    `de ${exercisesSnapshot.size} ejercicios`
  );
  
  return flattened;
}

/**
 * Obtiene la blacklist de variaciones del usuario
 * @param uid User ID
 * @returns Array of variation IDs that should be blacklisted
 */
export async function getBlacklistedVariationIds(uid: string): Promise<string[]> {
  initializeFirebaseAdmin();
  const db = admin.firestore();
  
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    return []; // Primera ejecución, no hay blacklist
  }
  
  const data = userDoc.data();
  return data?.blackListedVariationIds || [];
}
