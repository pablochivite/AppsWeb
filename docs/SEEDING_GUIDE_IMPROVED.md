# Guía Mejorada: Seeding de Datos para Testing de LangGraph

Esta guía te ayudará a llenar tu usuario con **1 año de historial de entrenamiento coherente** con progresión realista para probar el sistema de análisis de LangGraph.

## 🎯 Objetivo

Generar datos de entrenamiento que:
- ✅ Simulen 1 año de entrenamiento bajo el mismo training system
- ✅ Incluyan progresión realista de peso, sets y reps
- ✅ Muestren fases de entrenamiento (progresión, mesetas, deloads)
- ✅ Sean coherentes y fiables para análisis de LangGraph
- ✅ Permitan generar informes de sesión detallados

---

## 📋 Prerrequisitos

1. ✅ **Firebase Emulators** configurados y corriendo
2. ✅ **OpenAI API Key** configurada
3. ✅ **App de desarrollo** corriendo (`npm run dev`)
4. ✅ **Al menos una sesión completada** en el emulador (como plantilla)

---

## 🚀 Paso 1: Configurar y Iniciar Emuladores con API Key

### Opción A: Usar el Script Mejorado (Recomendado)

```powershell
.\scripts\start-emulators-with-key.ps1
```

Este script:
- ✅ Verifica/configura la API key de OpenAI
- ✅ Compila las funciones TypeScript si es necesario
- ✅ Configura las variables de entorno correctamente
- ✅ Inicia los emuladores con la configuración adecuada

### Opción B: Configuración Manual

```powershell
# 1. Configurar API key
$env:OPENAI_API_KEY="sk-tu-api-key-aqui"

# 2. Configurar emuladores
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
$env:FUNCTIONS_EMULATOR_HOST="localhost:5001"

# 3. Compilar funciones (si es necesario)
cd functions
npm run build
cd ..

# 4. Iniciar emuladores
npm run emulators:all
```

**⚠️ Importante**: La API key debe estar configurada **antes** de iniciar los emuladores para que las funciones de Firebase puedan acceder a ella.

---

## 📝 Paso 2: Verificar Estado del Emulador

Ejecuta el script de verificación:

```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run check:emulator
```

Este script te mostrará:
- ✅ Si hay usuarios en el emulador
- ✅ Si hay sesiones completadas
- ✅ Tu UID para usar en el seeding
- ✅ El comando exacto para ejecutar el seeding

**Ejemplo de salida:**
```
✅ Found 1 user(s) in the emulator:

👤 User ID: abc123xyz
   Email: tu@email.com
   Display Name: Tu Nombre
   Role: athlete
   ✅ Found 1 recent session(s):
      1. 2025-01-15 - 45 min
   📊 Total completed sessions: 1
   📈 Exercise history entries: 5

🎯 Ready for seeding! Use this command:
   npm run seed:user-history -- --userId=abc123xyz --days=365 --sessionsPerWeek=4
```

---

## 🎮 Paso 3: Crear Datos Iniciales (si no existen)

Si el script muestra "No users found" o "No completed sessions":

### 3.1. Abrir la App

Abre `http://localhost:3000` (o el puerto que use tu servidor de desarrollo).

### 3.2. Autenticarte

- **Opción A**: Crear una cuenta nueva (email/password o Google)
- **Opción B**: Si ya tienes cuenta, inicia sesión

### 3.3. Completar el Onboarding (si es nuevo usuario)

Si es un usuario nuevo, completa el flujo de onboarding:
- Responde las preguntas de perfil
- Completa el baseline assessment
- Genera tu primer sistema de entrenamiento semanal

### 3.4. Completar al Menos UNA Sesión Completa

**⚠️ Esto es crítico**: El script de seeding usa tu última sesión completada como **plantilla** para generar todas las sesiones sintéticas.

1. Ve a tu calendario/sistema de entrenamiento
2. Selecciona una sesión
3. **Completa toda la sesión**:
   - Realiza el warmup
   - Completa todos los ejercicios del workout
   - **Registra peso, reps, sets para cada ejercicio** (importante para la progresión)
   - Completa el cooldown
4. Guarda/finaliza la sesión

### 3.5. Verificar que la Sesión se Guardó

Ejecuta de nuevo el script de verificación:

```powershell
npm run check:emulator
```

Deberías ver:
- ✅ Tu UID
- ✅ Al menos 1 sesión completada
- ✅ El comando exacto para ejecutar el seeding

---

## 🌱 Paso 4: Ejecutar el Seeding Mejorado

Una vez que tengas al menos una sesión completada, ejecuta:

```powershell
# Configurar variable de entorno para el emulador
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"

# Ejecutar seeding (reemplaza TU_UID con tu UID real)
npm run seed:user-history -- --userId=TU_UID --days=365 --sessionsPerWeek=4
```

**Parámetros:**
- `--userId=TU_UID`: Tu UID de Firebase (lo obtienes del script `check:emulator`)
- `--days=365`: Genera datos para 1 año hacia atrás
- `--sessionsPerWeek=4`: Distribuye sesiones en 4 días por semana (Lunes, Miércoles, Viernes, Sábado)

**Ejemplo:**
```powershell
npm run seed:user-history -- --userId=abc123xyz --days=365 --sessionsPerWeek=4
```

### ¿Qué hace el script mejorado?

1. **Toma tu última sesión completada** como plantilla
2. **Genera ~200 sesiones** distribuidas a lo largo de 1 año
3. **Crea progresión realista**:
   - **Peso**: Aumento gradual (+2.5kg cada 4 semanas) con variaciones realistas
   - **Reps**: Aumento gradual (+1 rep cada 2 semanas) con variaciones
   - **Fases de entrenamiento**:
     - **Progresión** (4 semanas): Aumento gradual de peso y reps
     - **Meseta** (2 semanas): Mantenimiento con variaciones ligeras
     - **Deload** (1 semana): Reducción del 10-15% para recuperación
   - **Duración**: ±10% de variación
4. **Actualiza `exerciseHistory`** con el historial completo de cada ejercicio
5. **Crea `sessionReports`** básicos (que LangGraph puede enriquecer después)

**Progreso del script:**
```
🌱 Seeding user history with realistic progression
   userId=abc123xyz, days=365, sessionsPerWeek=4
   Using template session 2025-01-15 as baseline structure
   Generating 208 sessions with realistic progression...
   Start date: 2024-01-15
   End date: 2025-01-15

   Progress: 10/208 sessions created...
   Progress: 20/208 sessions created...
   ...
   ✓ Created synthetic session #208 for 2024-01-15 (id: xyz789)

✅ Seeding completed. Created 208 synthetic sessions.
   Each exercise now has 208 historical data points with realistic progression.
   Progression includes: gradual weight increases, rep progressions, plateaus, and deloads.
```

---

## ✅ Paso 5: Verificar los Datos Generados

### 5.1. En el Emulator UI

Abre `http://localhost:4000` → Firestore → Data

Deberías ver:
- `users/{TU_UID}/completedSessions` → ~200 documentos
- `users/{TU_UID}/exerciseHistory` → Múltiples documentos (uno por ejercicio/variación)
- `users/{TU_UID}/sessionReports` → ~200 documentos

**Verificar progresión:**
1. Selecciona un documento de `exerciseHistory`
2. Revisa el array `sessions`
3. Deberías ver progresión gradual de peso y reps a lo largo del tiempo

### 5.2. Con el Script de Verificación

```powershell
npm run check:emulator
```

Deberías ver:
- ✅ Total de sesiones completadas: ~200
- ✅ Exercise history entries: Múltiples (uno por ejercicio/variación)

---

## 🧪 Paso 6: Probar el Análisis de LangGraph

Ahora que tienes 1 año de datos con progresión realista:

### 6.1. Completa una Nueva Sesión (Real)

1. **Completa una nueva sesión** (la última, real)
2. **Registra peso, reps, sets** para cada ejercicio
3. **Finaliza la sesión**

### 6.2. Solicita un Informe

Desde la app o vía el chat de análisis, solicita un informe:

**Query de Ejemplo:**
```
"Genera un informe técnico detallado de mi última sesión, 
analizando la relación entre fuerza y movilidad, rotación y estabilidad. 
Incluye comparativas con sesiones anteriores y tendencias de progresión."
```

### 6.3. Verificar el Informe Generado

El informe debería incluir:
- ✅ Análisis de progresión a lo largo del año
- ✅ Comparativas con sesiones anteriores
- ✅ Tendencias de peso, reps, volumen
- ✅ Insights sobre fases de entrenamiento
- ✅ Recomendaciones basadas en el historial

---

## 🔧 Troubleshooting

### Error: "No completedSessions found for this user"

**Solución**: Necesitas completar al menos una sesión real primero. El script no puede generar datos sin una plantilla.

### Error: "serviceAccountKey.json not found"

**Solución**: Coloca tu archivo `serviceAccountKey.json` en la raíz del proyecto (`C:\Dev\AppsWeb\`).

### Error: "Could not connect to Firestore emulator"

**Solución**: 
1. Verifica que los emuladores estén corriendo: `npm run emulators:all`
2. Asegúrate de que `FIRESTORE_EMULATOR_HOST=localhost:8080` esté configurado
3. Verifica que el emulador esté escuchando en el puerto 8080

### Error: "OpenAI API key not configured"

**Solución**: 
1. Asegúrate de que `OPENAI_API_KEY` esté configurada **antes** de iniciar los emuladores
2. Usa el script `start-emulators-with-key.ps1` para configurarlo automáticamente
3. Verifica que la variable esté disponible para las funciones:
   ```powershell
   $env:OPENAI_API_KEY="sk-tu-api-key-aqui"
   npm run emulators:all
   ```

### Los datos no aparecen en el Emulator UI

**Solución**: 
1. Refresca la página del Emulator UI
2. Verifica que estés mirando el emulador correcto (no producción)
3. Ejecuta `npm run check:emulator` para verificar que los datos existen

### El seeding tarda mucho

**Normal**: Generar 200 sesiones con historial completo puede tardar 2-5 minutos. El script muestra progreso cada 10 sesiones.

### La progresión no se ve realista

**Solución**: 
- El script genera progresión basada en fases (progresión → meseta → deload)
- Las variaciones son intencionales para simular entrenamiento real
- Si necesitas ajustar la progresión, modifica la función `calculateProgression` en `scripts/seed-user-history.js`

---

## 📊 Estructura de Datos Generados

### completedSessions
```json
{
  "date": "2024-01-15",
  "duration": 2700,
  "startedAt": "2024-01-15T18:00:00.000Z",
  "completedAt": "2024-01-15T18:45:00.000Z",
  "warmup": { "blocks": [...] },
  "workoutPhase": { "blocks": [...] },
  "cooldown": { "blocks": [...] }
}
```

### exerciseHistory
```json
{
  "exerciseId": "push-up",
  "variationId": "standard",
  "sessions": [
    {
      "sessionId": "abc123",
      "date": "2024-01-15T18:00:00.000Z",
      "sets": [
        { "setNumber": 1, "weight": 0, "reps": 10, "completed": true },
        { "setNumber": 2, "weight": 0, "reps": 10, "completed": true },
        { "setNumber": 3, "weight": 0, "reps": 8, "completed": true }
      ]
    },
    // ... más sesiones con progresión
  ],
  "lastPerformedAt": "2025-01-15T18:00:00.000Z"
}
```

### sessionReports
```json
{
  "userId": "abc123xyz",
  "sessionId": "xyz789",
  "sessionDate": "2024-01-15",
  "macroStats": {
    "totalVolume": 0,
    "totalReps": 0
  },
  "exerciseSummaries": []
}
```

---

## 🎯 Notas Importantes

1. **Los datos son sintéticos**: Se generan con variaciones realistas pero no son datos reales de entrenamiento.

2. **Progresión coherente**: El script mantiene coherencia usando tu sesión real como base y simula progresión realista con fases de entrenamiento.

3. **Emulador vs Producción**: Estos datos solo existen en el emulador local. No se sincronizan con Firebase producción.

4. **Limpiar datos**: Si quieres empezar de nuevo, usa el botón "Clear all data" en el Emulator UI (`http://localhost:4000`).

5. **Mismo Training System**: Todas las sesiones generadas usan la misma estructura que tu sesión plantilla, asegurando coherencia con tu sistema de entrenamiento.

---

## 🚀 Siguiente Paso: Probar el Informe de LangGraph

Una vez que tengas los datos, puedes:

1. **Completar una nueva sesión** (real)
2. **Solicitar un informe** desde la app
3. **Verificar que LangGraph genera** un informe detallado usando todo el historial

El informe debería incluir:
- Análisis de progresión a lo largo del año
- Comparativas con sesiones anteriores
- Tendencias de peso, reps, volumen
- Insights sobre fases de entrenamiento
- Recomendaciones basadas en el historial completo

---

## 📚 Referencias

- [Guía de Seeding Original](./SEEDING_GUIDE.md)
- [Arquitectura de LangGraph](./LANGGRAPH_ARCHITECTURE.md)
- [Configuración de OpenAI API Key](./OPENAI_API_KEY_SETUP.md)

