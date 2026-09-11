/**
 * SEED FIREBASE - Plataforma de Compras
 * =====================================
 * Importa 368 productos de Siamo desde Excel + usuarios + asignaciones
 *
 * COMO EJECUTAR:
 * 1. Ve a Firebase Console (https://console.firebase.google.com)
 * 2. Selecciona tu proyecto: compras-6a867
 * 3. Ve a Configuracion (icono engranaje) > Cuentas de servicio
 * 4. Haz clic en "Generar nueva clave privada" y descarga el JSON
 * 5. Guarda el archivo como: plataforma-compras/serviceAccountKey.json
 * 6. Abre terminal en la carpeta plataforma-compras
 * 7. Ejecuta: node scripts/seed-siamo.js
 *
 * REQUISITO: npm install firebase-admin xlsx
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const XLSX = require('xlsx');

const serviceAccount = require('../serviceAccountKey.json');

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

const EXCEL_PATH = 'C:\\Users\\administrator\\Downloads\\APLICATIVO DE REQUISICIONES (1).xlsx';

async function seedEmpresas() {
  console.log('1. Creando empresas...');

  const empresas = [
    {
      id: 'siamo',
      nombre: 'Siamo Servicios S.A.S.',
      nit: '900123456-7',
      color: '#0066CC',
      colorSecundario: '#004999',
      logo: '',
      activa: true,
      fechaCreacion: FieldValue.serverTimestamp(),
    },
    {
      id: 'proservis',
      nombre: 'ProServis Temporales S.A.',
      nit: '800234567-8',
      color: '#00A651',
      colorSecundario: '#008040',
      logo: '',
      activa: true,
      fechaCreacion: FieldValue.serverTimestamp(),
    },
    {
      id: 'affine',
      nombre: 'Affine Solutions S.A.S.',
      nit: '901345678-9',
      color: '#FF6B35',
      colorSecundario: '#CC5529',
      logo: '',
      activa: true,
      fechaCreacion: FieldValue.serverTimestamp(),
    },
  ];

  for (const empresa of empresas) {
    await db.collection('empresas').doc(empresa.id).set(empresa);
    console.log(`   OK ${empresa.nombre}`);
  }
}

async function seedProductosDesdeExcel() {
  console.log('\n2. Importando productos desde Excel...');

  const wb = XLSX.readFile(EXCEL_PATH);

  // Importar productos
  const wsProd = wb.Sheets['PRODUCTOS'];
  const productos = XLSX.utils.sheet_to_json(wsProd);
  console.log(`   Encontrados ${productos.length} productos en Excel`);

  // Importar proveedores (precios)
  const wsProv = wb.Sheets['BaseProveedores'];
  const proveedores = XLSX.utils.sheet_to_json(wsProv);

  // Mapa de precios por codigo
  const preciosMap = {};
  for (const prov of proveedores) {
    const codigo = prov.CODIGO;
    if (!codigo) continue;
    const precios = {};
    const proveedoresNombres = ['BRAKO', 'EL PUNTO DE TODO', 'SUMMAR', 'VEGAS SUMINISTROS',
      'SEGURIDAD INDUSTRIAL Y MEDICA', 'IMSEPRO', 'TEXSEGING', 'DISTRIBUIDOR FERRETERO', 'EDIFIKA', 'SUMATEC'];
    for (const nombre of proveedoresNombres) {
      if (prov[nombre] && prov[nombre] > 0) {
        precios[nombre] = prov[nombre];
      }
    }
    preciosMap[codigo] = precios;
  }

  // Crear productos en Firestore
  let count = 0;
  for (const prod of productos) {
    const codigo = String(prod.CODIGO || '');
    const descripcion = prod.DESCRIPCION || '';
    if (!codigo || !descripcion) continue;

    const precios = preciosMap[codigo] || {};
    const gruposArticulo = proveedores.find(p => p.CODIGO === prod.CODIGO);

    await db.collection('productos').add({
      empresaId: 'siamo',
      codigo: codigo,
      descripcion: descripcion,
      cuentaMayor: '',
      nombreCuentaMayor: gruposArticulo?.['GRUPO DE ARTICULO'] || '',
      precioUnitario: 0,
      indicadorImpuestos: '00',
      activo: true,
    });

    // Crear registro de proveedores
    if (Object.keys(precios).length > 0) {
      await db.collection('proveedores').add({
        empresaId: 'siamo',
        codigo: codigo,
        descripcion: descripcion,
        grupoArticulo: gruposArticulo?.['GRUPO DE ARTICULO'] || '',
        precios: precios,
      });
    }

    count++;
  }
  console.log(`   OK ${count} productos creados en Firestore`);
  console.log(`   OK ${Object.keys(preciosMap).length} registros de proveedores con precios`);
}

async function seedUsuariosDesdeExcel() {
  console.log('\n3. Importando usuarios desde Excel...');

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['USUARIOS'];
  const usuarios = XLSX.utils.sheet_to_json(ws);

  let count = 0;
  for (const u of usuarios) {
    const campos = String(u['Usuario | PasswordHash | NombreCompleto | Area'] || '');
    const passwordHash = u['PasswordHash '] || '';
    const nombre = u[' NombreCompleto'] || '';
    const area = u['Area'] || '';
    const rol = u['Rol'] || 'Usuario';

    // El campo usuario viene como "usuario | hash | nombre | area" en una sola linea
    // Necesitamos parsear
    let usuario = '';
    let uid = '';

    if (campos && campos.includes('|')) {
      const partes = campos.split('|').map(p => p.trim());
      usuario = partes[0] || '';
      uid = partes[0] || '';
    } else {
      usuario = String(campos || '');
      uid = String(campos || '');
    }

    if (!usuario) continue;

    // Mapear rol
    let rolFirestore = 'solicitante';
    if (rol === 'Abastecimiento' || area === 'Abastecimiento') {
      rolFirestore = 'abastecimiento';
    } else if (rol === 'Admin') {
      rolFirestore = 'admin_empresa';
    }

    const email = usuario.includes('@') ? usuario : `${usuario.toLowerCase()}@siamo.com`;

    await db.collection('usuarios').doc(`siamo_${uid}`).set({
      uid: `siamo_${uid}`,
      email: email,
      nombre: nombre || usuario,
      rol: rolFirestore,
      empresas: ['siamo'],
      activo: true,
      fechaCreacion: FieldValue.serverTimestamp(),
    });
    count++;
  }
  console.log(`   OK ${count} usuarios creados`);
}

async function seedAsignacionesDesdeExcel() {
  console.log('\n4. Importando asignaciones desde Excel...');

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['AsignacionesUsuario'];
  const asignaciones = XLSX.utils.sheet_to_json(ws);

  let count = 0;
  for (const a of asignaciones) {
    const cedula = String(a.Cedula || '');
    if (!cedula) continue;

    await db.collection('asignaciones').add({
      empresaId: 'siamo',
      cedula: cedula,
      centroTrabajo: a.CentroTrabajo || '',
      cliente: a.Cliente || '',
      contrato: a.Contrato || '',
      unidadNegocio: a.UnidadNegocio || '',
      proyecto: a.Proyecto || '',
      sucursal: a.Sucursal || '',
    });
    count++;
  }
  console.log(`   OK ${count} asignaciones creadas`);
}

async function seedSolicitudesDesdeExcel() {
  console.log('\n5. Importando solicitudes desde Excel...');

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['SOLICITUDES'];
  const solicitudes = XLSX.utils.sheet_to_json(ws);

  let count = 0;
  for (const s of solicitudes) {
    const codigo = s['Código de producto'] || 'OTRO';
    const descripcion = s['Descripción'] || '';
    const cantidad = s['Cantidad'] || 1;
    const cliente = s['Cliente'] || '';
    const contrato = s['Contrato'] || '';
    const unidadNegocio = s['Unidad de negocio'] || '';
    const sucursal = s['Sucursal'] || '';
    const proyecto = s['Proyecto'] || '';
    const centroTrabajo = s['Centro de trabajo'] || '';
    const prioridad = (s['Prioridad'] || 'Media').toLowerCase();
    const numero = s['__EMPTY'] || count + 1;
    const cedula = s['__EMPTY_2'] || '';
    const nombreUsuario = s['__EMPTY_3'] || '';
    const estado = s['__EMPTY_4'] || 'Pendiente';

    // Mapear estado
    const estadoMap = {
      'Pendiente': 'pendiente',
      'En proceso': 'en_proceso',
      'Completada': 'completada',
      'Cancelada': 'cancelada',
      'Aprobada': 'en_proceso',
    };
    const estadoFirestore = estadoMap[estado] || 'pendiente';

    // Mapear prioridad
    const prioridadMap = { 'baja': 'baja', 'media': 'media', 'alta': 'alta', 'urgente': 'urgente' };
    const prioridadFirestore = prioridadMap[prioridad] || 'media';

    const item = {
      codigoProducto: String(codigo),
      descripcion: descripcion,
      cantidad: Number(cantidad) || 1,
      cliente: cliente,
      contrato: contrato,
      unidadNegocio: unidadNegocio,
      sucursal: sucursal,
      ciudad: '',
      proyecto: proyecto,
      cuentaMayor: '',
      nombreCuentaMayor: '',
      precioUnitario: 0,
      indicadorImpuestos: '00',
    };

    await db.collection('solicitudes').add({
      empresaId: 'siamo',
      numero: Number(numero) || count + 1,
      usuario: cedula ? `siamo_${cedula}` : 'unknown',
      nombreUsuario: nombreUsuario,
      emailUsuario: cedula ? `${cedula}@siamo.com` : '',
      centroTrabajo: centroTrabajo,
      prioridad: prioridadFirestore,
      fechaRequerida: '',
      observaciones: '',
      items: [item],
      estado: estadoFirestore,
      respuesta: '',
      fechaCreacion: Timestamp.now(),
      fechaActualizacion: Timestamp.now(),
    });
    count++;
  }
  console.log(`   OK ${count} solicitudes importadas`);
}

async function seedSuperAdmin() {
  console.log('\n6. Creando super admin...');

  await db.collection('usuarios').doc('super_admin_auxiliar').set({
    uid: 'super_admin_auxiliar',
    email: 'auxiliar.ti@proservis.com.co',
    nombre: 'Camilo Garcia',
    rol: 'super_admin',
    empresas: ['siamo', 'proservis', 'affine'], // Todas las empresas
    activo: true,
    fechaCreacion: FieldValue.serverTimestamp(),
  });
  console.log('   OK auxiliar.ti@proservis.com.co (super_admin)');
}

async function main() {
  console.log('========================================');
  console.log('  SEED FIREBASE - PLATAFORMA COMPRAS');
  console.log('========================================\n');

  try {
    await seedEmpresas();
    await seedProductosDesdeExcel();
    await seedUsuariosDesdeExcel();
    await seedAsignacionesDesdeExcel();
    await seedSolicitudesDesdeExcel();
    await seedSuperAdmin();

    console.log('\n========================================');
    console.log('  SEED COMPLETADO EXITOSAMENTE');
    console.log('========================================');
  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

main();
