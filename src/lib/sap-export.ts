import * as XLSX from 'xlsx';
import type { Solicitud } from '@/types';
import { format } from 'date-fns';

export interface SapRow {
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocDueDate: string;
  NumAtCard: string;
  Comments: string;
  ItemCode: string;
  Quantity: number;
  Price: number;
  WarehouseCode: string;
  CostCenter: string;
  AccountCode: string;
}

export function buildSapRows(solicitud: Solicitud): { header: any; rows: SapRow[]; tsv: string } {
  const prov = (solicitud as any).proveedor || solicitud.items?.[0]?.cotizaciones?.[0]?.proveedor || 'PROV-GENERICO';
  const cardCode = (prov as string).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) || 'C900000000';
  const docDate = format(new Date(), 'yyyyMMdd');
  const docDue = solicitud.fechaRequerida ? format(new Date(solicitud.fechaRequerida), 'yyyyMMdd') : docDate;
  const comments = `OC desde plataforma #${solicitud.numero} - ${solicitud.centroTrabajo} - ${solicitud.nombreUsuario}`.slice(0, 254);

  const rows: SapRow[] = solicitud.items.map(it => {
    const cot = (it as any).cotizaciones?.[(it as any).mejorCotizacionIndex ?? 0];
    const price = cot?.precioUnitario ?? it.precioUnitario ?? 0;
    return {
      CardCode: cardCode,
      CardName: prov,
      DocDate: docDate,
      DocDueDate: docDue,
      NumAtCard: `SOL-${solicitud.numero}`,
      Comments: comments,
      ItemCode: it.codigoProducto || it.descripcion.slice(0, 20),
      Quantity: it.cantidad,
      Price: price,
      WarehouseCode: (solicitud.centroTrabajo || '01').slice(0, 8) || '01',
      CostCenter: it.cliente || solicitud.centroTrabajo || '1000',
      AccountCode: it.cuentaMayor || '5110',
    };
  });

  const tsv = [
    Object.keys(rows[0] || {}).join('\t'),
    ...rows.map(r => Object.values(r).join('\t')),
  ].join('\n');

  const header = { CardCode: cardCode, DocDate: docDate, DocDueDate: docDue, NumAtCard: `SOL-${solicitud.numero}`, Comments: comments, TotalRows: rows.length };

  return { header, rows, tsv };
}

export function downloadSapExcel(solicitud: Solicitud) {
  const { rows } = buildSapRows(solicitud);
  // DTW format: Header + Rows
  const headerWs = XLSX.utils.json_to_sheet([rows[0] ? { CardCode: rows[0].CardCode, CardName: rows[0].CardName, DocDate: rows[0].DocDate, DocDueDate: rows[0].DocDueDate, NumAtCard: rows[0].NumAtCard, Comments: rows[0].Comments } : {}]);
  const rowsWs = XLSX.utils.json_to_sheet(rows);
  // Single sheet OPOR listo para DTW
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, rowsWs, 'OPOR');
  // Validación
  const valWs = XLSX.utils.aoa_to_sheet([
    ['VALIDACIÓN ANTES DE PEGAR EN SAP'],
    ['Proveedor CardCode', rows[0]?.CardCode],
    ['Moneda', 'COP'],
    ['Impuesto', 'IVA 19% ya incluido en Price si cotización lo trae'],
    ['Bodega', rows[0]?.WarehouseCode],
    ['Centro Costo', rows[0]?.CostCenter],
    ['Cuenta', rows[0]?.AccountCode],
    [],
    ['INSTRUCCIÓN: Importar vía DTW o copiar pestaña OPOR a plantilla SAP B1'],
  ]);
  XLSX.utils.book_append_sheet(wb, valWs, 'INSTRUCCIONES');
  XLSX.writeFile(wb, `SAP-OPOR-SOL-${solicitud.numero}.xlsx`);
}

export async function copySapTsv(solicitud: Solicitud) {
  const { tsv } = buildSapRows(solicitud);
  await navigator.clipboard.writeText(tsv);
  return tsv;
}
