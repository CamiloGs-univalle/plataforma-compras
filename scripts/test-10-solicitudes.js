const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EMPRESA_ID = 'siamo';

const ESCENARIOS = [
  { nombre: 'Mancilla Aldereti Eyder Evelio', email:'eyder.mancilla@siamo.com', centro:'SALVAJINA', prioridad:'alta', items:[{codigo:'451173', desc:'Alicate diablo gavilan', cant:1, precio:12312}] },
  { nombre: 'Garcia Reclutadora Bogota', email:'recluta.bog@siamo.com', centro:'BOGOTA - SEDE PRINCIPAL', prioridad:'urgente', items:[{codigo:'CEL-001', desc:'Celular Samsung A54 128GB', cant:1, precio:850000}, {codigo:'ACC-01', desc:'Forro + vidrio templado', cant:1, precio:45000}] },
  { nombre: 'Lopez Ingeniero Cali', email:'lopez.cali@siamo.com', centro:'CALI - PLANTA', prioridad:'alta', items:[{codigo:'LAP-001', desc:'Portatil Lenovo ThinkPad E14', cant:1, precio:2850000}] },
  { nombre: 'Martinez Operario Medellin', email:'martinez.med@siamo.com', centro:'MEDELLIN - OPERACIONES', prioridad:'media', items:[{codigo:'DOT-01', desc:'Dotacion completa operario (camisa+ pantalon + botas)', cant:5, precio:185000}] },
  { nombre: 'Rojas Abastecimiento Central', email:'rojas.abast@siamo.com', centro:'BOGOTA - ABASTECIMIENTO', prioridad:'media', items:[{codigo:'PAP-01', desc:'Resma papel carta 500 hojas', cant:20, precio:28000}, {codigo:'TON-01', desc:'Toner HP 58X', cant:4, precio:320000}] },
  { nombre: 'Torres SST Popayan', email:'torres.sst@siamo.com', centro:'POPAYAN - SST', prioridad:'urgente', items:[{codigo:'EPP-01', desc:'Casco seguridad + gafas + guantes', cant:10, precio:95000}] },
  { nombre: 'Diaz Mantenimiento Salvajina', email:'diaz.mant@siamo.com', centro:'SALVAJINA', prioridad:'alta', items:[{codigo:'HER-01', desc:'Taladro percutor Dewalt 13mm', cant:1, precio:650000}, {codigo:'HER-02', desc:'Juego brocas 29 pzas', cant:1, precio:120000}] },
  { nombre: 'Camilo Garcia TI', email:'auxiliar.ti@proservis.com.co', centro:'BOGOTA - TI', prioridad:'media', items:[{codigo:'RED-01', desc:'Switch 24 puertos Gigabit', cant:1, precio:980000}, {codigo:'CAB-01', desc:'Cable UTP Cat6 x 305m', cant:2, precio:210000}] },
  { nombre: 'Fernandez Contabilidad Cali', email:'fernandez.conta@siamo.com', centro:'CALI - ADMINISTRATIVO', prioridad:'baja', items:[{codigo:'MOB-01', desc:'Silla ergonomica gerencial', cant:2, precio:750000}] },
  { nombre: 'Gomez Laboratorio Yumbo', email:'gomez.lab@siamo.com', centro:'YUMBO - LABORATORIO', prioridad:'alta', items:[{codigo:'LAB-01', desc:'Kit reactivos pH + balanza 0.01g', cant:1, precio:1430000}] },
];

async function getNextNumero(empresaId){
  const snap = await db.collection('solicitudes').where('empresaId','==',empresaId).get();
  let max=0; snap.forEach(d=>{ const n=d.data().numero||0; if(n>max) max=n;});
  return max+1;
}
async function createOne(esc, numero){
  const now = Timestamp.now();
  const doc = {
    empresaId: EMPRESA_ID,
    numero,
    usuario: `test_${esc.email.replace(/[^a-z0-9]/g,'_')}`,
    nombreUsuario: esc.nombre,
    emailUsuario: esc.email,
    centroTrabajo: esc.centro,
    prioridad: esc.prioridad,
    fechaRequerida: '',
    observaciones: 'Solicitud de prueba automatizada - flujo demo',
    items: esc.items.map(it=>({
      codigoProducto: it.codigo,
      descripcion: it.desc,
      cantidad: it.cant,
      cliente: 'SIAMO',
      contrato: 'N/A',
      unidadNegocio: 'OPERACIONES',
      sucursal: esc.centro,
      ciudad: esc.centro.split(' - ')[0] || '',
      proyecto: 'DEMO',
      cuentaMayor: '5110',
      nombreCuentaMayor: 'Gastos operativos',
      precioUnitario: it.precio,
      indicadorImpuestos: '19',
      cotizaciones: [],
      estadoItem: 'pendiente',
    })),
    estado: 'pendiente',
    fechaCreacion: now,
    fechaActualizacion: now,
  };
  const ref = await db.collection('solicitudes').add(doc);
  return ref.id;
}

async function processFlow(id, escIndex){
  const ref = db.collection('solicitudes').doc(id);
  const snap = await ref.get();
  const data = snap.data();
  const base = data.fechaCreacion.toDate();
  const uid = data.usuario;
  const nombre = 'Analista Compras Demo';
  // Distribuimos estados para mostrar variedad + algunos completos
  // 0-1: quedan pendiente (no tocar)
  // 2-3: en_cotizacion
  // 4-5: cotizada
  // 6-7: aprobada -> en_pedido (OC auto)
  // 8-9: completada
  let targetEstado = 'pendiente';
  if (escIndex <2) targetEstado='pendiente';
  else if (escIndex <4) targetEstado='en_cotizacion';
  else if (escIndex <6) targetEstado='cotizada';
  else if (escIndex <8) targetEstado='en_pedido';
  else targetEstado='completada';

  const estadosOrden = ['pendiente','en_cotizacion','cotizada','aprobada','en_pedido','completada'];
  const idxTarget = estadosOrden.indexOf(targetEstado);
  let currentIdx = 0;
  for(let i=1; i<=idxTarget; i++){
    const estado = estadosOrden[i];
    const fecha = new Date(base.getTime() + i* 2 * 60*60*1000); // +2h por paso
    const ts = Timestamp.fromDate(fecha);
    let update = { estado, fechaActualizacion: ts };
    let nota = { autor: nombre, fecha: ts, tipo:'general', texto: nombre + ' movio a ' + estado };
    if(estado==='en_cotizacion'){ nota.tipo='cotizacion'; nota.texto = nombre + ' inicio cotizacion'; }
    if(estado==='cotizada'){
      // agregar cotizacion simulada con proveedor y valor
      const itemsCot = data.items.map(it=>{
        const precio = it.precioUnitario || 50000;
        const variacion = Math.round(precio * (0.95 + Math.random()*0.1));
        const valorIva = Math.round(variacion*0.19);
        const precioConIva = variacion + valorIva;
        return {
          ...it,
          cotizaciones:[{
            proveedor: ['SUMMAR','BRAKO','IMSEPRO','VEGAS'][i%4],
            precioUnitario: variacion,
            porcentajeIva:19,
            valorIva,
            precioConIva,
            cantidad: it.cantidad,
            subtotal: variacion*it.cantidad,
            total: precioConIva*it.cantidad,
          }],
          mejorCotizacionIndex:0,
        };
      });
      update.items = itemsCot;
      update.cotizadoPor = uid;
      update.cotizadoPorNombre = nombre;
      update.fechaCotizacion = ts;
      nota.texto = nombre + ' envio cotizacion';
      nota.tipo='cotizacion';
    }
    if(estado==='aprobada'){ update.aprobadoPor=uid; update.aprobadoPorNombre=nombre; update.fechaAprobacion=ts; nota.tipo='aprobacion'; nota.texto=nombre+' aprobo'; }
    if(estado==='en_pedido'){
      // genera OC auto igual que API: OC-YYYY-####
      const snapOC = await db.collection('solicitudes').where('numeroPedido','!=',null).get();
      let max=0; snapOC.forEach(d=>{ const m=(d.data().numeroPedido||'').match(/(\d+)\s*$/); if(m) max=Math.max(max, parseInt(m[1],10));});
      const oc = `OC-${fecha.getFullYear()}-${String(max+1).padStart(4,'0')}`;
      update.numeroPedido = oc;
      update.fechaPedido = ts;
      nota.texto = nombre+' genero OC '+oc;
    }
    if(estado==='completada'){ nota.texto = nombre+' marco completada - entrega recibida'; }
    await ref.update(update);
    await ref.collection('notas').add(nota);
    // actualizar data para siguiente iteracion
    if(update.items) data.items = update.items;
  }
  return targetEstado;
}

async function main(){
  console.log('🚀 Creando 10 solicitudes de prueba...');
  let next = await getNextNumero(EMPRESA_ID);
  console.log('  Siguiente numero:',next);
  const creadas=[];
  for(let i=0;i<ESCENARIOS.length;i++){
    const esc = ESCENARIOS[i];
    const numero = next + i;
    const id = await createOne(esc, numero);
    creadas.push({id, numero, esc, idx:i});
    console.log(`  ✓ #${numero} [${esc.centro}] ${esc.nombre} - ${esc.items.map(x=>x.desc).join(', ')} -> ${id}`);
  }
  console.log('\n🔄 Procesando flujos...');
  for(const c of creadas){
    const final = await processFlow(c.id, c.idx);
    console.log(`  → #${c.numero} ahora en: ${final}`);
  }
  console.log('\n✅ 10 solicitudes creadas y procesadas con seguimiento completo');
  console.log('   Ver en: /admin/solicitudes y /admin/seguimiento-pedidos y /admin/reportes');
  process.exit(0);
}
main().catch(e=>{ console.error(e); process.exit(1);});
