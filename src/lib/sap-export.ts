// Exportación a SAP Business One — Órdenes de Compra ("Pedido")
//
// La estructura de columnas replica EXACTAMENTE la pantalla de SAP B1
// "Pedido" (módulo Compras > Orden de Compra), pestaña "Contenido",
// según la captura entregada por el área de Compras
// (INFORMACION PARA CAMILO.xlsx, hoja "ESCTRUCTURA DEL SAP"):
//
//   Encabezado: Proveedor (PR901197632), Nombre (FERRETERIA EL PORTILLO SAS),
//               No.Ref.del acreedor (FP 6931), Moneda local (COP),
//               Nº OCompra 13429, Estado Abiertos,
//               Fecha de contabilización / Fecha de entrega / Fecha de documento,
//               Encargado de compras, Propietario
//   Contenido:  # | Cuenta de mayor | Nombre de la cuenta de mayor | Descripción
//               | Cantidad | Cantidad | Precio por unidad | Indicador de impuestos
//               | CLIENTE | CONTRATOS | SUCURSAL | CIUDAD | UNIDADES DE NEGOCIO | Proyecto
//               Clase de artículo/servicio = Servicio, Clase de resumen = Sin resumen
//   Ejemplo real de la imagen:
//     1 | 61557006 | Elementos de seguridad y dotación | CASCO | 1 | SANIMAX-AMAGA | $ 21.008,00 | IVAD05 | CL1030 | N1030201 | SC001 | 05001 | UN002 | SIAMO
//     2 | 61557013 | Dotacion | Dotacion - JHONATAN SUAREZ | 348.891 | jhonatan suarez | $ 71.429,00 | IVAD05 | CL1030 | N1030201 | SC001 | 05001 | UN002 | SIAMO
//
// El archivo generado queda listo para pegarse en SAP B1 (pantalla "Pedido")
// o para importarse vía SAP DTW.

import * as XLSX from 'xlsx';
import type { Solicitud, ItemSolicitud } from '@/types';
import { format } from 'date-fns';
import { nombreCliente, nombreContrato, nombreUnidadNegocio } from './sap-catalogos';

// ─── Encabezado del pedido (datos de proveedor y fechas) ──────────────
export interface SapHeader {
  proveedorCodigo: string;
  proveedorNombre: string;
  noRefAcreedor: string;
  moneda: string;
  fechaContabilizacion: string;
  fechaEntrega: string;
  fechaDocumento: string;
  encargadoCompras: string;
}

// ─── Una fila de la grilla "Contenido" del Pedido ──────────────────────
// La grilla tiene DOS columnas llamadas "Cantidad": la primera es numérica,
// la segunda es el detalle libre (en la imagen: SANIMAX-AMAGA / jhonatan suarez).
// Internamente la segunda se guarda como `cantidadDetalle` y se expone como "Cantidad".
export interface SapRow {
  '#': number;
  'Cuenta de mayor': string;
  'Nombre de la cuenta de mayor': string;
  'Descripción': string;
  'Cantidad': number;
  'Cantidad_2': string;
  'Precio por unidad': number;
  'Indicador de impuestos': string;
  'CLIENTE': string;
  'CONTRATOS': string;
  'SUCURSAL': string;
  'CIUDAD': string;
  'UNIDADES DE NEGOCIO': string;
  'Proyecto': string;
}

// Orden exacto de columnas como en SAP (con "Cantidad" duplicado en posición 5 y 6)
export const SAP_COLUMNAS: string[] = [
  '#',
  'Cuenta de mayor',
  'Nombre de la cuenta de mayor',
  'Descripción',
  'Cantidad',
  'Cantidad',
  'Precio por unidad',
  'Indicador de impuestos',
  'CLIENTE',
  'CONTRATOS',
  'SUCURSAL',
  'CIUDAD',
  'UNIDADES DE NEGOCIO',
  'Proyecto',
];

function mejorPrecio(item: ItemSolicitud): number {
  const idx = item.mejorCotizacionIndex ?? 0;
  const cot = item.cotizaciones?.[idx] ?? item.cotizaciones?.[0];
  return cot?.precioUnitario ?? item.precioUnitario ?? 0;
}

function proveedorSeleccionado(solicitud: Solicitud): string {
  for (const item of solicitud.items || []) {
    const idx = item.mejorCotizacionIndex ?? 0;
    const cot = item.cotizaciones?.[idx] ?? item.cotizaciones?.[0];
    if (cot?.proveedor) return cot.proveedor;
  }
  return (solicitud as unknown as { proveedor?: string }).proveedor || '';
}

export function buildSapHeader(solicitud: Solicitud): SapHeader {
  const hoy = format(new Date(), 'dd/MM/yyyy');
  const fechaEntrega = solicitud.fechaRequerida
    ? format(new Date(solicitud.fechaRequerida), 'dd/MM/yyyy')
    : hoy;

  return {
    proveedorCodigo: '',
    proveedorNombre: proveedorSeleccionado(solicitud),
    noRefAcreedor: `SOL-${solicitud.numero ?? ''}`,
    moneda: 'COP',
    fechaContabilizacion: hoy,
    fechaEntrega,
    fechaDocumento: hoy,
    encargadoCompras: solicitud.cotizadoPorNombre || solicitud.aprobadoPorNombre || '',
  };
}

export function buildSapRows(solicitud: Solicitud): { header: SapHeader; rows: SapRow[]; tsv: string } {
  const header = buildSapHeader(solicitud);

  const rows: SapRow[] = (solicitud.items || []).map((item, i) => ({
    '#': i + 1,
    'Cuenta de mayor': item.cuentaMayor || '',
    'Nombre de la cuenta de mayor': item.nombreCuentaMayor || '',
    'Descripción': item.descripcion || '',
    'Cantidad': item.cantidad || 0,
    // Segunda columna "Cantidad" — detalle (SANIMAX-AMAGA / nombre del beneficiario)
    // Si no se capturó por línea, hereda el centroTrabajo de la solicitud
    'Cantidad_2': (item as any).cantidadDetalle || (solicitud as any).centroTrabajo || item.descripcion?.split(' - ').pop() || '',
    'Precio por unidad': mejorPrecio(item),
    'Indicador de impuestos': item.indicadorImpuestos || 'IVAD05',
    'CLIENTE': item.cliente || '',
    'CONTRATOS': item.contrato || '',
    'SUCURSAL': item.sucursal || '',
    'CIUDAD': item.ciudad || '05001',
    'UNIDADES DE NEGOCIO': item.unidadNegocio || '',
    'Proyecto': item.proyecto || '',
  }));

  // TSV con cabecera duplicada "Cantidad\tCantidad"
  const tsv = [
    SAP_COLUMNAS.join('\t'),
    ...rows.map(r => [
      r['#'],
      r['Cuenta de mayor'],
      r['Nombre de la cuenta de mayor'],
      r['Descripción'],
      r['Cantidad'],
      r['Cantidad_2'],
      r['Precio por unidad'],
      r['Indicador de impuestos'],
      r['CLIENTE'],
      r['CONTRATOS'],
      r['SUCURSAL'],
      r['CIUDAD'],
      r['UNIDADES DE NEGOCIO'],
      r['Proyecto'],
    ].join('\t')),
  ].join('\n');

  return { header, rows, tsv };
}

function filasValidacion(header: SapHeader, rows: SapRow[]): (string | number)[][] {
  const filas: (string | number)[][] = [
    ['VALIDACIÓN ANTES DE PEGAR EN SAP — Estructura exacta de la imagen "ESCTRUCTURA DEL SAP"'],
    ['Clase de artículo/servicio: Servicio | Clase de resumen: Sin resumen'],
    [],
    ['ENCABEZADO (copiar a la parte superior de Pedido en SAP)'],
    ['Proveedor (CardCode)', header.proveedorCodigo || '(seleccionar en SAP — ej. PR901197632 en la imagen)'],
    ['Nombre', header.proveedorNombre || '⚠ SIN PROVEEDOR — buscar y seleccionar CardCode en SAP'],
    ['No.Ref. del acreedor', header.noRefAcreedor],
    ['Moneda local', header.moneda],
    ['Fecha de contabilización', header.fechaContabilizacion],
    ['Fecha de entrega', header.fechaEntrega],
    ['Fecha de documento', header.fechaDocumento],
    ['Encargado de compras', header.encargadoCompras || '—'],
    [],
    ['CONTENIDO — Grilla "Contenido" (14 columnas, "Cantidad" duplicada como en SAP)'],
    SAP_COLUMNAS,
  ];

  // Add a human row showing expected example from image
  filas.push(['1', '61557006', 'Elementos de seguridad y dotación', 'CASCO', 1, 'SANIMAX-AMAGA', 21008, 'IVAD05', 'CL1030', 'N1030201', 'SC001', '05001', 'UN002', 'SIAMO — (ejemplo imagen)']);
  filas.push(['2', '61557013', 'Dotacion', 'Dotacion - JHONATAN SUAREZ', 348.891, 'jhonatan suarez', 71429, 'IVAD05', 'CL1030', 'N1030201', 'SC001', '05001', 'UN002', 'SIAMO — (ejemplo imagen)']);
  filas.push([]);

  rows.forEach(r => {
    const problemas: string[] = [];
    if (!r['Cuenta de mayor']) problemas.push('sin cuenta de mayor');
    if (!r['Indicador de impuestos']) problemas.push('sin indicador de impuestos');
    if (r['CLIENTE'] && !nombreCliente(r['CLIENTE'])) problemas.push(`CLIENTE ${r['CLIENTE']} no existe en catálogo SAP`);
    if (r['CONTRATOS'] && !nombreContrato(r['CONTRATOS'])) problemas.push(`CONTRATO ${r['CONTRATOS']} no existe en catálogo SAP`);
    if (r['UNIDADES DE NEGOCIO'] && !nombreUnidadNegocio(r['UNIDADES DE NEGOCIO'])) problemas.push(`UNIDAD DE NEGOCIO ${r['UNIDADES DE NEGOCIO']} no existe en catálogo SAP`);
    filas.push([
      r['#'],
      r['Descripción'],
      r['Cuenta de mayor'],
      `${r['CLIENTE']} ${nombreCliente(r['CLIENTE'])}`.trim(),
      `${r['CONTRATOS']} ${nombreContrato(r['CONTRATOS'])}`.trim(),
      `${r['UNIDADES DE NEGOCIO']} ${nombreUnidadNegocio(r['UNIDADES DE NEGOCIO'])}`.trim(),
      `Cant: ${r['Cantidad']} | ${r['Cantidad_2']}`,
      problemas.length ? `⚠ ${problemas.join(' · ')}` : '✔ OK',
    ]);
  });

  filas.push([]);
  filas.push(['INSTRUCCIÓN: En SAP B1 abra Compras > Orden de Compra (Pedido), seleccione el']);
  filas.push(['Proveedor por Nombre, complete el encabezado con los datos de la hoja ENCABEZADO']);
  filas.push(['y pegue las filas de la pestaña "OPOR" en la grilla "Contenido" (o impórtelas vía DTW).']);
  filas.push(['Clase de artículo/servicio debe quedar en "Servicio" y Clase de resumen en "Sin resumen" (como en la imagen).']);

  return filas;
}

export function downloadSapExcel(solicitud: Solicitud): void {
  const { header, rows } = buildSapRows(solicitud);

  const wb = XLSX.utils.book_new();

  // Hoja OPOR: filas listas para copiar/pegar — cabecera exacta con "Cantidad" duplicada
  const oporData: (string | number)[][] = [
    SAP_COLUMNAS,
    ...rows.map(r => [
      r['#'],
      r['Cuenta de mayor'],
      r['Nombre de la cuenta de mayor'],
      r['Descripción'],
      r['Cantidad'],
      r['Cantidad_2'],
      r['Precio por unidad'],
      r['Indicador de impuestos'],
      r['CLIENTE'],
      r['CONTRATOS'],
      r['SUCURSAL'],
      r['CIUDAD'],
      r['UNIDADES DE NEGOCIO'],
      r['Proyecto'],
    ]),
  ];
  const rowsWs = XLSX.utils.aoa_to_sheet(oporData);
  rowsWs['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 32 }, { wch: 10 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
  ];
  // Congelar cabecera
  rowsWs['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' } as any;
  XLSX.utils.book_append_sheet(wb, rowsWs, 'OPOR');

  // Hoja de encabezado
  const headerWs = XLSX.utils.json_to_sheet([{
    'Proveedor (CardCode)': header.proveedorCodigo || '(seleccionar en SAP — ej. PR901197632)',
    'Nombre': header.proveedorNombre,
    'No.Ref.del acreedor': header.noRefAcreedor,
    'Moneda local': header.moneda,
    'Fecha de contabilización': header.fechaContabilizacion,
    'Fecha de entrega': header.fechaEntrega,
    'Fecha de documento': header.fechaDocumento,
    'Encargado de compras': header.encargadoCompras,
    'Clase de artículo/servicio': 'Servicio',
    'Clase de resumen': 'Sin resumen',
  }]);
  headerWs['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, headerWs, 'ENCABEZADO');

  // Hoja de validación
  const valWs = XLSX.utils.aoa_to_sheet(filasValidacion(header, rows));
  valWs['!cols'] = [{ wch: 26 }, { wch: 32 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, valWs, 'INSTRUCCIONES');

  XLSX.writeFile(wb, `SAP-Pedido-SOL-${solicitud.numero ?? ''}.xlsx`);
}

export async function copySapTsv(solicitud: Solicitud): Promise<string> {
  const { tsv } = buildSapRows(solicitud);
  await navigator.clipboard.writeText(tsv);
  return tsv;
}
