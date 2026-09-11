'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Download,
  Edit,
  Trash2,
  Search,
  Filter,
  Eye,
  FileSpreadsheet,
  MapPin,
  Package,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  obtenerAsignaciones,
  crearAsignacion,
  actualizarAsignacion,
  eliminarAsignacion,
} from '@/lib/firestore';
import type { Asignacion } from '@/types';
import toast from 'react-hot-toast';

interface AsignacionCompleta extends Asignacion {
  producto?: string;
  cantidad?: number;
  frecuencia?: string;
  responsable?: string;
  estado?: string;
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

  const [formData, setFormData] = useState({
    uid: '',
    cedula: '',
    centroTrabajo: '',
    cliente: '',
    contrato: '',
    unidadNegocio: '',
    proyecto: '',
    sucursal: '',
    producto: '',
    cantidad: 0,
    frecuencia: '',
    responsable: '',
    estado: 'Activa',
  });

  const refresh = async () => { if (!empresa?.id) return; const asigs = await obtenerAsignaciones(empresa.id); setAsignaciones(asigs as AsignacionCompleta[]); };

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    refresh().finally(() => setCargando(false));
  }, [empresa?.id]);

  const centros = [...new Set(asignaciones.map(a => a.centroTrabajo).filter(Boolean))];

  const handleCreate = async () => {
    if (!empresa?.id) return;
    try {
      await crearAsignacion({
        empresaId: empresa.id,
        uid: formData.uid,
        cedula: formData.cedula,
        centroTrabajo: formData.centroTrabajo,
        cliente: formData.cliente,
        contrato: formData.contrato,
        unidadNegocio: formData.unidadNegocio,
        proyecto: formData.proyecto,
        sucursal: formData.sucursal,
        producto: formData.producto,
        cantidad: formData.cantidad,
        frecuencia: formData.frecuencia,
        responsable: formData.responsable,
        estado: formData.estado,
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
        centroTrabajo: formData.centroTrabajo,
        cliente: formData.cliente,
        contrato: formData.contrato,
        unidadNegocio: formData.unidadNegocio,
        proyecto: formData.proyecto,
        sucursal: formData.sucursal,
        producto: formData.producto,
        cantidad: formData.cantidad,
        frecuencia: formData.frecuencia,
        responsable: formData.responsable,
        estado: formData.estado,
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
        await crearAsignacion({
          empresaId: empresa.id,
          uid: item.uid || '',
          cedula: item.cedula || '',
          centroTrabajo: item.centroTrabajo || '',
          cliente: item.cliente || '',
          contrato: item.contrato || '',
          unidadNegocio: item.unidadNegocio || '',
          proyecto: item.proyecto || '',
          sucursal: item.sucursal || '',
          producto: item.producto || '',
          cantidad: item.cantidad || 0,
          frecuencia: item.frecuencia || '',
          responsable: item.responsable || '',
          estado: item.estado || 'Activa',
        } as any);
      }
      toast.success(`${data.length} asignaciones cargadas exitosamente`);
      setShowUpload(false);
    } finally {
      await refresh();
    }
  };

  const resetForm = () => {
    setFormData({
      uid: '',
      cedula: '',
      centroTrabajo: '',
      cliente: '',
      contrato: '',
      unidadNegocio: '',
      proyecto: '',
      sucursal: '',
      producto: '',
      cantidad: 0,
      frecuencia: '',
      responsable: '',
      estado: 'Activa',
    });
  };

  const openEdit = (asignacion: AsignacionCompleta) => {
    setAsignacionSel(asignacion);
    setFormData({
      uid: asignacion.uid || '',
      cedula: asignacion.cedula || '',
      centroTrabajo: asignacion.centroTrabajo || '',
      cliente: asignacion.cliente || '',
      contrato: asignacion.contrato || '',
      unidadNegocio: asignacion.unidadNegocio || '',
      proyecto: asignacion.proyecto || '',
      sucursal: asignacion.sucursal || '',
      producto: asignacion.producto || '',
      cantidad: asignacion.cantidad || 0,
      frecuencia: asignacion.frecuencia || '',
      responsable: asignacion.responsable || '',
      estado: asignacion.estado || 'Activa',
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
      key: 'producto',
      label: 'Producto',
      sortable: true,
      render: (item) => (
        <span className="text-sm">{item.producto || '-'}</span>
      ),
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm font-bold">{item.cantidad || '-'}</span>
      ),
    },
    {
      key: 'frecuencia',
      label: 'Frecuencia',
      sortable: true,
      render: (item) => (
        <Badge variant="secondary">{item.frecuencia || '-'}</Badge>
      ),
    },
    {
      key: 'responsable',
      label: 'Responsable',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{item.responsable || item.cliente || '-'}</span>
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (item) => (
        <Badge variant={item.estado === 'Activa' ? 'default' : 'destructive'}>
          {item.estado || 'Activa'}
        </Badge>
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
              {asignaciones.length} asignaciones registradas
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Carga Masiva
            </Button>
            <Button onClick={() => setShowCreate(true)}>
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
                <p className="text-xs text-green-600/80">Activas</p>
                <p className="text-2xl font-bold text-green-700">
                  {asignaciones.filter(a => (a.estado || 'Activa') === 'Activa').length}
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

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Asignacion</DialogTitle>
            <DialogDescription>
              Completa los datos para crear una nueva asignacion
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Centro Trabajo *</Label>
              <Input
                value={formData.centroTrabajo}
                onChange={(e) => setFormData({ ...formData, centroTrabajo: e.target.value })}
                placeholder="Centro Norte"
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                placeholder="Empresa XYZ"
              />
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Input
                value={formData.producto}
                onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                placeholder="Papel Bond"
              />
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Input
                value={formData.frecuencia}
                onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                placeholder="Mensual"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                placeholder="Juan Perez"
              />
            </div>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Input
                value={formData.contrato}
                onChange={(e) => setFormData({ ...formData, contrato: e.target.value })}
                placeholder="CONT-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad Negocio</Label>
              <Input
                value={formData.unidadNegocio}
                onChange={(e) => setFormData({ ...formData, unidadNegocio: e.target.value })}
                placeholder="Operaciones"
              />
            </div>
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Input
                value={formData.proyecto}
                onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
                placeholder="Proyecto Alpha"
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Input
                value={formData.sucursal}
                onChange={(e) => setFormData({ ...formData, sucursal: e.target.value })}
                placeholder="Sede Principal"
              />
            </div>
          </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Asignacion</DialogTitle>
            <DialogDescription>
              Modifica los datos de la asignacion
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Centro Trabajo *</Label>
              <Input
                value={formData.centroTrabajo}
                onChange={(e) => setFormData({ ...formData, centroTrabajo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Input
                value={formData.producto}
                onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Input
                value={formData.frecuencia}
                onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Input
                value={formData.contrato}
                onChange={(e) => setFormData({ ...formData, contrato: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad Negocio</Label>
              <Input
                value={formData.unidadNegocio}
                onChange={(e) => setFormData({ ...formData, unidadNegocio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Input
                value={formData.proyecto}
                onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Input
                value={formData.sucursal}
                onChange={(e) => setFormData({ ...formData, sucursal: e.target.value })}
              />
            </div>
          </div>
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
