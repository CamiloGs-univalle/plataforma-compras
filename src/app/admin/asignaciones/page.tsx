'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/DataTable';
import { ExcelUpload } from '@/components/ExcelUpload';
import {
  Link2,
  Plus,
  Upload,
  Edit,
  Trash2,
  MapPin,
  Users,
  Mail,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  obtenerAsignaciones,
  crearAsignacion,
  actualizarAsignacion,
  eliminarAsignacion,
} from '@/lib/firestore';
import type { Asignacion } from '@/types';
import {
  CLIENTES,
  CONTRATOS,
  UNIDADES_NEGOCIO,
  CENTROS_TRABAJO_CONOCIDOS,
  nombreCliente,
  nombreContrato,
  nombreUnidadNegocio,
  datosSapPorCentroTrabajo,
} from '@/lib/sap-catalogos';
import toast from 'react-hot-toast';

// nombre: dato de referencia (no forma parte del tipo Asignacion en Firestore
// pero se guarda junto a los demas campos para identificar rapido a quien
// pertenece la asignacion en la tabla de administracion).
interface AsignacionCompleta extends Asignacion {
  nombre?: string;
}

const FORM_INICIAL = {
  uid: '',
  cedula: '',
  nombre: '',
  centroTrabajo: '',
  cliente: '',
  contrato: '',
  unidadNegocio: '',
  proyecto: '',
  sucursal: '',
};

// Campos del formulario (Crear/Editar), como componente propio para que
// React no lo desmonte/remonte en cada render (si se define dentro del
// componente de la pagina, los inputs pierden el foco en cada tecla).
function CamposFormularioAsignacion({
  formData,
  setFormData,
  onCentroTrabajoChange,
}: {
  formData: typeof FORM_INICIAL;
  setFormData: (data: typeof FORM_INICIAL) => void;
  onCentroTrabajoChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email (login con Google)</Label>
        <Input
          type="email"
          value={formData.uid}
          onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
          placeholder="persona@proservis.com.co"
        />
      </div>
      <div className="space-y-2">
        <Label>Cedula</Label>
        <Input
          value={formData.cedula}
          onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
          placeholder="1004573250"
        />
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Nombre</Label>
        <Input
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Nombre del solicitante"
        />
      </div>
      <div className="space-y-2 col-span-2">
        <Label className="flex items-center gap-1">
          Centro Trabajo *
          <span title="Autocompleta Cliente/Contrato/Unidad/Proyecto/Sucursal si el centro ya existe en SAP">
            <Sparkles className="h-3 w-3 text-amber-500" />
          </span>
        </Label>
        <Input
          list="centros-trabajo-sap"
          value={formData.centroTrabajo}
          onChange={(e) => onCentroTrabajoChange(e.target.value)}
          placeholder="Ej: SALVAJINA, UNIVALLE, INDEGA..."
        />
        <datalist id="centros-trabajo-sap">
          {CENTROS_TRABAJO_CONOCIDOS.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label>Cliente * (codigo SAP)</Label>
        <Input
          list="clientes-sap"
          value={formData.cliente}
          onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
          placeholder="CL0015"
        />
        <datalist id="clientes-sap">
          {CLIENTES.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
        </datalist>
        {formData.cliente && <p className="text-[11px] text-muted-foreground">{nombreCliente(formData.cliente) || 'Codigo no encontrado en catalogo SAP'}</p>}
      </div>
      <div className="space-y-2">
        <Label>Contrato (codigo SAP)</Label>
        <Input
          list="contratos-sap"
          value={formData.contrato}
          onChange={(e) => setFormData({ ...formData, contrato: e.target.value })}
          placeholder="N0015209"
        />
        <datalist id="contratos-sap">
          {CONTRATOS.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
        </datalist>
        {formData.contrato && <p className="text-[11px] text-muted-foreground">{nombreContrato(formData.contrato) || 'Codigo no encontrado en catalogo SAP'}</p>}
      </div>
      <div className="space-y-2">
        <Label>Unidad Negocio (codigo SAP)</Label>
        <Input
          list="unidades-negocio-sap"
          value={formData.unidadNegocio}
          onChange={(e) => setFormData({ ...formData, unidadNegocio: e.target.value })}
          placeholder="UN006"
        />
        <datalist id="unidades-negocio-sap">
          {UNIDADES_NEGOCIO.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
        </datalist>
        {formData.unidadNegocio && <p className="text-[11px] text-muted-foreground">{nombreUnidadNegocio(formData.unidadNegocio) || 'Codigo no encontrado en catalogo SAP'}</p>}
      </div>
      <div className="space-y-2">
        <Label>Proyecto</Label>
        <Input
          value={formData.proyecto}
          onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
          placeholder="SIAMO"
        />
      </div>
      <div className="space-y-2">
        <Label>Sucursal</Label>
        <Input
          value={formData.sucursal}
          onChange={(e) => setFormData({ ...formData, sucursal: e.target.value })}
          placeholder="SC001"
        />
      </div>
    </div>
  );
}

export default function AsignacionesPage() {
  const { empresa } = useCompany();
  const [asignaciones, setAsignaciones] = useState<AsignacionCompleta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [asignacionSel, setAsignacionSel] = useState<AsignacionCompleta | null>(null);
  const [filtroCentro, setFiltroCentro] = useState<string>('todos');

  const [formData, setFormData] = useState({ ...FORM_INICIAL });

  const refresh = async () => { if (!empresa?.id) return; const asigs = await obtenerAsignaciones(empresa.id); setAsignaciones(asigs as AsignacionCompleta[]); };

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    refresh().finally(() => setCargando(false));
  }, [empresa?.id]);

  const centros = [...new Set(asignaciones.map(a => a.centroTrabajo).filter(Boolean))];

  // Autollenado: al escribir/seleccionar un Centro de Trabajo que ya existe en
  // el maestro SAP (hoja SUPERVISORES), se completan Cliente/Contrato/Unidad de
  // Negocio/Proyecto/Sucursal automaticamente. Solo llena los campos vacios
  // para no pisar datos que el admin ya haya escrito a mano.
  const autollenarPorCentro = (centroTrabajo: string, base: typeof FORM_INICIAL) => {
    const datosSap = datosSapPorCentroTrabajo(centroTrabajo);
    if (!datosSap) return { ...base, centroTrabajo };
    return {
      ...base,
      centroTrabajo,
      cliente: base.cliente || datosSap.cliente,
      contrato: base.contrato || datosSap.contrato,
      unidadNegocio: base.unidadNegocio || datosSap.unidadNegocio,
      proyecto: base.proyecto || datosSap.proyecto,
      sucursal: base.sucursal || datosSap.sucursal,
    };
  };

  const handleCentroTrabajoChange = (value: string) => {
    setFormData(prev => autollenarPorCentro(value, prev));
  };

  const handleCreate = async () => {
    if (!empresa?.id) return;
    if (!formData.centroTrabajo || !formData.cliente) {
      toast.error('Centro de Trabajo y Cliente son obligatorios');
      return;
    }
    try {
      await crearAsignacion({
        empresaId: empresa.id,
        uid: formData.uid,
        cedula: formData.cedula,
        nombre: formData.nombre,
        centroTrabajo: formData.centroTrabajo,
        cliente: formData.cliente,
        contrato: formData.contrato,
        unidadNegocio: formData.unidadNegocio,
        proyecto: formData.proyecto,
        sucursal: formData.sucursal,
      } as any);
      toast.success('Asignacion creada exitosamente');
      setShowCreate(false);
      resetForm();
    } catch (error) {
      toast.error('Error al crear asignacion');
    } finally {
      await refresh();
    }
  };

  const handleEdit = async () => {
    if (!empresa?.id || !asignacionSel) return;
    try {
      await actualizarAsignacion(asignacionSel.id, {
        uid: formData.uid,
        cedula: formData.cedula,
        nombre: formData.nombre,
        centroTrabajo: formData.centroTrabajo,
        cliente: formData.cliente,
        contrato: formData.contrato,
        unidadNegocio: formData.unidadNegocio,
        proyecto: formData.proyecto,
        sucursal: formData.sucursal,
      } as any);
      toast.success('Asignacion actualizada exitosamente');
      setShowEdit(false);
      resetForm();
    } catch (error) {
      toast.error('Error al actualizar asignacion');
    } finally {
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!empresa?.id) return;
    if (!confirm('¿Estas seguro de eliminar esta asignacion?')) return;
    try {
      await eliminarAsignacion(id);
      toast.success('Asignacion eliminada');
    } catch (error) {
      toast.error('Error al eliminar asignacion');
    } finally {
      await refresh();
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    if (!empresa?.id) return;
    try {
      for (const item of data) {
        // Si el Excel trae el Centro de Trabajo pero dejo Cliente/Contrato/etc
        // vacios, se completan con el maestro SAP antes de guardar.
        const completo = autollenarPorCentro(item.centroTrabajo || '', { ...FORM_INICIAL, ...item });
        await crearAsignacion({
          empresaId: empresa.id,
          uid: completo.uid || '',
          cedula: completo.cedula || '',
          nombre: completo.nombre || '',
          centroTrabajo: completo.centroTrabajo || '',
          cliente: completo.cliente || '',
          contrato: completo.contrato || '',
          unidadNegocio: completo.unidadNegocio || '',
          proyecto: completo.proyecto || '',
          sucursal: completo.sucursal || '',
        } as any);
      }
      toast.success(`${data.length} asignaciones cargadas exitosamente`);
      setShowUpload(false);
    } finally {
      await refresh();
    }
  };

  const resetForm = () => setFormData({ ...FORM_INICIAL });

  const openEdit = (asignacion: AsignacionCompleta) => {
    setAsignacionSel(asignacion);
    setFormData({
      uid: asignacion.uid || '',
      cedula: asignacion.cedula || '',
      nombre: asignacion.nombre || '',
      centroTrabajo: asignacion.centroTrabajo || '',
      cliente: asignacion.cliente || '',
      contrato: asignacion.contrato || '',
      unidadNegocio: asignacion.unidadNegocio || '',
      proyecto: asignacion.proyecto || '',
      sucursal: asignacion.sucursal || '',
    });
    setShowEdit(true);
  };

  const columns: Column<AsignacionCompleta>[] = [
    {
      key: 'centroTrabajo',
      label: 'Centro Trabajo',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.centroTrabajo}</span>
        </div>
      ),
    },
    {
      key: 'nombre',
      label: 'Solicitante',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm truncate">{item.nombre || '-'}</p>
            {item.uid && <p className="text-[11px] text-muted-foreground truncate">{item.uid}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'cliente',
      label: 'Cliente / Contrato',
      render: (item) => (
        <div className="text-xs leading-tight">
          <p className="font-mono font-medium">{item.cliente || '-'} <span className="font-sans text-muted-foreground">{nombreCliente(item.cliente)}</span></p>
          <p className="font-mono text-muted-foreground">{item.contrato || '-'} <span className="font-sans">{nombreContrato(item.contrato)}</span></p>
        </div>
      ),
    },
    {
      key: 'unidadNegocio',
      label: 'Unidad Negocio / Proyecto / Sucursal',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="font-mono text-[10px]" title={nombreUnidadNegocio(item.unidadNegocio)}>{item.unidadNegocio || '-'}</Badge>
          <Badge variant="secondary" className="text-[10px]">{item.proyecto || '-'}</Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">{item.sucursal || '-'}</Badge>
        </div>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(item.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const asignacionesFiltradas = filtroCentro === 'todos'
    ? asignaciones
    : asignaciones.filter(a => a.centroTrabajo === filtroCentro);

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Asignaciones
            </h1>
            <p className="text-muted-foreground mt-1">
              {asignaciones.length} asignaciones registradas · Centro de Trabajo → Cliente / Contrato / Unidad de Negocio / Proyecto / Sucursal (SAP)
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Carga Masiva
            </Button>
            <Button onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Asignacion
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600/80">Total</p>
                <p className="text-2xl font-bold text-blue-700">{asignaciones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600/80">Con Cliente SAP</p>
                <p className="text-2xl font-bold text-green-700">
                  {asignaciones.filter(a => !!a.cliente).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600/80">Centros</p>
                <p className="text-2xl font-bold text-purple-700">{centros.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-2 mb-6"
      >
        <Button
          variant={filtroCentro === 'todos' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroCentro('todos')}
        >
          Todos ({asignaciones.length})
        </Button>
        {centros.map(centro => (
          <Button
            key={centro}
            variant={filtroCentro === centro ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setFiltroCentro(centro)}
          >
            {centro} ({asignaciones.filter(a => a.centroTrabajo === centro).length})
          </Button>
        ))}
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DataTable
          columns={columns}
          data={asignacionesFiltradas}
          searchPlaceholder="Buscar asignacion..."
          emptyMessage="No hay asignaciones registradas"
        />
      </motion.div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carga masiva de asignaciones</DialogTitle>
            <DialogDescription>
              Suba el Excel con Centro de Trabajo, Cliente, Contrato, Unidad de Negocio, Proyecto y Sucursal (los mismos codigos que en SAP).
            </DialogDescription>
          </DialogHeader>
          <ExcelUpload templateKey="asignaciones" onUpload={handleBulkUpload} />
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Asignacion</DialogTitle>
            <DialogDescription>
              Completa los datos para crear una nueva asignacion
            </DialogDescription>
          </DialogHeader>
          <CamposFormularioAsignacion formData={formData} setFormData={setFormData} onCentroTrabajoChange={handleCentroTrabajoChange} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Crear Asignacion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Asignacion</DialogTitle>
            <DialogDescription>
              Modifica los datos de la asignacion
            </DialogDescription>
          </DialogHeader>
          <CamposFormularioAsignacion formData={formData} setFormData={setFormData} onCentroTrabajoChange={handleCentroTrabajoChange} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
