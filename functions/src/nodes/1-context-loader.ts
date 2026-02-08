/**
 * Nodo 1: Context Loader (DETERMINÍSTICO)
 * 
 * Carga los datos desde Firebase:
 * - userProfile completo
 * - availableVariations completo
 * - initialBlacklist (blackListedVariationIds del usuario)
 */

import { TrainingGraphState } from "../types/schemas";
import {
  getUserProfileFromFirebase,
  getAllVariationsFromFirebase,
  getBlacklistedVariationIds,
} from "../services/firebase";

export async function contextLoaderNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  // 1. Obtener uid del estado
  // El uid puede venir como parámetro inicial o del userProfile.uid
  const uid = state.userProfile?.uid || (state as any).uid;
  
  if (!uid || typeof uid !== "string") {
    throw new Error(
      "[Context Loader] uid no está definido en el estado. " +
      "Debe proporcionarse como parámetro inicial o en userProfile.uid"
    );
  }

  try {
    // 2. Cargar datos desde Firebase en paralelo para mejor rendimiento
    const [userProfile, availableVariations, initialBlacklist] = await Promise.all([
      getUserProfileFromFirebase(uid),
      getAllVariationsFromFirebase(),
      getBlacklistedVariationIds(uid),
    ]);

    // 3. Logging informativo
    console.log(
      `[Context Loader] Datos cargados para usuario ${uid}:\n` +
      `  - UserProfile: ${userProfile ? "✓" : "✗"}\n` +
      `  - Variaciones: ${availableVariations.length}\n` +
      `  - IDs en blacklist: ${initialBlacklist.length}`
    );

    // 4. Retornar estado actualizado
    return {
      userProfile: userProfile as any, // Mantener todos los campos completos
      availableVariations: availableVariations,
      initialBlacklist: initialBlacklist,
    };
  } catch (error) {
    // 5. Manejo de errores
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Context Loader] Error al cargar datos: ${errorMessage}`);
    throw new Error(`[Context Loader] Error al cargar datos desde Firebase: ${errorMessage}`);
  }
}

