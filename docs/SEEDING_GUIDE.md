# Guía para Sembrar 1 Año de Datos de Entrenamiento

Esta guía te ayudará a llenar tu usuario con 1 año de historial de entrenamiento coherente para probar el sistema de análisis de LangGraph.

## Prerrequisitos

1. ✅ Firebase Emulators corriendo (`npm run emulators:all`)
2. ✅ App de desarrollo corriendo (`npm run dev`)
3. ✅ Tener al menos **una sesión completada** en el emulador

---

## Paso 1: Verificar Estado del Emulador

Ejecuta el script de verificación:

```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run check:emulator
```

Este script te mostrará:
- Si hay usuarios en el emulador
- Si hay sesiones completadas
- Tu UID para usar en el seeding

---

## Paso 2: Crear Datos Iniciales (si no existen)

Si el script muestra "No users found" o "No completed sessions", necesitas:

### 2.1. Abrir la App en el Navegador

Abre `http://localhost:3000` (o el puerto que use tu servidor de desarrollo).

### 2.2. Autenticarte

- **Opción A**: Crear una cuenta nueva (email/password o Google)
- **Opción B**: Si ya tienes cuenta, inicia sesión

**Nota**: Asegúrate de que la app esté configurada para usar el **emulador de Auth** si lo necesitas. Por defecto, Firebase puede usar Auth en producción. Para desarrollo local, verifica tu configuración en `config/firebase.config.js`.

### 2.3. Completar el Onboarding (si es nuevo usuario)

Si es un usuario nuevo, completa el flujo de onboarding:
- Responde las preguntas de perfil
- Completa el baseline assessment
- Genera tu primer sistema de entrenamiento semanal

### 2.4. Completar al Menos UNA Sesión Completa

**Esto es crítico**: El script de seeding usa tu última sesión completada como **plantilla** para generar todas las sesiones sintéticas.

1. Ve a tu calendario/sistema de entrenamiento
2. Selecciona una sesión
3. **Completa toda la sesión**:
   - Realiza el warmup
   - Completa todos los ejercicios del workout
   - Registra peso, reps, sets para cada ejercicio
   - Completa el cooldown
4. Guarda/finaliza la sesión

### 2.5. Verificar que la Sesión se Guardó

Ejecuta de nuevo el script de verificación:

```powershell
npm run check:emulator
```

Deberías ver:
- ✅ Tu UID
- ✅ Al menos 1 sesión completada
- ✅ El comando exacto para ejecutar el seeding

---

## Paso 3: Ejecutar el Seeding

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

### ¿Qué hace el script?

1. **Toma tu última sesión completada** como plantilla
2. **Genera ~200 sesiones** distribuidas a lo largo de 1 año
3. **Crea variaciones realistas**:
   - Peso: ±10% de variación
   - Reps: -1, 0, +1 de variación
   - Duración: ±10% de variación
4. **Actualiza `exerciseHistory`** con el historial completo de cada ejercicio
5. **Crea `sessionReports`** básicos (que LangGraph puede enriquecer después)

---

## Paso 4: Verificar los Datos Generados

### 4.1. En el Emulator UI

Abre `http://localhost:4000` → Firestore → Data

Deberías ver:
- `users/{TU_UID}/completedSessions` → ~200 documentos
- `users/{TU_UID}/exerciseHistory` → Múltiples documentos (uno por ejercicio/variación)
- `users/{TU_UID}/sessionReports` → ~200 documentos

### 4.2. Con el Script de Verificación

```powershell
npm run check:emulator
```

Deberías ver:
- ✅ Total de sesiones completadas: ~200
- ✅ Exercise history entries: Múltiples

---

## Paso 5: Probar el Análisis de LangGraph

Ahora que tienes 1 año de datos:

1. **Completa una nueva sesión** (la última, real)
2. **Solicita un informe** desde la app o vía el chat de análisis
3. **LangGraph debería generar** un informe rico usando todo el historial

### Query de Ejemplo para LangGraph:

```
"Genera un informe técnico detallado de mi última sesión, 
analizando la relación entre fuerza y movilidad, rotación y estabilidad. 
Incluye comparativas con sesiones anteriores y tendencias de progresión."
```

---

## Troubleshooting

### Error: "No completedSessions found for this user"

**Solución**: Necesitas completar al menos una sesión real primero. El script no puede generar datos sin una plantilla.

### Error: "serviceAccountKey.json not found"

**Solución**: Coloca tu archivo `serviceAccountKey.json` en la raíz del proyecto (`C:\Dev\AppsWeb\`).

### Error: "Could not connect to Firestore emulator"

**Solución**: 
1. Verifica que los emuladores estén corriendo: `npm run emulators:all`
2. Asegúrate de que `FIRESTORE_EMULATOR_HOST=localhost:8080` esté configurado

### Los datos no aparecen en el Emulator UI

**Solución**: 
1. Refresca la página del Emulator UI
2. Verifica que estés mirando el emulador correcto (no producción)
3. Ejecuta `npm run check:emulator` para verificar que los datos existen

### El seeding tarda mucho

**Normal**: Generar 200 sesiones con historial completo puede tardar 2-5 minutos. El script muestra progreso en la consola.

---

## Notas Importantes

1. **Los datos son sintéticos**: Se generan con variaciones realistas pero no son datos reales de entrenamiento.

2. **Progresión coherente**: El script mantiene coherencia usando tu sesión real como base, pero no simula una progresión lineal perfecta (eso sería poco realista).

3. **Emulador vs Producción**: Estos datos solo existen en el emulador local. No se sincronizan con Firebase producción.

4. **Limpiar datos**: Si quieres empezar de nuevo, usa el botón "Clear all data" en el Emulator UI (`http://localhost:4000`).

---

## Siguiente Paso: Componente React SessionReport

Una vez que tengas los datos, puedes probar el componente `SessionReport.tsx` que genera informes visuales detallados. Ver la especificación en el código generado anteriormente.

