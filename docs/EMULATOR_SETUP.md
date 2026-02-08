# Configuración del Emulador de Firebase Functions

Este documento explica cómo configurar y usar el emulador de Firebase Functions para desarrollo local.

## Problema Común: Error CORS

Si ves el error:
```
Failed to connect to Firebase Functions emulator. Please ensure:
1. Firebase emulators are running (firebase emulators:start)
2. Functions emulator is on port 5001
3. CORS is properly configured
```

Significa que el emulador de Firebase Functions no está corriendo.

## Solución Rápida

### Opción 1: Iniciar solo Functions (Recomendado)

En una terminal separada, ejecuta:

```bash
npm run emulators:functions
```

O directamente:

```bash
firebase emulators:start --only functions
```

### Opción 2: Iniciar todos los emuladores

```bash
npm run emulators:all
```

O directamente:

```bash
firebase emulators:start --only functions,firestore
```

## Pasos Completos

1. **Compilar las funciones** (si hiciste cambios):
   ```bash
   npm run functions:build
   ```

2. **Iniciar el emulador** en una terminal separada:
   ```bash
   npm run emulators:functions
   ```

3. **Iniciar el servidor de desarrollo** en otra terminal:
   ```bash
   npm run dev
   ```

4. **Verificar que el emulador está corriendo**:
   - Deberías ver: `✔  functions[us-central1-generateWorkoutReport]: http function initialized (http://localhost:5001/...)`
   - El UI del emulador estará disponible en: `http://localhost:4000`

## Verificación

Una vez que el emulador esté corriendo:

1. Abre la aplicación en `http://localhost:3000`
2. Completa una sesión
3. Ve a "My Training"
4. Haz clic en "View Report"
5. El reporte debería cargarse sin errores CORS

## Notas Importantes

- El emulador debe estar corriendo **antes** de intentar cargar un reporte
- Si cambias código en `functions/src`, necesitas recompilar con `npm run functions:build`
- El emulador se reinicia automáticamente cuando detecta cambios (hot reload)
- El puerto 5001 es el predeterminado para Functions - no lo cambies a menos que actualices la configuración

## Troubleshooting

### Error: "Port 5001 is already in use"
- Cierra otras instancias del emulador
- O cambia el puerto en `firebase.json` (y actualiza `performanceReportService.js`)

### Error: "Functions not found"
- Asegúrate de haber compilado las funciones: `npm run functions:build`
- Verifica que `functions/lib` existe y tiene archivos `.js`

### Error CORS persiste
- Verifica que el emulador esté corriendo en el puerto 5001
- Revisa la consola del navegador para ver la URL exacta que está intentando acceder
- Asegúrate de que `VITE_FIREBASE_PROJECT_ID` esté configurado en tu `.env`

