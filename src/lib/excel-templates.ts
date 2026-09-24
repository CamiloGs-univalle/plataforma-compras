'use client';

import * as XLSX from 'xlsx';

// ─── EXCEL TEMPLATES ──────────────────────────────────
// Templates for bulk data import

export interface TemplateConfig {
  name: string;
  description: string;
  headers: string[];
  sampleData: any[];
  requiredFields: string[];
}

export const EXCEL_TEMPLATES: Record<string, TemplateConfig> = {
  productos: {
    name: 'Productos',
    description: 'Plantilla para cargar productos masivamente. Incluye la cuenta contable y el indicador de impuestos que se usan al exportar a SAP.',
    headers: [
      'Codigo',
      'Descripcion',
      'Grupo',
      'Unidad',
      'Precio Unitario',
      'Cuenta Mayor',
      'Nombre Cuenta Mayor',
      'Indicador Impuestos',
      'Stock Minimo',
      'Stock Maximo',
    ],
    sampleData: [
      {
        'Codigo': 'P001',
        'Descripcion': 'Papel Bond Carta 500 hojas',
        'Grupo': 'Papeleria',
        'Unidad': 'Rollo',
        'Precio Unitario': 25000,
        'Cuenta Mayor': '110501',
        'Nombre Cuenta Mayor': 'Papelería y útiles de oficina',
        'Indicador Impuestos': 'IVAD05',
        'Stock Minimo': 10,
        'Stock Maximo': 100,
      },
      {
        'Codigo': 'P002',
        'Descripcion': 'Tinta Impresora HP Negro',
        'Grupo': 'Tintas',
        'Unidad': 'Unidad',
        'Precio Unitario': 85000,
        'Cuenta Mayor': '110502',
        'Nombre Cuenta Mayor': 'Consumibles de impresión',
        'Indicador Impuestos': 'IVAD05',
        'Stock Minimo': 5,
        'Stock Maximo': 50,
      },
    ],
    requiredFields: ['Codigo', 'Descripcion', 'Grupo', 'Unidad', 'Cuenta Mayor', 'Indicador Impuestos'],
  },

  proveedores: {
    name: 'Proveedores',
    description: 'Plantilla para cargar proveedores. Incluye NIT, razon social, contacto, email, telefono y direccion.',
    headers: [
      'NIT',
      'Razon Social',
      'Nombre Contacto',
      'Email',
      'Telefono',
      'Direccion',
      'Ciudad',
      'Departamento',
      'Tipo Proveedor',
      'Estado',
    ],
    sampleData: [
      {
        'NIT': '900123456-7',
        'Razon Social': 'Distribuidora Nacional S.A.S',
        'Nombre Contacto': 'Juan Perez',
        'Email': 'ventas@distnacional.com',
        'Telefono': '6012345678',
        'Direccion': 'Calle 45 #12-34',
        'Ciudad': 'Bogota',
        'Departamento': 'Cundinamarca',
        'Tipo Proveedor': 'Distribuidor',
        'Estado': 'Activo',
      },
    ],
    requiredFields: ['NIT', 'Razon Social', 'Nombre Contacto', 'Email'],
  },

  asignaciones: {
    name: 'Asignaciones',
    description: 'Plantilla para asignar a cada solicitante su Centro de Trabajo y los datos de SAP (Cliente, Contrato, Unidad de Negocio, Proyecto, Sucursal) que se autocompletan al crear una solicitud y se usan al exportar a SAP. Use los mismos codigos del maestro SAP (ver src/lib/sap-catalogos.ts).',
    headers: [
      'Email',
      'Cedula',
      'Nombre',
      'Centro Trabajo',
      'Cliente',
      'Contrato',
      'Unidad Negocio',
      'Proyecto',
      'Sucursal',
    ],
    sampleData: [
      {
        'Email': 'jperez@siamo.com',
        'Cedula': '1004573250',
        'Nombre': 'Juan Perez',
        'Centro Trabajo': 'SALVAJINA',
        'Cliente': 'CL0015',
        'Contrato': 'N0015209',
        'Unidad Negocio': 'UN006',
        'Proyecto': 'SIAMO',
        'Sucursal': 'SC001',
      },
    ],
    requiredFields: ['Centro Trabajo', 'Cliente', 'Contrato', 'Unidad Negocio', 'Proyecto', 'Sucursal'],
  },

  usuarios: {
    name: 'Usuarios',
    description: 'Plantilla para cargar usuarios del sistema. Define nombre, email, rol y centro de trabajo.',
    headers: [
      'Nombre Completo',
      'Email',
      'Rol',
      'Centro Trabajo',
      'Telefono',
      'Estado',
    ],
    sampleData: [
      {
        'Nombre Completo': 'Carlos Martinez',
        'Email': 'carlos@empresa.com',
        'Rol': 'solicitante',
        'Centro Trabajo': 'Sede Principal',
        'Telefono': '3101234567',
        'Estado': 'Activo',
      },
    ],
    requiredFields: ['Nombre Completo', 'Email', 'Rol'],
  },
};

// ─── GENERATE TEMPLATE ────────────────────────────────
export function generateTemplateExcel(templateKey: string): void {
  const template = EXCEL_TEMPLATES[templateKey];
  if (!template) return;

  const ws = XLSX.utils.json_to_sheet(template.sampleData);
  
  // Set column widths
  const colWidths = template.headers.map((h) => ({ wch: Math.max(h.length + 5, 20) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, template.name);

  // Add instructions sheet
  const instructions = [
    { 'Instruccion': `Plantilla de ${template.name}` },
    { 'Instruccion': template.description },
    { 'Instruccion': '' },
    { 'Instruccion': 'INSTRUCCIONES:' },
    { 'Instruccion': '1. Llene los datos en la hoja correspondiente' },
    { 'Instruccion': '2. No modifique los encabezados' },
    { 'Instruccion': '3. Los campos obligatorios estan marcados con *' },
    { 'Instruccion': '4. Guarde el archivo y subalo al sistema' },
    { 'Instruccion': '' },
    { 'Instruccion': `CAMPOS OBLIGATORIOS: ${template.requiredFields.join(', ')}` },
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');

  XLSX.writeFile(wb, `Plantilla_${template.name}.xlsx`);
}

// ─── PARSE UPLOADED EXCEL ──────────────────────────────
export function parseExcelUpload(
  file: File,
  templateKey: string
): Promise<{ data: any[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const template = EXCEL_TEMPLATES[templateKey];

    if (!template) {
      reject(new Error('Template no encontrado'));
      return;
    }

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Validate required fields
        const errors: string[] = [];
        const validData: any[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowErrors: string[] = [];
          
          template.requiredFields.forEach((field) => {
            if (!row[field] && row[field] !== 0) {
              rowErrors.push(`Fila ${index + 2}: Campo "${field}" es requerido`);
            }
          });

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          } else {
            // Transform data to match our schema
            validData.push(transformRow(row, templateKey));
          }
        });

        resolve({ data: validData, errors });
      } catch (error) {
        reject(new Error('Error al leer el archivo Excel'));
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── TRANSFORM ROW DATA ────────────────────────────────
function transformRow(row: any, templateKey: string): any {
  switch (templateKey) {
    case 'productos':
      return {
        codigo: row['Codigo'] || row['codigo'] || '',
        descripcion: row['Descripcion'] || row['descripcion'] || '',
        grupo: row['Grupo'] || row['grupo'] || '',
        unidad: row['Unidad'] || row['unidad'] || '',
        precioUnitario: parseFloat(row['Precio Unitario'] || row['precioUnitario'] || 0),
        cuentaMayor: String(row['Cuenta Mayor'] || row['cuentaMayor'] || ''),
        nombreCuentaMayor: row['Nombre Cuenta Mayor'] || row['nombreCuentaMayor'] || '',
        indicadorImpuestos: row['Indicador Impuestos'] || row['indicadorImpuestos'] || '',
        stockMinimo: parseInt(row['Stock Minimo'] || row['stockMinimo'] || 0),
        stockMaximo: parseInt(row['Stock Maximo'] || row['stockMaximo'] || 0),
        activo: true,
      };
    
    case 'proveedores':
      return {
        nit: row['NIT'] || row['nit'] || '',
        razonSocial: row['Razon Social'] || row['razonSocial'] || '',
        nombreContacto: row['Nombre Contacto'] || row['nombreContacto'] || '',
        email: row['Email'] || row['email'] || '',
        telefono: row['Telefono'] || row['telefono'] || '',
        direccion: row['Direccion'] || row['direccion'] || '',
        ciudad: row['Ciudad'] || row['ciudad'] || '',
        departamento: row['Departamento'] || row['departamento'] || '',
        tipoProveedor: row['Tipo Proveedor'] || row['tipoProveedor'] || '',
        estado: row['Estado'] || row['estado'] || 'Activo',
      };
    
    case 'asignaciones':
      // uid: se usa el email como identificador hasta que la persona inicie
      // sesion con Google por primera vez (mismo criterio que admin/usuarios).
      return {
        uid: row['Email'] || row['email'] || row['Uid'] || row['uid'] || '',
        cedula: String(row['Cedula'] || row['cedula'] || ''),
        nombre: row['Nombre'] || row['nombre'] || '',
        centroTrabajo: row['Centro Trabajo'] || row['centroTrabajo'] || '',
        cliente: String(row['Cliente'] || row['cliente'] || ''),
        contrato: String(row['Contrato'] || row['contrato'] || ''),
        unidadNegocio: String(row['Unidad Negocio'] || row['unidadNegocio'] || ''),
        proyecto: row['Proyecto'] || row['proyecto'] || '',
        sucursal: String(row['Sucursal'] || row['sucursal'] || ''),
      };
    
    case 'usuarios':
      return {
        nombre: row['Nombre Completo'] || row['nombre'] || '',
        email: row['Email'] || row['email'] || '',
        rol: row['Rol'] || row['rol'] || 'solicitante',
        centroTrabajo: row['Centro Trabajo'] || row['centroTrabajo'] || '',
        telefono: row['Telefono'] || row['telefono'] || '',
        estado: row['Estado'] || row['estado'] || 'Activo',
      };
    
    default:
      return row;
  }
}
