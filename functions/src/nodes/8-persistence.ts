/**
 * Nodo 8: Persistence Protocol (DETERMINÍSTICO)
 * 
 * Protocolo de Persistencia Atómica que se ejecuta al concluir el grafo.
 * Transforma el estado temporal en memoria a largo plazo en Firebase.
 * 
 * Dos operaciones:
 * 
 * A. Archivo del Training System:
 *    - Crear documento en users/{uid}/sessions/sessions_week_{timestamp}
 *    - Guardar weeklyPlan y finalSessions (historial inmutable)
 * 
 * B. Actualización del Estado del Usuario (FIFO Rolling Window):
 *    - Actualizar users/{uid}/blackListedVariationIds
 *    - Sobrescribir con sessionUsedIds completo (ya contiene el 50% filtrado de cada sesión)
 *    - Esto crea un ciclo rotativo: Semana A bloquea Semana B, Semana B bloquea Semana C pero libera Semana A
 */

import { TrainingGraphState } from "../types/schemas";
import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../utils/admin-init";

export async function persistenceNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  // 1. Inicializar Firebase Admin
  initializeFirebaseAdmin();
  const db = admin.firestore();

  const { userProfile, weeklyPlan, finalSessions, sessionUsedIds } = state;

  // 2. Validaciones de entrada
  if (!userProfile || !userProfile.uid) {
    throw new Error("[Persistence] userProfile o uid no está definido");
  }

  if (!weeklyPlan) {
    throw new Error("[Persistence] weeklyPlan no está definido");
  }

  if (!finalSessions || finalSessions.length === 0) {
    throw new Error("[Persistence] finalSessions no está definido o está vacío");
  }

  // sessionUsedIds puede ser array vacío (primera ejecución), pero debe existir
  const idsToPersist = sessionUsedIds || [];

  const uid = userProfile.uid;

  try {
    // 3. Operación A: Crear documento de sesiones semanales
    const timestamp = Date.now();
    const sessionsDocId = `sessions_week_${timestamp}`;
    const sessionsRef = db.collection("users").doc(uid).collection("sessions").doc(sessionsDocId);

    await sessionsRef.set({
      weeklyPlan,
      finalSessions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      weekTimestamp: timestamp,
    });

    console.log(
      `[Persistence] Documento de sesiones creado: ${sessionsDocId} ` +
      `con ${finalSessions.length} sesiones para usuario ${uid}`
    );

    // 4. Operación B: Actualizar blackListedVariationIds del usuario
    // sessionUsedIds ya contiene el 50% de cada sesión (filtrado en nodo 7)
    // No aplicar filtro adicional, usar directamente
    const userRef = db.collection("users").doc(uid);

    await userRef.update({
      blackListedVariationIds: idsToPersist,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[Persistence] blackListedVariationIds actualizado con ${idsToPersist.length} IDs ` +
      `para usuario ${uid}`
    );

    // 5. Retornar objeto vacío (no modifica el estado del grafo)
    return {};
  } catch (error) {
    // 6. Manejo de errores
    console.error("[Persistence] Error al persistir datos:", error);
    throw new Error(
      `Error en persistencia: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

