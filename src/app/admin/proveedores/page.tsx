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
  Store,
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  FileSpreadsheet,
  Users,
  MapPin,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  obtenerProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from '@/lib/firestore';
import type { Proveedor } from '@/types';
import toast from 'react-hot-toast';

export default function ProveedoresPage() {
  const { empresa } = useCompany();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [proveedorSel, setProveedorSel] = useState<Proveedor | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  const [formData, setFormData] = useState({
    codigo: '',
    descripcion: '',
    grupoArticulo: '',
    nit: '',
    razonSocial: '',
    contacto: '',
    email: '',
    telefono: '',
    ciudad: '',
    estado: 'Activo' as 'Activo' | 'Inactivo',
  });

  const refresh = async () => { if(!empresa?.id) return; const provs = await obtenerProveedores(empresa.id); setProveedores(provs); }

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    refresh().finally(() => setCargando(false));
  }, [empresa?.id]);

  const ciudades = [...new Set(proveedores.map(p => p.ciudad).filter(Boolean))];

  const handleCreate = async () => {
    if (!empresa?.id) return;
    try {
      await crearProveedor({
        empresaId: empresa.id,
        codigo: formData.codigo,
        descripcion: formData.razonSocial || formData.descripcion,
        grupoArticulo: formData.grupoArticulo,
        precios: {},
        nit: formData.nit,
        razonSocial: formData.razonSocial,
        contacto: formData.contacto,
        email: formData.email,
        telefono: formData.telefono,
        ciudad: formData.ciudad,
        estado: formData.estado,
      });
      toast.success('Proveedor creado exitosamente');
      setShowCreate(false);
      resetForm();
    } catch (error) {
      toast.error('Error al crear proveedor');
    } finally {
      await refresh();
    }
  };

  const handleEdit = async () => {
    if (!empresa?.id || !proveedorSel) return;
    try {
      await actualizarProveedor(proveedorSel.id, {
        codigo: formData.codigo,
        descripcion: formData.razonSocial || formData.descripcion,
        grupoArticulo: formData.grupoArticulo,
        nit: formData.nit,
        razonSocial: formData.razonSocial,
        contacto: formData.contacto,
        email: formData.email,
        telefono: formData.telefono,
        ciudad: formData.ciudad,
        estado: formData.estado,
      });
      toast.success('Proveedor actualizado exitosamente');
      setShowEdit(false);
      resetForm();
    } catch (error) {
      toast.error('Error al actualizar proveedor');
    } finally {
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!empresa?.id) return;
    if (!confirm('¿Estas seguro de eliminar este proveedor?')) return;
    try {
      await eliminarProveedor(id);
      toast.success('Proveedor eliminado');
    } catch (error) {
      toast.error('Error al eliminar proveedor');
    } finally {
      await refresh();
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    if (!empresa?.id) return;
    try {
      for (const item of data) {
        await crearProveedor({
          empresaId: empresa.id,
          codigo: item.nit || item.codigo || '',
          descripcion: item.razonSocial || item.descripcion || '',
          grupoArticulo: item.grupoArticulo || '',
          precios: {},
          nit: item.nit || '',
          razonSocial: item.razonSocial || '',
          contacto: item.contacto || '',
          email: item.email || '',
          telefono: item.telefono || '',
          ciudad: item.ciudad || '',
          estado: item.estado || 'Activo',
        });
      }
      toast.success(`${data.length} proveedores cargados exitosamente`);
      setShowUpload(false);
    } finally {
      await refresh();
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      descripcion: '',
      grupoArticulo: '',
      nit: '',
      razonSocial: '',
      contacto: '',
      email: '',
      telefono: '',
      ciudad: '',
      estado: 'Activo',
    });
  };

  const openEdit = (proveedor: Proveedor) => {
    setProveedorSel(proveedor);
    setFormData({
      codigo: proveedor.codigo || '',
      descripcion: proveedor.descripcion || '',
      grupoArticulo: proveedor.grupoArticulo || '',
      nit: proveedor.nit || proveedor.codigo || '',
      razonSocial: proveedor.razonSocial || proveedor.descripcion || '',
      contacto: proveedor.contacto || '',
      email: proveedor.email || '',
      telefono: proveedor.telefono || '',
      ciudad: proveedor.ciudad || '',
      estado: proveedor.estado || 'Activo',
    });
    setShowEdit(true);
  };

  const openDetail = (proveedor: Proveedor) => {
    setProveedorSel(proveedor);
    setShowDetail(true);
  };

  const columns: Column<Proveedor>[] = [
    {
      key: 'nit',
      label: 'NIT',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm font-bold text-primary">{item.nit || item.codigo}</span>
      ),
    },
    {
      key: 'razonSocial',
      label: 'Razon Social',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.razonSocial || item.descripcion}</p>
          {item.grupoArticulo && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.grupoArticulo}</p>
          )}
        </div>
      ),
    },
    {
      key: 'contacto',
      label: 'Contacto',
      sortable: true,
      render: (item) => (
        <span className="text-sm">{item.contacto || '-'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.email || '-'}</span>
      ),
    },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: true,
      render: (item) => (
        <span className="text-sm">{item.telefono || '-'}</span>
      ),
    },
    {
      key: 'ciudad',
      label: 'Ciudad',
      sortable: true,
      render: (item) => (
        <Badge variant="secondary">{item.ciudad || '-'}</Badge>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (item) => (
        <Badge variant={item.estado === 'Activo' ? 'default' : 'destructive'}>
          {item.estado || 'Activo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openDetail(item)}>
            <Eye className="h-4 w-4" />
          </Button>
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

  const proveedoresFiltrados = filtroEstado === 'todos'
    ? proveedores
    : proveedores.filter(p => (p.estado || 'Activo') === filtroEstado);

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
              Proveedores
            </h1>
            <p className="text-muted-foreground mt-1">
              {proveedores.length} proveedores registrados
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Carga Masiva
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600/80">Total</p>
                <p className="text-2xl font-bold text-blue-700">{proveedores.length}</p>
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
                <p className="text-xs text-green-600/80">Activos</p>
                <p className="text-2xl font-bold text-green-700">
                  {proveedores.filter(p => (p.estado || 'Activo') === 'Activo').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-red-600/80">Inactivos</p>
                <p className="text-2xl font-bold text-red-700">
                  {proveedores.filter(p => p.estado === 'Inactivo').length}
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
                <p className="text-xs text-purple-600/80">Ciudades</p>
                <p className="text-2xl font-bold text-purple-700">{ciudades.length}</p>
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
          variant={filtroEstado === 'todos' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroEstado('todos')}
        >
          Todos ({proveedores.length})
        </Button>
        <Button
          variant={filtroEstado === 'Activo' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroEstado('Activo')}
        >
          Activos ({proveedores.filter(p => (p.estado || 'Activo') === 'Activo').length})
        </Button>
        <Button
          variant={filtroEstado === 'Inactivo' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroEstado('Inactivo')}
        >
          Inactivos ({proveedores.filter(p => p.estado === 'Inactivo').length})
        </Button>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DataTable
          columns={columns}
          data={proveedoresFiltrados}
          searchPlaceholder="Buscar proveedor..."
          onRowClick={openDetail}
          emptyMessage="No hay proveedores registrados"
        />
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Completa los datos para crear un nuevo proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>NIT *</Label>
              <Input
                value={formData.nit}
                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                placeholder="900123456-7"
              />
            </div>
            <div className="space-y-2">
              <Label>Codigo Interno</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="PRV001"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Razon Social *</Label>
              <Input
                value={formData.razonSocial}
                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                placeholder="Distribuidora Nacional S.A.S"
              />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                placeholder="Juan Perez"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@proveedor.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="300 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                placeholder="Bogota"
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo Articulo</Label>
              <Input
                value={formData.grupoArticulo}
                onChange={(e) => setFormData({ ...formData, grupoArticulo: e.target.value })}
                placeholder="Papeleria"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value as 'Activo' | 'Inactivo' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Crear Proveedor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription>
              Modifica los datos del proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>NIT *</Label>
              <Input
                value={formData.nit}
                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Codigo Interno</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Razon Social *</Label>
              <Input
                value={formData.razonSocial}
                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo Articulo</Label>
              <Input
                value={formData.grupoArticulo}
                onChange={(e) => setFormData({ ...formData, grupoArticulo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value as 'Activo' | 'Inactivo' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
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

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del Proveedor</DialogTitle>
            <DialogDescription>
              Informacion completa del proveedor
            </DialogDescription>
          </DialogHeader>
          {proveedorSel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">NIT</p>
                  <p className="font-mono font-bold text-primary">{proveedorSel.nit || proveedorSel.codigo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={proveedorSel.estado === 'Activo' ? 'default' : 'destructive'}>
                    {proveedorSel.estado || 'Activo'}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Razon Social</p>
                  <p className="font-medium">{proveedorSel.razonSocial || proveedorSel.descripcion}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacto</p>
                  <p className="font-medium">{proveedorSel.contacto || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{proveedorSel.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefono</p>
                  <p className="font-medium">{proveedorSel.telefono || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ciudad</p>
                  <p className="font-medium">{proveedorSel.ciudad || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupo Articulo</p>
                  <Badge variant="secondary">{proveedorSel.grupoArticulo || '-'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Codigo Interno</p>
                  <p className="font-mono">{proveedorSel.codigo || '-'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
            {proveedorSel && (
              <Button onClick={() => {
                setShowDetail(false);
                openEdit(proveedorSel);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <ExcelUpload
            templateKey="proveedores"
            onUpload={handleBulkUpload}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
