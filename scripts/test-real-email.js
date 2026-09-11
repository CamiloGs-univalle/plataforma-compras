const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const sa = require('../serviceAccountKey.json');
if(!getApps().length) initializeApp({credential: cert(sa)});
const db = getFirestore();

async function test(){
  const empresaId = 'siamo';
  // crear solicitud real de prueba
  const q = await db.collection('solicitudes').where('empresaId','==',empresaId).get();
  let max=0; q.forEach(d=>{ const n=d.data().numero||0; if(n>max) max=n; });
  const numero = max+1;
  const payload = {
    empresaId,
    numero,
    usuario: 'test_real_camilo',
    nombreUsuario: 'Prueba Real Camilo',
    emailUsuario: 'camilo13369@gmail.com',
    centroTrabajo: 'SALVAJINA - PRUEBA REAL',
    prioridad: 'alta',
    fechaRequerida: '',
    observaciones: 'Prueba real desde plataforma - verificar correo hilo unico',
    items: [{
      codigoProducto: '451173',
      descripcion: 'Alicate prueba REAL - verificar correo',
      cantidad: 1,
      cliente: 'SIAMO',
      contrato: 'N/A',
      unidadNegocio: 'OPERACIONES',
      sucursal: 'SALVAJINA',
      ciudad: 'SALVAJINA',
      proyecto: 'PRUEBA-REAL',
      cuentaMayor: '5110',
      nombreCuentaMayor: 'Gastos',
      precioUnitario: 12312,
      indicadorImpuestos: '19',
      cotizaciones: [],
      estadoItem: 'pendiente',
    }],
    archivos: [],
    estado: 'pendiente',
    fechaCreacion: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  };
  console.log(`Creando solicitud #${numero}...`);
  let ref;
  try {
    ref = await db.collection('solicitudes').add(payload);
    console.log(`✓ Solicitud creada: ${ref.id} #${numero}`);
  } catch(e){
    console.error('✗ Error creando solicitud (cuota?):', e.message);
    // intentar con numero provisorio si falla por quota, igual probar Apps Script
    ref = { id: `test-${numero}` };
  }

  // Probar Apps Script
  const appsUrl = 'https://script.google.com/macros/s/AKfycbyMS9s2ImwWYctd7vhfA5lBpuiPx5XMIYk0wrASkEyAWtMwREOGbGB4MuABfTJC7sMM-Q/exec';
  const body = {
    action: 'nueva_solicitud_compra',
    solicitud: {
      numero,
      nombreUsuario: payload.nombreUsuario,
      emailUsuario: payload.emailUsuario,
      centroTrabajo: payload.centroTrabajo,
      prioridad: payload.prioridad,
      fechaRequerida: payload.fechaRequerida,
      observaciones: payload.observaciones,
      items: payload.items.map(i=> ({ codigoProducto: i.codigoProducto, descripcion: i.descripcion, cantidad: i.cantidad })),
      archivos: [],
    },
    empresa: { nombre: 'Siamo - PRUEBA REAL' },
    analistaEmail: 'camilo13369@gmail.com',
  };
  console.log('Enviando a Apps Script...');
  try {
    const res = await fetch(appsUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(body) });
    const json = await res.json();
    console.log('Respuesta Apps Script:', JSON.stringify(json, null, 2));
    if(json.success){
      console.log(`✓ Correo enviado! ThreadId: ${json.data?.threadId || 'no retornado'} — Revisa camilo13369@gmail.com y Sheet 1JBV4X... pestaña SolicitudesCompras`);
      // guardar threadId en firestore si tenemos ref real
      if(ref.id && !ref.id.startsWith('test-') && json.data?.threadId){
        await db.collection('solicitudes').doc(ref.id).update({ threadId: json.data.threadId });
        console.log('✓ threadId guardado en Firestore');
      }
      // Probar reply en mismo hilo
      if(json.data?.threadId){
        console.log('Probando reply en mismo hilo...');
        const replyBody = {
          action: 'respuesta_analista',
          solicitud: { numero, id: ref.id },
          threadId: json.data.threadId,
          subject: `[SOL-#${numero}] Cotización lista — SALVAJINA`,
          html: `<p>Prueba de seguimiento: cotización lista para SOL-#${numero}</p>`,
          to: 'camilo13369@gmail.com',
          estado: 'cotizada',
        };
        const r2 = await fetch(appsUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(replyBody) });
        const j2 = await r2.json();
        console.log('Reply:', JSON.stringify(j2,null,2));
      }
    } else {
      console.log('✗ Apps Script respondió sin success:', json.message);
    }
  } catch(e){
    console.error('✗ Error fetch Apps Script:', e.message);
  }

  // Verificar Sheet
  console.log('\nVerifica manualmente:');
  console.log('- Gmail: camilo13369@gmail.com — asunto [SOL-#'+numero+']');
  console.log('- Sheet: https://docs.google.com/spreadsheets/d/1JBV4Xl2oOe-lXg_PQNRXEbx-YnqFiBkEVDIA_NMP6Lw — pestaña SolicitudesCompras');
  process.exit(0);
}
test();
