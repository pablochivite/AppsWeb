# 📋 Pasos para Llenar tu Usuario con Datos de 1 Año

## ✅ Estado Actual

El emulador está funcionando correctamente. Ahora necesitas seguir estos pasos:

---

## Paso 1: Verificar que Tienes una Sesión Completada

**IMPORTANTE**: Antes de ejecutar el seeding, debes tener al menos **una sesión completada** en la app. Esta sesión se usará como template para generar todas las sesiones históricas.

### Cómo completar una sesión:

1. **Abre tu app en el navegador**
   - Si usas Vite: `http://localhost:5173`
   - O la URL que uses para desarrollo

2. **Inicia sesión** con tu usuario

3. **Completa una sesión de entrenamiento**:
   - Ve al dashboard
   - Haz clic en "Start" en una sesión
   - Completa todos los ejercicios
   - Haz clic en "Finish Workout"

4. **Verifica que la sesión se guardó**:
   - Deberías ver un mensaje de confirmación
   - O verifica en la consola del navegador que no hay errores

---

## Paso 2: Obtener tu User ID

Tienes dos opciones:

### Opción A: Desde la Consola del Navegador (Recomendado)

1. Abre la consola del navegador (F12)
2. Ejecuta este código:

```javascript
import { auth } from './config/firebase.config.js';
console.log('Tu User ID:', auth.currentUser?.uid);
```

3. Copia el User ID que aparece

### Opción B: Usando el Script de Verificación

```powershell
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
node scripts/check-emulator-data.js
```

Este script te mostrará:
- Si tienes usuarios en el emulador
- Si tienes sesiones completadas
- Tu User ID
- El comando exacto para ejecutar el seeding

---

## Paso 3: Ejecutar el Seeding

Una vez que tengas tu User ID, ejecuta el seeding:

### Opción A: Script PowerShell Guiado (Recomendado)

```powershell
.\scripts\complete-seeding-process.ps1
```

Este script:
- Verifica que el emulador esté corriendo
- Verifica que tengas sesiones completadas
- Te guía paso a paso
- Ejecuta el seeding automáticamente

### Opción B: Script PowerShell Directo

```powershell
.\scripts\seed-user-history.ps1 -userId "TU_UID_AQUI" -days 365 -sessionsPerWeek 4
```

### Opción C: Node.js Directo

```powershell
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
node scripts/seed-user-history.js --userId=TU_UID --days=365 --sessionsPerWeek=4
```

---

## Paso 4: Verificar los Datos Generados

Después del seeding, verifica que los datos se generaron correctamente:

```powershell
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
node scripts/check-emulator-data.js
```

O visita el UI del emulador en `http://localhost:4000` y navega a Firestore para ver los datos.

---

## Paso 5: Probar el Informe LangGraph

Una vez que tengas los datos:

1. **Completa una nueva sesión** en la app
2. **Al finalizar**, el sistema automáticamente:
   - Guardará la sesión
   - Generará un reporte de sesión
   - Llamará a LangGraph para análisis

3. **El informe LangGraph incluirá**:
   - Análisis de progresión histórica (1 año de datos)
   - Comparación con sesiones anteriores
   - Insights sobre fuerza, movilidad, rotación, estabilidad
   - Recomendaciones personalizadas basadas en tu historial

---

## ¿Qué Datos se Generan?

El seeding genera:

### 1. Sesiones Completadas (~208 sesiones)
- 4 sesiones por semana × 52 semanas = ~208 sesiones
- Cada sesión incluye:
  - Fecha, duración, disciplina, workout
  - Fases: warmup, workoutPhase, cooldown
  - Bloques con ejercicios y sets completados
  - **Peso, sets y reps** para cada ejercicio

### 2. Historial de Ejercicios
- Un documento por cada combinación ejercicio/variación
- Cada documento contiene:
  - Array de `sessions[]` con fecha y sets realizados
  - **Progresión realista** de peso y reps a lo largo del tiempo
  - Incluye: progresión, plateaus, y deloads

### 3. Reportes de Sesión
- Un reporte básico por cada sesión completada
- Listos para ser enriquecidos por LangGraph

---

## Progresión Realista

El script implementa una progresión coherente:

- **Progresión**: Aumentos graduales de peso (+2.5kg cada 4 semanas) y reps (+1 cada 2 semanas)
- **Plateaus**: Períodos de mantenimiento con variación ligera
- **Deloads**: Reducciones del 10-15% para recuperación

Los datos son **coherentes y fiables** porque:
- Cada ejercicio mantiene su propio historial
- La progresión es temporal (respeta el orden cronológico)
- Los aumentos son realistas (no saltos imposibles)
- Incluye variación natural (no todos los días son perfectos)

---

## Solución de Problemas

### Error: "No completedSessions found"

**Solución**: Completa al menos una sesión real antes de ejecutar el seeding.

### Error: "Cannot connect to emulator"

**Solución**: 
1. Verifica que el emulador esté corriendo: `http://localhost:4000`
2. Si no está, ejecuta: `.\scripts\start-emulators-with-key.ps1`

### El seeding tarda mucho

**Normal**: Generar ~208 sesiones con progresión realista puede tomar 2-5 minutos. Ten paciencia.

### Los datos no aparecen en la app

**Solución**:
1. Verifica que estés usando el emulador (no producción)
2. Limpia el cache del navegador
3. Recarga la app

---

## Resumen Rápido

```powershell
# 1. Verificar datos
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
node scripts/check-emulator-data.js

# 2. Ejecutar seeding (reemplaza TU_UID con tu User ID real)
.\scripts\seed-user-history.ps1 -userId "TU_UID" -days 365 -sessionsPerWeek 4

# 3. Verificar resultados
node scripts/check-emulator-data.js
```

---

## Próximos Pasos Después del Seeding

1. ✅ Completa una nueva sesión en la app
2. ✅ Verifica que se genere el informe LangGraph
3. ✅ Revisa los insights y recomendaciones
4. ✅ Prueba diferentes consultas en el análisis

¡Listo! 🎉


