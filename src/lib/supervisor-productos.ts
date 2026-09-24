// Mapeo Supervisor -> Productos permitidos, derivado de APLICATIVO DE REQUISICIONES (2).xlsx
// Hoja SOLICITUDES (historial) + AsignacionesUsuario
// Cada supervisor (cedula) en un CentroTrabajo especifico solo ve los productos que ha pedido antes para ese centro.
// Si no hay historial (0 codigos), se muestran todos los productos (fallback).
// Generado automaticamente desde PRODUCTOS_REORDENADO_FINAL.xlsx -> SUPERVISOR_PRODUCTOS

export interface SupervisorProductoMapeo {
  cedula: string;
  nombre: string;
  centroTrabajo: string;
  cliente: string;
  codigos: string[];
}

export const SUPERVISOR_PRODUCTOS: SupervisorProductoMapeo[] = [
  { cedula: "1004573250", nombre: "Mancilla Aldereti Eyder Evelio", centroTrabajo: "SALVAJINA", cliente: "CL0015", codigos: ["451173"] },
  { cedula: "1004573250", nombre: "Mancilla Aldereti Eyder Evelio", centroTrabajo: "UNIVALLE", cliente: "CL1019", codigos: ["452346", "5016"] },
  { cedula: "1112472573", nombre: "Pabon Jimenez Mauricio", centroTrabajo: "PLANTAS MENORES", cliente: "CL0015", codigos: ["450480", "451103", "451173", "451202", "451819"] },
  { cedula: "1112472573", nombre: "Pabon Jimenez Mauricio", centroTrabajo: "GLF", cliente: "CL1031", codigos: ["451103", "451173", "451202", "5016"] },
  { cedula: "1006233801", nombre: "Solorzano Londoño Stephania", centroTrabajo: "INDEGA", cliente: "CL0014", codigos: [] },
  { cedula: "1144040468", nombre: "Vasquez Quintero Diana Carolina", centroTrabajo: "INDEGA", cliente: "CL0014", codigos: [] },
  { cedula: "4512400", nombre: "Acosta Buritica Fernando", centroTrabajo: "INDEGA", cliente: "CL0014", codigos: [] },
  { cedula: "28880879", nombre: "Yara Amaya Adriana Lorena", centroTrabajo: "PRADO", cliente: "CL0015", codigos: [] },
  { cedula: "28880879", nombre: "Yara Amaya Adriana Lorena", centroTrabajo: "CUCUANA", cliente: "CL0015", codigos: [] },
  { cedula: "1113515547", nombre: "Escobar Cardona Yeison Arturo", centroTrabajo: "CIAT", cliente: "CL1029", codigos: [] },
  { cedula: "1144194233", nombre: "Clevel Angulo Jesus Alberto", centroTrabajo: "SANIMAX-AMAGA", cliente: "CL1030", codigos: ["450480"] },
  { cedula: "1144194233", nombre: "Clevel Angulo Jesus Alberto", centroTrabajo: "SANIMAX-SIBATE", cliente: "CL1030", codigos: [] },
  { cedula: "1112878557", nombre: "Marin Campo Jose Camilo", centroTrabajo: "CALIMA", cliente: "CL0015", codigos: [] },
  { cedula: "1112878557", nombre: "Marin Campo Jose Camilo", centroTrabajo: "PALERMO", cliente: "CL0015", codigos: [] },
];

// Helper: obtener codigos permitidos para una cedula + centroTrabajo
export function codigosPermitidos(cedula: string, centroTrabajo: string): string[] | null {
  if (!cedula || !centroTrabajo) return null;
  const ced = String(cedula).trim();
  const centro = String(centroTrabajo).trim().toLowerCase();
  const match = SUPERVISOR_PRODUCTOS.find(s => String(s.cedula).trim() === ced && s.centroTrabajo.trim().toLowerCase() === centro);
  if (!match) return null;
  if (match.codigos.length === 0) return null; // 0 = sin restriccion, muestra todos
  return match.codigos;
}

// Helper: filtrar productos segun lo permitido
export function filtrarProductosPorSupervisor<T extends { codigo: string }>(productos: T[], cedula: string, centroTrabajo: string): T[] {
  const permitidos = codigosPermitidos(cedula, centroTrabajo);
  if (!permitidos) return productos; // sin restriccion
  const set = new Set(permitidos.map(c => String(c).trim()));
  return productos.filter(p => set.has(String(p.codigo).trim()));
}
