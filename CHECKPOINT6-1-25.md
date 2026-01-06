# REGAIN - Checkpoint del Estado Actual
**Fecha:** 31 de Diciembre, 2025  
**Proyecto:** AppsWeb - Sistema de Ingeniería de Movimiento

---

## 📋 Resumen Ejecutivo

REGAIN es una aplicación web de una sola página (SPA) diseñada como un sistema de ingeniería de movimiento basado en los principios de Pilates: respiración, enfoque holístico, variabilidad, longevidad y técnica. La aplicación soporta dos roles principales: **Atleta** y **Coach**.

### Estado de Implementación
- ✅ **Arquitectura base**: Completamente implementada
- ✅ **Sistema de templates**: Modular y funcional
- ✅ **Router SPA**: Implementado y funcional
- ✅ **Sistema de onboarding**: Implementado con selección de rol y preguntas
- ✅ **Vista de sesión**: Completamente implementada (modo full-screen)
- ✅ **Calendario**: Implementado con vistas semanal y mensual
- ✅ **Dashboard atleta**: Implementado con fases expandibles
- ⚠️ **Funcionalidades coach**: Parcialmente implementadas (placeholders)
- ⚠️ **Modus operandi**: Placeholder
- ⚠️ **Perfil**: Placeholder

---

## 🏗️ Estructura del Proyecto

```
AppsWeb/
├── .cursor/
│   └── indications/
│       ├── context/
│       │   └── product-essence.mdc      # Filosofía y metodología REGAIN
│       └── rules/
│           ├── cursor-rules.mdc         # Guías para reglas de Cursor
│           ├── integrity-check.mdc      # Reglas de integridad cross-file
│           ├── project-structure.mdc    # Documentación de estructura
│           ├── self-improve.mdc         # Guías de mejora de reglas
│           ├── style.mdc                # Sistema de diseño REGAIN
│           └── tech-stack.mdc           # Stack tecnológico
├── assets/                              # Assets estáticos (vacío actualmente)
├── css/
│   └── styles.css                       # Sistema de diseño con CSS variables
├── html/                                # Templates HTML modulares
│   ├── components/
│   │   ├── sidebar.html                 # Navegación lateral
│   │   └── voice-fab.html               # Botón flotante de voz
│   ├── overlays/
│   │   ├── onboarding.html              # Overlay de onboarding
│   │   └── session.html                 # Overlay de sesión (full-screen)
│   └── pages/
│       ├── athlete/
│       │   ├── calendar.html            # Calendario atleta
│       │   ├── explore.html             # Feed tipo TikTok/Reels
│       │   ├── home.html                # Dashboard atleta
│       │   ├── modus.html               # Configuración atleta
│       │   └── profile.html             # Perfil atleta
│       └── coach/
│           ├── calendar.html             # Calendario coach
│           ├── clients.html              # Gestión de clientes
│           └── home.html                # Dashboard coach
├── js/
│   ├── app.js                           # Punto de entrada principal
│   ├── core/                            # Funcionalidad compartida (sin dependencias de rol)
│   │   ├── constants.js                 # Constantes y terminología REGAIN
│   │   ├── router.js                    # SPARouter (clase de routing)
│   │   ├── storage.js                   # Helpers de LocalStorage
│   │   ├── template-loader.js           # Sistema de carga de templates
│   │   ├── ui-utils.js                  # Utilidades UI comunes
│   │   └── workout-engine.js            # Motor de generación de sesiones
│   ├── onboarding/                      # Flujo de onboarding
│   │   ├── onboarding-manager.js       # Gestor de onboarding
│   │   └── voice-input.js               # Integración Web Speech API
│   ├── athlete/                         # Funcionalidad específica atleta
│   │   ├── calendar.js                  # Vista de calendario atleta
│   │   ├── dashboard.js                 # Dashboard/homepage atleta
│   │   ├── modus-operandi.js            # Configuración atleta (placeholder)
│   │   └── session-view.js              # ✅ COMPLETO - Reproductor de sesión
│   ├── coach/                           # Funcionalidad específica coach
│   │   ├── calendar.js                  # Vista de calendario coach
│   │   ├── client-list.js               # Gestión de clientes (placeholder)
│   │   ├── dashboard.js                 # Dashboard coach
│   │   └── plan-builder.js              # Constructor de planes (placeholder)
│   └── data/
│       └── exercises.json                # Base de datos de ejercicios
├── index.html                           # Shell HTML mínimo
└── AppsWeb_31-12-2025.code-workspace    # Archivo de workspace VS Code
```

---

## 🎨 Sistema de Diseño

### REGAIN Design System
- **Estética**: Minimalista en blanco y negro
- **Efectos**: Glassmorphism con blur y transparencias
- **Tipografía**: Inter (Google Fonts)
- **Iconos**: Font Awesome 6.4.0
- **Framework CSS**: Tailwind CSS (via CDN)
- **CSS Variables**: Sistema completo de custom properties en `css/styles.css`

### Variables CSS Principales
- Colores: `--color-bg-primary`, `--color-text-primary`, etc.
- Glassmorphism: `--glass-bg-standard`, `--glass-border-standard`, `--glass-blur-standard`
- Transiciones: `--transition-standard`, `--transition-fast`, `--transition-slow`
- Border radius: `--radius-xs` a `--radius-2xl`
- Z-index: `--z-base`, `--z-sidebar`, `--z-overlay`, `--z-modal`, `--z-session`

---

## 🔧 Stack Tecnológico

### Frontend
- **JavaScript**: ES6+ con módulos (import/export)
- **No Framework**: Vanilla JavaScript puro
- **CSS**: Tailwind CSS (CDN) + CSS Custom Properties
- **Templates**: Sistema modular de carga dinámica
- **Estado**: LocalStorage para persistencia

### Dependencias Externas
- Tailwind CSS (CDN)
- Font Awesome 6.4.0 (CDN)
- Google Fonts - Inter (CDN)
- Web Speech API (nativo del navegador)

---

## 📁 Archivos Clave y Estado

### ✅ Completamente Implementados

#### `index.html`
- Shell HTML mínimo con contenedores para templates
- Estructura SPA con sidebar y área de contenido principal
- Contenedores para overlays (onboarding, sesión)
- Carga de estilos y scripts

#### `js/app.js`
- Punto de entrada principal
- Carga de templates al inicio
- Gestión de roles (Athlete/Coach)
- Inicialización del router
- Inicialización de onboarding
- Delegación de eventos globales

#### `js/core/template-loader.js`
- Sistema de carga de templates HTML
- Cache de templates
- Mapeo de contenedores a archivos
- Inyección en DOM

#### `js/core/router.js`
- Clase `SPARouter` para navegación SPA
- Manejo de rutas basado en roles
- Transiciones entre páginas
- Actualización de estado de navegación activa

#### `js/core/storage.js`
- Helpers para LocalStorage
- Gestión de roles, onboarding, perfil de usuario
- Sistema de entrenamiento
- Progreso de sesiones
- Preferencias de calendario

#### `js/core/workout-engine.js`
- Generación de sesiones de entrenamiento
- Lógica de progressive overload
- Tracking de milestones
- Intercambio de variaciones
- Lectura de `exercises.json`

#### `js/athlete/session-view.js`
- ✅ **COMPLETO** - Reproductor de sesión full-screen
- Modo de enfoque completo
- Tracking de progreso en tiempo real
- Actualización de milestones
- Navegación entre ejercicios
- Visualización de variaciones y fases
- Cues de técnica

#### `js/athlete/dashboard.js`
- Dashboard/homepage del atleta
- Fases expandibles (Warm-up, Workout, Cool-down)
- Intercambio de variaciones
- Inicialización de sesiones
- Integración con workout-engine

#### `js/athlete/calendar.js`
- Vista de calendario con sistema de entrenamiento
- Toggle semanal/mensual
- Visualización de sesiones programadas
- Integración con training system

#### `js/onboarding/onboarding-manager.js`
- Gestión del flujo de onboarding
- Selección de rol
- Preguntas para atletas
- Integración con voice-input

#### `js/onboarding/voice-input.js`
- Integración con Web Speech API
- Reconocimiento de voz
- Estados de escucha/procesamiento

#### `css/styles.css`
- Sistema completo de diseño REGAIN
- CSS Custom Properties
- Estilos de glassmorphism
- Animaciones y transiciones
- Estilos de calendario
- Estilos de overlay de sesión
- Scrollbar personalizado

### ⚠️ Parcialmente Implementados / Placeholders

#### `js/athlete/modus-operandi.js`
- Placeholder para configuración del atleta

#### `js/athlete/profile.js` (no existe archivo JS)
- Página HTML existe pero sin funcionalidad JS

#### `js/coach/client-list.js`
- Placeholder para gestión de clientes

#### `js/coach/plan-builder.js`
- Placeholder para constructor de planes de entrenamiento

---

## 🎯 Funcionalidades Principales

### Sistema de Roles
- **Athlete**: Flujo completo con onboarding, dashboard, calendario, sesiones
- **Coach**: Dashboard y calendario básicos, funcionalidades avanzadas pendientes

### Onboarding
- Selección de rol (Athlete/Coach)
- Para atletas: preguntas sobre disciplina, objetivos, equipamiento, molestias
- Entrada por voz opcional
- Persistencia en LocalStorage

### Sistema de Entrenamiento
- Generación de sesiones basada en sistema de entrenamiento
- Tres fases: Warm-up, Workout, Cool-down
- Progressive overload automático
- Tracking de milestones (3 sesiones exitosas)
- Intercambio de variaciones de ejercicios

### Calendario
- Vista semanal y mensual (toggle)
- Integración con training system
- Visualización de sesiones programadas
- Preferencias guardadas por rol

### Sesión de Entrenamiento
- Modo full-screen con overlay
- Progreso en tiempo real
- Navegación entre ejercicios
- Visualización de variaciones y fases
- Cues de técnica
- Actualización automática de milestones

### Dashboard Atleta
- Vista de fases expandibles
- Preview de sesiones
- Intercambio de variaciones
- Inicialización de sesiones

---

## 📊 Datos y Persistencia

### LocalStorage Keys
- `userRole`: Rol del usuario ('athlete' o 'coach')
- `onboardingData`: Respuestas del onboarding
- `userProfile`: Perfil del usuario (milestones, objetivos, etc.)
- `trainingSystem`: Sistema de entrenamiento configurado
- `sessionProgress`: Progreso de sesión actual
- `calendarView-{role}`: Preferencia de vista de calendario

### Archivos de Datos
- `js/data/exercises.json`: Base de datos de ejercicios con:
  - Variaciones
  - Músculos objetivo
  - Cues de técnica
  - Niveles de dificultad
  - Tipos de progresión

---

## 🔄 Flujo de Aplicación

1. **Carga inicial** (`DOMContentLoaded`)
   - Carga de todos los templates HTML
   - Inyección en contenedores DOM
   - Mostrar overlay de onboarding

2. **Onboarding**
   - Selección de rol
   - Si es atleta: preguntas adicionales
   - Si es coach: acceso directo

3. **Inicialización de App**
   - Creación de router
   - Actualización de navegación según rol
   - Inicialización de funcionalidad específica de rol
   - Navegación a página home

4. **Navegación**
   - Router maneja cambios de página
   - Actualización de estado activo en sidebar
   - Transiciones suaves

5. **Sesión de Entrenamiento**
   - Inicialización desde dashboard o calendario
   - Overlay full-screen
   - Tracking de progreso
   - Actualización de milestones al completar

---

## 🎨 Principios de Diseño REGAIN

### Metodología (Pilates DNA)
1. **Respiración**: Base de todo movimiento
2. **Enfoque Holístico**: Core como fundamento, conexión de todo el cuerpo
3. **Variabilidad**: Evitar repetición mecánica
4. **Longevidad**: Salud articular y postural sobre ego
5. **Técnica**: Movimiento deliberado, preciso y controlado

### Jerarquía de Movimiento
1. Postura (prioridad absoluta)
2. Movilidad/Flexibilidad
3. Rotación
4. Orden mecánico: Bilateral → Unilateral, Estático → Dinámico, Concéntrico → Excéntrico

### Estructura de Sesión
1. **Fase 1**: Warm-up (Warm-up + Mobility)
2. **Fase 2**: Workout (Core + Framework)
3. **Fase 3**: Cool Down (Stretching/Mobility) - **OBLIGATORIO**

---

## 📝 Terminología REGAIN

- **Session**: Una iteración de un Training
- **Workout/Routine**: Etiqueta del tipo de entrenamiento (Leg, Push, Pull, etc.)
- **Discipline**: Método de entrenamiento (CrossFit, Pilates, etc.)
- **Training Framework**: Componentes del sistema (Push-Pull, Upper-Lower, etc.)
- **Phases**: Componentes de una Session (Warm-up, Workout, Cool-down)
- **Training System**: Ciclo completo con orden/patrón específico
- **Exercise**: Entidad de movimiento con múltiples variaciones
- **Variation**: Instancia específica con cambios en dificultad
- **Progressive Overload**: Orden de variaciones según dificultad
- **Overload Period**: Transición entre variaciones (3 sesiones exitosas)
- **Milestone**: Logrado cuando se mantiene una variación superior por 3 sesiones

---

## 🚀 Próximos Pasos Sugeridos

### Funcionalidades Pendientes
1. Completar `modus-operandi.js` (configuración atleta)
2. Implementar perfil de atleta
3. Completar funcionalidades de coach:
   - Gestión de clientes
   - Constructor de planes
4. Mejorar feed de Explore (funcionalidad completa)
5. Integración de voz completa (comandos de voz)

### Mejoras Técnicas
1. Sistema de autenticación (si es necesario)
2. Backend/API para persistencia en servidor
3. Sincronización multi-dispositivo
4. Notificaciones push
5. Analytics y tracking de progreso avanzado

---

## 📌 Notas Importantes

### Arquitectura
- **Modular**: Templates HTML separados, JS organizado por responsabilidad
- **Sin dependencias externas**: Solo CDN para CSS e iconos
- **ES6 Modules**: Todo el código usa import/export
- **SPA**: Navegación completamente client-side

### Compatibilidad
- Requiere navegador moderno con soporte para:
  - ES6 Modules
  - LocalStorage
  - Fetch API
  - Web Speech API (opcional, para voz)

### Mantenimiento
- Documentación en `.cursor/indications/`
- Reglas de Cursor para mantener consistencia
- Sistema de templates facilita mantenimiento
- CSS variables centralizadas para fácil theming

---

## ✅ Checklist de Estado

- [x] Arquitectura base SPA
- [x] Sistema de templates modular
- [x] Router funcional
- [x] Onboarding completo
- [x] Dashboard atleta
- [x] Calendario atleta (semanal/mensual)
- [x] Vista de sesión completa
- [x] Workout engine funcional
- [x] Sistema de diseño REGAIN
- [x] Persistencia LocalStorage
- [ ] Modus operandi atleta
- [ ] Perfil atleta
- [ ] Funcionalidades coach completas
- [ ] Feed Explore funcional completo

---

**Checkpoint creado el:** 31 de Diciembre, 2025  
**Versión del proyecto:** Pre-alpha / Desarrollo activo

