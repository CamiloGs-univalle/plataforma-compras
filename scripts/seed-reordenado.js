const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

// Usa el service account que ya existe en el proyecto
const serviceAccount = require('../compras-6a867-firebase-adminsdk-fbsvc-7ef23fcfa0.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function seed() {
  const empresaId = process.argv[2] || null;
  // Si no se pasa empresaId, intenta obtener la primera empresa
  let targetEmpresaId = empresaId;
  if (!targetEmpresaId) {
    const snap = await db.collection('empresas').limit(1).get();
    if (snap.empty) {
      console.error('No hay empresas en Firestore. Crea una empresa primero.');
      process.exit(1);
    }
    targetEmpresaId = snap.docs[0].id;
    console.log(`Usando empresaId por defecto: ${snap.docs[0].data().nombre} (${targetEmpresaId})`);
  }

  const file = path.join(__dirname, '..', '..', '..', 'Downloads', 'PRODUCTOS_REORDENADO_FINAL.xlsx');
  // En Windows, la ruta es C:\Users\administrator\Downloads\...
  const altFile = 'C:\\Users\\administrator\\Downloads\\PRODUCTOS_REORDENADO_FINAL.xlsx';
  let wb;
  try {
    wb = XLSX.readFile(altFile);
  } catch (e) {
    wb = XLSX.readFile(file);
  }
  const wsProd = wb.Sheets['PRODUCTOS_REORDENADO'];
  const prodData = XLSX.utils.sheet_to_json(wsProd, { defval: '' });
  console.log(`Productos en Excel: ${prodData.length}`);

  const wsProv = wb.Sheets['BaseProveedores_REORDENADO'];
  const provData = XLSX.utils.sheet_to_json(wsProv, { defval: '' });
  console.log(`BaseProveedores filas: ${provData.length}`);

  // Limpiar productos existentes para esa empresa (opcional - solo upsert)
  // Vamos a hacer upsert por codigo
  let creados = 0, actualizados = 0;
  for (const row of prodData) {
    const codigo = String(row['CODIGO']).trim();
    const descripcion = String(row['DESCRIPCION']).trim();
    if (!codigo || !descripcion) continue;
    // Buscar si ya existe
    const q = await db.collection('productos').where('empresaId', '==', targetEmpresaId).where('codigo', '==', codigo).limit(1).get();
    if (q.empty) {
      await db.collection('productos').add({
        empresaId: targetEmpresaId,
        codigo,
        descripcion,
        cuentaMayor: '',
        nombreCuentaMayor: '',
        precioUnitario: 0,
        indicadorImpuestos: 'IVAD05',
        activo: true,
        grupo: '',
        unidad: '',
      });
      creados++;
    } else {
      // Actualizar descripcion si cambio, y asegurar que codigo esta limpio
      const doc = q.docs[0];
      const data = doc.data();
      if (data.descripcion !== descripcion) {
        await doc.ref.update({ descripcion, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
        actualizados++;
      }
    }
  }
  console.log(`Productos: ${creados} creados, ${actualizados} actualizados`);

  // Proveedores: cada fila es un producto con precios por proveedor
  // La cabecera tiene CODIGO, DESCRIPCION, GRUPO DE ARTICULO, y luego cada proveedor
  const header = Object.keys(provData[0] || {});
  // Los proveedores son las columnas desde la 4ta en adelante
  const proveedoresNombres = header.slice(3).filter(h => h && String(h).trim() !== '');
  console.log('Proveedores detectados:', proveedoresNombres);

  let provCreados = 0, provActualizados = 0;
  for (const row of provData) {
    const codigo = String(row['CODIGO']).trim();
    if (!codigo) continue;
    // Construir mapa de precios
    const precios = {};
    let hasPrecio = false;
    for (const prov of proveedoresNombres) {
      const val = row[prov];
      let precio = 0;
      if (typeof val === 'number') precio = val;
      else if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
        precio = parseFloat(clean) || 0;
      }
      if (precio > 0) {
        precios[prov] = precio;
        hasPrecio = true;
      }
    }
    if (!hasPrecio) continue; // si no tiene precios, no crear doc de precios (pero producto ya existe)
    // Buscar si ya existe un doc de proveedor para este codigo y empresa
    const q = await db.collection('proveedores').where('empresaId', '==', targetEmpresaId).where('codigo', '==', codigo).limit(1).get();
    if (q.empty) {
      await db.collection('proveedores').add({
        empresaId: targetEmpresaId,
        codigo,
        descripcion: String(row['DESCRIPCION']).trim(),
        grupoArticulo: String(row['GRUPO DE ARTICULO'] || '').trim(),
        precios,
      });
      provCreados++;
    } else {
      const doc = q.docs[0];
      await doc.ref.update({ precios, descripcion: String(row['DESCRIPCION']).trim(), grupoArticulo: String(row['GRUPO DE ARTICULO'] || '').trim() });
      provActualizados++;
    }
  }
  console.log(`Proveedores: ${provCreados} creados, ${provActualizados} actualizados`);

  // Mapeo supervisor-productos: opcional, lo dejamos en el archivo TS ya, pero tambien podriamos crear una coleccion
  // Por ahora solo logueamos
  console.log('Listo. Productos reordenados y proveedores actualizados.');
  console.log('Ahora el frontend filtrara productos por supervisor+centro usando src/lib/supervisor-productos.ts');
}

seed().catch(e => { console.error(e); process.exit(1); });
