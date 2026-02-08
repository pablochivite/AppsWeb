/**
 * Script para obtener el User ID del usuario actual
 * Ejecuta este script después de iniciar sesión en la app
 */

import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Necesitamos las credenciales de Firebase desde el .env
// Pero este script se ejecuta en Node, no en el navegador
// Así que necesitamos una forma diferente

console.log('Para obtener tu User ID:');
console.log('');
console.log('1. Abre la app en el navegador (http://localhost:5173 o la URL que uses)');
console.log('2. Inicia sesión');
console.log('3. Abre la consola del navegador (F12)');
console.log('4. Ejecuta este código:');
console.log('');
console.log('   import { auth } from "./config/firebase.config.js";');
console.log('   console.log("Tu User ID:", auth.currentUser?.uid);');
console.log('');
console.log('5. Copia el User ID que aparece');
console.log('');


