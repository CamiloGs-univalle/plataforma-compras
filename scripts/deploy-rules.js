// ─── SCRIPT: Deploy Firestore Rules ──────────────────
// Ejecutar: node scripts/deploy-rules.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Desplegando Firestore Security Rules...\n');

// Verificar que existe el archivo de reglas
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
if (!fs.existsSync(rulesPath)) {
  console.error('❌ No se encontró firestore.rules');
  process.exit(1);
}

// Verificar que Firebase CLI está instalado
try {
  execSync('firebase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Firebase CLI no está instalado');
  console.log('   Instalar con: npm install -g firebase-tools');
  process.exit(1);
}

// Desplegar reglas
try {
  console.log('📋 Verificando reglas...');
  execSync('firebase deploy --only firestore:rules', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  
  console.log('\n✅ Reglas desplegadas exitosamente');
  console.log('\n📌 Resumen de permisos:');
  console.log('   - SUPER_ADMIN: Solo gestiona empresas');
  console.log('   - ADMIN: CRUD completo en su empresa');
  console.log('   - ABASTECIMIENTO: Solo cotizaciones y proveedores');
  console.log('   - SOLICITANTE: Solo crea/ve sus solicitudes');
  
} catch (error) {
  console.error('❌ Error desplegando reglas:', error.message);
  process.exit(1);
}
