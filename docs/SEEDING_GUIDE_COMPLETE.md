# Guía Completa de Seeding de Datos para Testing

Esta guía te ayudará a llenar tu usuario con datos de entrenamiento simulando 1 año de entrenamiento bajo el mismo sistema de entrenamiento.

## Prerrequisitos

1. **Emulador de Firebase corriendo**
   - Ejecuta: `.\scripts\start-emulators-with-key.ps1`
   - Asegúrate de que el emulador esté activo en `http://localhost:4000`

2. **Al menos una sesión completada**
   - Debes haber completado al menos una sesión real en la app
   - Esta sesión se usará como template para generar las sesiones históricas

3. **Tu User ID**
   - Inicia sesión en la app
   - Abre la consola del navegador (F12)
   - Ejecuta: 
     ```javascript
     import { auth } from './config/firebase.config.js';
     console.log('Tu User ID:', auth.currentUser?.uid);
     ```
   - Copia el User ID

## Pasos para el Seeding

### Opción 1: Usando el script PowerShell (Recomendado)

```powershell
.\scripts\seed-user-history.ps1 -userId "TU_UID_AQUI" -days 365 -sessionsPerWeek 4
```

Este script:
- Configura automáticamente las variables de entorno del emulador
- Verifica que el emulador esté corriendo
- Ejecuta el seeding con los parámetros especificados

### Opción 2: Usando Node.js directamente

```powershell
# Configurar variables de entorno
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FUNCTIONS_EMULATOR_HOST = "localhost:5001"

# Ejecutar seeding
node scripts/seed-user-history.js --userId=TU_UID --days=365 --sessionsPerWeek=4
```

## Parámetros

- `--userId` (requerido): Tu User ID de Firebase Auth
- `--days` (opcional, default: 365): Número de días hacia atrás para generar sesiones
- `--sessionsPerWeek` (opcional, default: 4): Número de sesiones por semana

## Qué se genera

El script genera:

1. **Sesiones completadas** (`completedSessions`)
   - ~208 sesiones (4 por semana × 52 semanas)
   - Cada sesión incluye:
     - Fecha, duración, disciplina, workout
     - Fases: warmup, workoutPhase, cooldown
     - Bloques con ejercicios y sets completados

2. **Historial de ejercicios** (`exerciseHistory`)
   - Un documento por cada combinación ejercicio/variación
   - Cada documento contiene:
     - Array de `sessions[]` con fecha y sets realizados
     - Progresión realista de peso y reps a lo largo del tiempo
     - Incluye: progresión, plateaus, y deloads

3. **Reportes de sesión** (`sessionReports`)
   - Un reporte básico por cada sesión completada
   - Puede ser enriquecido por LangGraph después

## Progresión Realista

El script implementa una progresión coherente:

- **Progresión**: Aumentos graduales de peso (+2.5kg cada 4 semanas) y reps (+1 cada 2 semanas)
- **Plateaus**: Períodos de mantenimiento con variación ligera
- **Deloads**: Reducciones del 10-15% para recuperación

## Verificar los datos

Después del seeding, puedes verificar los datos:

```powershell
node scripts/check-emulator-data.js
```

O visita el UI del emulador en `http://localhost:4000` y navega a Firestore.

## Probar el informe LangGraph

Una vez que tengas los datos:

1. Completa una nueva sesión en la app
2. Al finalizar, el sistema automáticamente:
   - Guardará la sesión
   - Generará un reporte de sesión
   - Llamará a LangGraph para análisis

3. El informe LangGraph incluirá:
   - Análisis de progresión histórica
   - Comparación con sesiones anteriores
   - Insights sobre fuerza, movilidad, rotación, estabilidad
   - Recomendaciones personalizadas

## Solución de problemas

### Error: "No completedSessions found"
- **Solución**: Completa al menos una sesión real antes de ejecutar el seeding

### Error: "OpenAI API key not configured"
- **Solución**: Asegúrate de ejecutar `start-emulators-with-key.ps1` antes del seeding

### Error: "Cannot connect to emulator"
- **Solución**: Verifica que el emulador esté corriendo en `http://localhost:4000`

### Datos no aparecen en la app
- **Solución**: 
  1. Verifica que estés usando el emulador (no producción)
  2. Limpia el cache del navegador
  3. Recarga la app

## Estructura de datos generada

```
users/
  {userId}/
    completedSessions/
      {sessionId1}/
        - date, duration, discipline, workout
        - warmup: { blocks: [...] }
        - workoutPhase: { blocks: [...] }
        - cooldown: { blocks: [...] }
      {sessionId2}/
      ...
    
    exerciseHistory/
      {historyId1}/
        - exerciseId, variationId
        - sessions: [
            { sessionId, date, sets: [{ weight, reps, ... }] },
            ...
          ]
      {historyId2}/
      ...
    
    sessionReports/
      {reportId1}/
        - sessionId, sessionDate
        - macroStats, exerciseSummaries
      {reportId2}/
      ...
```

## Notas importantes

- Los datos se generan hacia atrás desde hoy
- Las fechas se distribuyen según `sessionsPerWeek` (días de entrenamiento)
- La progresión es coherente: cada ejercicio mantiene su historial
- Los datos son realistas pero sintéticos (no son datos reales de entrenamiento)

