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
  Package,
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
} from 'lucide-react';
import { 
  obtenerProductos, 
  crearProducto, 
  actualizarProducto, 
  eliminarProducto 
} from '@/lib/firestore';
import type { Producto } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney } from '@/lib/format';

export default function ProductosPage() {
  const { empresa } = useCompany();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [productoSel, setProductoSel] = useState<Producto | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos');

  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    descripcion: '',
    grupo: '',
    unidad: '',
    precioUnitario: 0,
    cuentaMayor: '',
    nombreCuentaMayor: '',
    indicadorImpuestos: '',
    stockMinimo: 0,
    stockMaximo: 0,
  });

  const refresh = async () => { if(!empresa?.id) return; const prods = await obtenerProductos(empresa.id); setProductos(prods); }

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    refresh().finally(() => setCargando(false));
  }, [empresa?.id]);

  const grupos = [...new Set(productos.map(p => p.grupo).filter((g): g is string => !!g))];

  const handleCreate = async () => {
    if (!empresa?.id) return;
    try {
      await crearProducto({ ...formData, empresaId: empresa.id, activo: true } as any);
      toast.success('Producto creado exitosamente');
      setShowCreate(false);
      resetForm();
    } catch (error) {
      toast.error('Error al crear producto');
    } finally {
      await refresh();
    }
  };

  const handleEdit = async () => {
    if (!empresa?.id || !productoSel) return;
    try {
      await actualizarProducto(productoSel.id, formData);
      toast.success('Producto actualizado exitosamente');
      setShowEdit(false);
      resetForm();
    } catch (error) {
      toast.error('Error al actualizar producto');
    } finally {
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!empresa?.id) return;
    if (!confirm('¿Estas seguro de eliminar este producto?')) return;
    try {
      await eliminarProducto(id);
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error('Error al eliminar producto');
    } finally {
      await refresh();
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    if (!empresa?.id) return;
    try {
      for (const item of data) {
        await crearProducto({ ...item, empresaId: empresa.id, nombreCuentaMayor: item.nombreCuentaMayor || '', indicadorImpuestos: item.indicadorImpuestos || '', activo: true });
      }
      toast.success(`${data.length} productos cargados exitosamente`);
      setShowUpload(false);
    } finally {
      await refresh();
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      descripcion: '',
      grupo: '',
      unidad: '',
      precioUnitario: 0,
      cuentaMayor: '',
      nombreCuentaMayor: '',
      indicadorImpuestos: '',
      stockMinimo: 0,
      stockMaximo: 0,
    });
  };

  const openEdit = (producto: Producto) => {
    setProductoSel(producto);
    setFormData({
      codigo: producto.codigo || '',
      descripcion: producto.descripcion || '',
      grupo: producto.grupo || '',
      unidad: producto.unidad || '',
      precioUnitario: producto.precioUnitario || 0,
      cuentaMayor: producto.cuentaMayor || '',
      nombreCuentaMayor: producto.nombreCuentaMayor || '',
      indicadorImpuestos: producto.indicadorImpuestos || '',
      stockMinimo: producto.stockMinimo || 0,
      stockMaximo: producto.stockMaximo || 0,
    });
    setShowEdit(true);
  };

  const openDetail = (producto: Producto) => {
    setProductoSel(producto);
    setShowDetail(true);
  };

  const columns: Column<Producto>[] = [
    {
      key: 'codigo',
      label: 'Codigo',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm font-bold text-primary">{item.codigo}</span>
      ),
    },
    {
      key: 'descripcion',
      label: 'Descripcion',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.descripcion}</p>
          {item.cuentaMayor && (
            <p className="text-xs text-muted-foreground mt-0.5">Cta: {item.cuentaMayor}</p>
          )}
        </div>
      ),
    },
    {
      key: 'grupo',
      label: 'Grupo',
      sortable: true,
      render: (item) => (
        <Badge variant="secondary">{item.grupo || '—'}</Badge>
      ),
    },
    {
      key: 'unidad',
      label: 'Unidad',
      sortable: true,
    },
    {
      key: 'precioUnitario',
      label: 'Precio',
      sortable: true,
      render: (item) => (
        <span className="font-medium">
          {formatMoney(item.precioUnitario || 0)}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetail(item)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(item)}
          >
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

  const productosFiltrados = filtroGrupo === 'todos' 
    ? productos 
    : productos.filter(p => p.grupo === filtroGrupo);

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
              Productos
            </h1>
            <p className="text-muted-foreground mt-1">
              {productos.length} productos registrados
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUpload(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Carga Masiva
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
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
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600/80">Total</p>
                <p className="text-2xl font-bold text-blue-700">{productos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600/80">Grupos</p>
                <p className="text-2xl font-bold text-purple-700">{grupos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600/80">Con Precio</p>
                <p className="text-2xl font-bold text-green-700">
                  {productos.filter(p => p.precioUnitario > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600/80">Sin Precio</p>
                <p className="text-2xl font-bold text-amber-700">
                  {productos.filter(p => !p.precioUnitario || p.precioUnitario === 0).length}
                </p>
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
          variant={filtroGrupo === 'todos' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroGrupo('todos')}
        >
          Todos ({productos.length})
        </Button>
        {grupos.map(grupo => (
          <Button
            key={grupo}
            variant={filtroGrupo === grupo ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setFiltroGrupo(grupo)}
          >
            {grupo} ({productos.filter(p => p.grupo === grupo).length})
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
          data={productosFiltrados}
          searchPlaceholder="Buscar producto..."
          onRowClick={openDetail}
          emptyMessage="No hay productos registrados"
        />
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
            <DialogDescription>
              Completa los datos para crear un nuevo producto
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Codigo *</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="P001"
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Input
                value={formData.grupo}
                onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                placeholder="Papeleria"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Descripcion *</Label>
              <Input
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Papel Bond Carta 500 hojas"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad *</Label>
              <Input
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                placeholder="Rollo"
              />
            </div>
            <div className="space-y-2">
              <Label>Precio Unitario</Label>
              <Input
                type="number"
                value={formData.precioUnitario}
                onChange={(e) => setFormData({ ...formData, precioUnitario: Number(e.target.value) })}
                placeholder="25000"
              />
            </div>
            <div className="space-y-2">
              <Label>Cuenta Mayor</Label>
              <Input
                value={formData.cuentaMayor}
                onChange={(e) => setFormData({ ...formData, cuentaMayor: e.target.value })}
                placeholder="110501"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre Cuenta Mayor</Label>
              <Input
                value={formData.nombreCuentaMayor}
                onChange={(e) => setFormData({ ...formData, nombreCuentaMayor: e.target.value })}
                placeholder="Papeleria y utiles de oficina"
              />
            </div>
            <div className="space-y-2">
              <Label>Indicador Impuestos (SAP)</Label>
              <Input
                value={formData.indicadorImpuestos}
                onChange={(e) => setFormData({ ...formData, indicadorImpuestos: e.target.value })}
                placeholder="IVAD05"
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Minimo</Label>
              <Input
                type="number"
                value={formData.stockMinimo}
                onChange={(e) => setFormData({ ...formData, stockMinimo: Number(e.target.value) })}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Maximo</Label>
              <Input
                type="number"
                value={formData.stockMaximo}
                onChange={(e) => setFormData({ ...formData, stockMaximo: Number(e.target.value) })}
                placeholder="100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Crear Producto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los datos del producto
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Codigo *</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Input
                value={formData.grupo}
                onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Descripcion *</Label>
              <Input
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad *</Label>
              <Input
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio Unitario</Label>
              <Input
                type="number"
                value={formData.precioUnitario}
                onChange={(e) => setFormData({ ...formData, precioUnitario: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cuenta Mayor</Label>
              <Input
                value={formData.cuentaMayor}
                onChange={(e) => setFormData({ ...formData, cuentaMayor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre Cuenta Mayor</Label>
              <Input
                value={formData.nombreCuentaMayor}
                onChange={(e) => setFormData({ ...formData, nombreCuentaMayor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Indicador Impuestos (SAP)</Label>
              <Input
                value={formData.indicadorImpuestos}
                onChange={(e) => setFormData({ ...formData, indicadorImpuestos: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Minimo</Label>
              <Input
                type="number"
                value={formData.stockMinimo}
                onChange={(e) => setFormData({ ...formData, stockMinimo: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Maximo</Label>
              <Input
                type="number"
                value={formData.stockMaximo}
                onChange={(e) => setFormData({ ...formData, stockMaximo: Number(e.target.value) })}
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

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del Producto</DialogTitle>
            <DialogDescription>
              Informacion completa del producto
            </DialogDescription>
          </DialogHeader>
          {productoSel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Codigo</p>
                  <p className="font-mono font-bold text-primary">{productoSel.codigo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupo</p>
                  <Badge variant="secondary">{productoSel.grupo}</Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Descripcion</p>
                  <p className="font-medium">{productoSel.descripcion}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unidad</p>
                  <p className="font-medium">{productoSel.unidad}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precio Unitario</p>
                  <p className="font-bold text-lg">{formatMoney(productoSel.precioUnitario || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cuenta Mayor</p>
                  <p className="font-mono">{productoSel.cuentaMayor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stock Minimo / Maximo</p>
                  <p className="font-medium">{productoSel.stockMinimo || 0} / {productoSel.stockMaximo || 0}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
            {productoSel && (
              <Button onClick={() => {
                setShowDetail(false);
                openEdit(productoSel);
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
            templateKey="productos"
            onUpload={handleBulkUpload}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
