# 🚀 Quick Start - Configuración Rápida

Guía rápida para configurar todo y empezar a usar el sistema de análisis LangGraph.

## ⚡ Configuración Rápida (5 minutos)

### 1. Configurar OpenAI API Key

**Opción A: Script Automático (Recomendado)**

En PowerShell:
```powershell
npm run setup:openai
```

O directamente:
```powershell
.\scripts\setup-openai-key.ps1
```

**Opción B: Manual**

En PowerShell:
```powershell
$env:OPENAI_API_KEY="sk-tu-api-key-aqui"
```

En Git Bash:
```bash
export OPENAI_API_KEY="sk-tu-api-key-aqui"
```

**Obtener API Key**: https://platform.openai.com/api-keys

---

### 2. Iniciar Emuladores con API Key

**Opción A: Script Todo-en-Uno**

En PowerShell:
```powershell
.\scripts\start-emulators-with-key.ps1
```

Este script:
- ✅ Verifica si la API key está configurada
- ✅ Si no está, te la pide
- ✅ Inicia los emuladores automáticamente

**Opción B: Manual**

1. Configura la API key (paso 1)
2. En la misma terminal:
```powershell
npm run emulators:all
```

---

### 3. Verificar Estado del Emulador

```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run check:emulator
```

Esto te mostrará:
- 👤 Usuarios en el emulador
- 📊 Sesiones completadas
- 🎯 Comando exacto para seeding

---

### 4. Crear Datos Iniciales (si no existen)

Si el script muestra "No users found":

1. **Abre tu app**: `http://localhost:3000` (o tu puerto de desarrollo)
2. **Autentícate**: Crea cuenta o inicia sesión
3. **Completa una sesión**: 
   - Genera sistema de entrenamiento
   - Completa una sesión completa (warmup, workout, cooldown)
   - Registra peso, reps, sets
4. **Verifica de nuevo**: `npm run check:emulator`

---

### 5. Sembrar 1 Año de Datos

Una vez que tengas al menos 1 sesión completada:

```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run seed:user-history -- --userId=TU_UID --days=365 --sessionsPerWeek=4
```

(Reemplaza `TU_UID` con el UID que te muestra `check:emulator`)

---

## 📋 Checklist Rápido

- [ ] API Key de OpenAI configurada (`$env:OPENAI_API_KEY`)
- [ ] Emuladores corriendo (`npm run emulators:all`)
- [ ] Al menos 1 sesión completada en el emulador
- [ ] Datos sembrados (opcional, para pruebas)

---

## 🔧 Troubleshooting

### Error: "401 Incorrect API key"

**Solución**: 
1. Verifica que la key empiece con `sk-`
2. Configura la variable en la misma terminal donde ejecutas emuladores
3. Reinicia los emuladores después de configurar

### Error: "No users found"

**Solución**: Completa al menos una sesión en la app primero.

### La API key se pierde al cerrar terminal

**Solución**: Usa el script `setup-openai-key.ps1` que te permite configurarla permanentemente, o agrega a tu `~/.bashrc` / perfil de PowerShell.

---

## 📚 Documentación Completa

- **Configuración API Key**: `docs/OPENAI_API_KEY_SETUP.md`
- **Guía de Seeding**: `docs/SEEDING_GUIDE.md`
- **Arquitectura LangGraph**: `docs/LANGGRAPH_ARCHITECTURE.md`

---

## 🎯 Siguiente Paso

Una vez configurado todo:
1. Completa una sesión en la app
2. Solicita un análisis/informe
3. LangGraph generará insights automáticamente

¡Listo! 🎉

