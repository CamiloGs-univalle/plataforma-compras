'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { Producto, Asignacion } from '@/types';

interface FilaSolicitud {
  codigoProducto: string;
  descripcion: string;
  cantidad: string;
  cliente: string;
  contrato: string;
  unidadNegocio: string;
  sucursal: string;
  ciudad: string;
  proyecto: string;
  cuentaMayor: string;
  nombreCuentaMayor: string;
  precioUnitario: string;
  indicadorImpuestos: string;
}

interface TablaSolicitudProps {
  productos: Producto[];
  asignaciones: Asignacion[];
  filas: FilaSolicitud[];
  onFilasChange: (filas: FilaSolicitud[]) => void;
}

export default function TablaSolicitud({
  productos,
  asignaciones,
  filas,
  onFilasChange,
}: TablaSolicitudProps) {
  const [arrastre, setArrastre] = useState<{
    columna: string;
    filaOrigen: number;
    filaHasta: number;
  } | null>(null);
  const tablaRef = useRef<HTMLDivElement>(null);

  // Obtener valores únicos de las asignaciones
  const centrosTrabajo = [...new Set(asignaciones.map((a) => a.centroTrabajo))];
  const clientes = [...new Set(asignaciones.map((a) => a.cliente))];
  const contratos = [...new Set(asignaciones.map((a) => a.contrato))];
  const unidadesNegocio = [...new Set(asignaciones.map((a) => a.unidadNegocio))];
  const proyectos = [...new Set(asignaciones.map((a) => a.proyecto))];
  const sucursales = [...new Set(asignaciones.map((a) => a.sucursal))];

  const agregarFila = () => {
    const nuevaFila: FilaSolicitud = {
      codigoProducto: '',
      descripcion: '',
      cantidad: '',
      cliente: clientes.length === 1 ? clientes[0] : '',
      contrato: contratos.length === 1 ? contratos[0] : '',
      unidadNegocio: unidadesNegocio.length === 1 ? unidadesNegocio[0] : '',
      sucursal: sucursales.length === 1 ? sucursales[0] : '',
      ciudad: '',
      proyecto: proyectos.length === 1 ? proyectos[0] : '',
      cuentaMayor: '',
      nombreCuentaMayor: '',
      precioUnitario: '',
      indicadorImpuestos: '',
    };
    onFilasChange([...filas, nuevaFila]);
  };

  const quitarFila = (indice: number) => {
    const nuevasFilas = filas.filter((_, i) => i !== indice);
    onFilasChange(nuevasFilas);
  };

  const actualizarCampo = (indice: number, campo: keyof FilaSolicitud, valor: string) => {
    const nuevasFilas = [...filas];
    nuevasFilas[indice] = { ...nuevasFilas[indice], [campo]: valor };

    // Autocompletar datos del producto si se cambia el código
    if (campo === 'codigoProducto') {
      if (valor === 'OTRO') {
        nuevasFilas[indice].descripcion = '';
        nuevasFilas[indice].cuentaMayor = '';
        nuevasFilas[indice].nombreCuentaMayor = '';
        nuevasFilas[indice].precioUnitario = '';
        nuevasFilas[indice].indicadorImpuestos = '';
      } else {
        const producto = productos.find((p) => p.codigo === valor);
        if (producto) {
          nuevasFilas[indice].descripcion = producto.descripcion;
          nuevasFilas[indice].cuentaMayor = producto.cuentaMayor;
          nuevasFilas[indice].nombreCuentaMayor = producto.nombreCuentaMayor;
          nuevasFilas[indice].precioUnitario = String(producto.precioUnitario);
          nuevasFilas[indice].indicadorImpuestos = producto.indicadorImpuestos;
        }
      }
    }

    onFilasChange(nuevasFilas);
  };

  const iniciarArrastre = (e: React.MouseEvent, filaIndice: number, columna: string) => {
    e.preventDefault();
    setArrastre({ columna, filaOrigen: filaIndice, filaHasta: filaIndice });
  };

  const manejarMouseOver = (e: React.MouseEvent<HTMLTableCellElement>, filaIndice: number) => {
    if (!arrastre) return;
    const columna = e.currentTarget.dataset.col;
    if (columna === arrastre.columna) {
      setArrastre({ ...arrastre, filaHasta: filaIndice });
    }
  };

  const manejarMouseUp = () => {
    if (!arrastre) return;

    const desde = Math.min(arrastre.filaOrigen, arrastre.filaHasta);
    const hasta = Math.max(arrastre.filaOrigen, arrastre.filaHasta);
    const valorOrigen = filas[arrastre.filaOrigen][arrastre.columna as keyof FilaSolicitud];

    const nuevasFilas = [...filas];
    for (let i = desde; i <= hasta; i++) {
      nuevasFilas[i] = { ...nuevasFilas[i], [arrastre.columna]: valorOrigen };
    }

    setArrastre(null);
    onFilasChange(nuevasFilas);
  };

  const esCeldaResaltada = (filaIndice: number, columna: string) => {
    if (!arrastre) return false;
    if (columna !== arrastre.columna) return false;
    const desde = Math.min(arrastre.filaOrigen, arrastre.filaHasta);
    const hasta = Math.max(arrastre.filaOrigen, arrastre.filaHasta);
    return filaIndice >= desde && filaIndice <= hasta;
  };

  const construirSelect = (
    indice: number,
    campo: keyof FilaSolicitud,
    valorActual: string,
    opciones: string[],
    placeholder: string
  ) => (
    <div className="relative">
      <select
        value={valorActual}
        onChange={(e) => actualizarCampo(indice, campo, e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">{placeholder}</option>
        {opciones.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <div
        className="absolute right-0 bottom-0 w-2 h-2 bg-gray-300 opacity-0 hover:opacity-100 cursor-crosshair"
        onMouseDown={(e) => iniciarArrastre(e, indice, campo)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div ref={tablaRef} className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Código
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Descripción
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Cantidad
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Cliente
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Contrato
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Sucursal
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Unidad Negocio
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Proyecto
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, indice) => (
              <tr
                key={indice}
                className="hover:bg-gray-50 border-b border-gray-100"
                onMouseUp={manejarMouseUp}
              >
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'codigoProducto') ? 'bg-blue-100' : ''}`}
                  data-col="codigoProducto"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  <select
                    value={fila.codigoProducto}
                    onChange={(e) => actualizarCampo(indice, 'codigoProducto', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Código --</option>
                    <option value="OTRO">OTRO (servicio/no listado)</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} - {p.descripcion}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={fila.descripcion}
                    onChange={(e) => actualizarCampo(indice, 'descripcion', e.target.value)}
                    readOnly={fila.codigoProducto !== 'OTRO'}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </td>
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'cantidad') ? 'bg-blue-100' : ''}`}
                  data-col="cantidad"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  <input
                    type="number"
                    value={fila.cantidad}
                    onChange={(e) => actualizarCampo(indice, 'cantidad', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </td>
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'cliente') ? 'bg-blue-100' : ''}`}
                  data-col="cliente"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  {construirSelect(indice, 'cliente', fila.cliente, clientes, '-- Cliente --')}
                </td>
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'contrato') ? 'bg-blue-100' : ''}`}
                  data-col="contrato"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  {construirSelect(indice, 'contrato', fila.contrato, contratos, '-- Contrato --')}
                </td>
                <td className="px-2 py-2">
                  {construirSelect(indice, 'sucursal', fila.sucursal, sucursales, '-- Sucursal --')}
                </td>
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'unidadNegocio') ? 'bg-blue-100' : ''}`}
                  data-col="unidadNegocio"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  {construirSelect(indice, 'unidadNegocio', fila.unidadNegocio, unidadesNegocio, '-- Unidad --')}
                </td>
                <td
                  className={`px-2 py-2 ${esCeldaResaltada(indice, 'proyecto') ? 'bg-blue-100' : ''}`}
                  data-col="proyecto"
                  onMouseOver={(e) => manejarMouseOver(e, indice)}
                >
                  {construirSelect(indice, 'proyecto', fila.proyecto, proyectos, '-- Proyecto --')}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => quitarFila(indice)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    disabled={filas.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregarFila}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Agregar fila
      </button>
    </div>
  );
}
