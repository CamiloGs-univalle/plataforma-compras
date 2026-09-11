'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/DataTable';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Eye,
  Edit,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  obtenerTodasSolicitudesEnTiempoReal,
  actualizarSolicitud,
} from '@/lib/firestore';
import type { Solicitud } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney } from '@/lib/format';

interface PedidoSeguimiento {
  id: string;
  solicitud: Solicitud;
  estadoPedido: 'pendiente' | 'en_transito' | 'entregado' | 'facturado';
  fechaPedido?: Date;
  fechaEntregaEstimada?: Date;
  fechaEntregaReal?: Date;
  proveedor?: string;
  numeroOrden?: string;
  valorTotal?: number;
  observaciones?: string;
}

export default function SeguimientoPedidosPage() {
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pedidoSel, setPedidoSel] = useState<PedidoSeguimiento | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    estadoPedido: 'pendiente',
    proveedor: '',
    numeroOrden: '',
    valorTotal: 0,
    fechaEntregaEstimada: '',
    observaciones: '',
  });

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sol) => {
      setSolicitudes(sol);
      setCargando(false);
    });
    return () => unsub();
  }, [empresa?.id]);

  // Filter only active orders (not completed or cancelled)
  const pedidosActivos = useMemo(() => {
    const computeValorTotal = (s: Solicitud) => {
      const extra = (s as any).valorTotal;
      if (typeof extra === 'number' && extra > 0) return extra;
      return s.items?.reduce((acc: number, item) => {
        const cot = (item as any).cotizaciones?.[(item as any).mejorCotizacionIndex ?? 0];
        return acc + (cot?.total || (item.precioUnitario * item.cantidad) || 0);
      }, 0) || 0;
    };
    return solicitudes
      .filter(s => !(s as any).archivado && (
        s.estado === 'aprobada' || 
        s.estado === 'en_pedido' || 
        s.estado === 'completada'
      ))
      .map(s => ({
        id: s.id,
        solicitud: s,
        estadoPedido: (s as any).estadoPedido || (s.estado === 'completada' ? 'entregado' : 
                      s.estado === 'en_pedido' ? 'en_transito' : 'pendiente'),
        proveedor: (s as any).proveedor || '',
        numeroOrden: (s as any).numeroOrden || `ORD-${s.numero}`,
        valorTotal: computeValorTotal(s),
        fechaEntregaEstimada: (s as any).fechaEntregaEstimada,
        observaciones: (s as any).observaciones || s.observaciones || '',
      } as PedidoSeguimiento));
  }, [solicitudes]);

  const filtrados = pedidosActivos.filter(p => {
    const matchBusqueda = !busqueda ||
      p.solicitud.numero?.toString().includes(busqueda) ||
      p.solicitud.nombreUsuario?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.proveedor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.numeroOrden?.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === 'todos' || p.estadoPedido === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const stats = useMemo(() => ({
    total: pedidosActivos.length,
    pendientes: pedidosActivos.filter(p => p.estadoPedido === 'pendiente').length,
    enTransito: pedidosActivos.filter(p => p.estadoPedido === 'en_transito').length,
    entregados: pedidosActivos.filter(p => p.estadoPedido === 'entregado').length,
    facturados: pedidosActivos.filter(p => p.estadoPedido === 'facturado').length,
    valorTotal: pedidosActivos.reduce((acc, p) => acc + (p.valorTotal || 0), 0),
  }), [pedidosActivos]);

  const openDetail = (pedido: PedidoSeguimiento) => {
    setPedidoSel(pedido);
    setShowDetail(true);
  };

  const openEdit = (pedido: PedidoSeguimiento) => {
    setPedidoSel(pedido);
    setEditForm({
      estadoPedido: pedido.estadoPedido,
      proveedor: pedido.proveedor || '',
      numeroOrden: pedido.numeroOrden || '',
      valorTotal: pedido.valorTotal || 0,
      fechaEntregaEstimada: pedido.fechaEntregaEstimada 
        ? new Date(pedido.fechaEntregaEstimada).toISOString().split('T')[0] 
        : '',
      observaciones: pedido.observaciones || '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!pedidoSel || !empresa?.id) return;
    try {
      const estadoMap = editForm.estadoPedido === 'entregado' ? 'completada' : 
        editForm.estadoPedido === 'en_transito' ? 'en_pedido' :
        editForm.estadoPedido === 'facturado' ? 'completada' : 'aprobada';
      await actualizarSolicitud(pedidoSel.solicitud.id, {
        estado: estadoMap,
        ...(editForm.proveedor && { proveedor: editForm.proveedor }),
        ...(editForm.numeroOrden && { numeroOrden: editForm.numeroOrden }),
        ...(typeof editForm.valorTotal === 'number' && { valorTotal: editForm.valorTotal }),
        ...(editForm.fechaEntregaEstimada && { fechaEntregaEstimada: new Date(editForm.fechaEntregaEstimada) }),
        ...(editForm.observaciones && { observaciones: editForm.observaciones }),
        ...(editForm.estadoPedido && { estadoPedido: editForm.estadoPedido }),
      } as any);
      toast.success('Pedido actualizado exitosamente');
      setShowEdit(false);
    } catch (error) {
      toast.error('Error al actualizar el pedido');
    }
  };

  const columns: Column<PedidoSeguimiento>[] = [
    {
      key: 'numeroOrden',
      label: 'Orden',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm font-bold text-primary">{item.numeroOrden}</span>
      ),
    },
    {
      key: 'solicitud.numero',
      label: 'Solicitud',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">#{item.solicitud.numero}</span>
      ),
    },
    {
      key: 'solicitud.nombreUsuario',
      label: 'Solicitante',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.solicitud.nombreUsuario}</p>
          <p className="text-xs text-muted-foreground">{item.solicitud.centroTrabajo}</p>
        </div>
      ),
    },
    {
      key: 'proveedor',
      label: 'Proveedor',
      sortable: true,
      render: (item) => (
        <span className="font-medium">{item.proveedor || '-'}</span>
      ),
    },
    {
      key: 'valorTotal',
      label: 'Valor',
      sortable: true,
      render: (item) => (
        <span className="font-bold text-green-600">
          {formatMoney(item.valorTotal || 0)}
        </span>
      ),
    },
    {
      key: 'estadoPedido',
      label: 'Estado',
      sortable: true,
      render: (item) => (
        <Badge 
          variant={
            item.estadoPedido === 'entregado' ? 'default' :
            item.estadoPedido === 'en_transito' ? 'secondary' :
            item.estadoPedido === 'facturado' ? 'outline' :
            'secondary'
          }
          className={
            item.estadoPedido === 'entregado' ? 'bg-green-100 text-green-700' :
            item.estadoPedido === 'en_transito' ? 'bg-blue-100 text-blue-700' :
            item.estadoPedido === 'facturado' ? 'bg-purple-100 text-purple-700' :
            'bg-amber-100 text-amber-700'
          }
        >
          {item.estadoPedido === 'pendiente' && '⏳ Pendiente'}
          {item.estadoPedido === 'en_transito' && '🚚 En Transito'}
          {item.estadoPedido === 'entregado' && '✅ Entregado'}
          {item.estadoPedido === 'facturado' && '📄 Facturado'}
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
        </div>
      ),
    },
  ];

  if (cargando) {
    return (
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Seguimiento de Pedidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Control y seguimiento de todos los pedidos activos
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600/80">Total</p>
                <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600/80">Pendientes</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600/80">En Transito</p>
                <p className="text-2xl font-bold text-purple-700">{stats.enTransito}</p>
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
                <p className="text-xs text-green-600/80">Entregados</p>
                <p className="text-2xl font-bold text-green-700">{stats.entregados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600/80">Valor Total</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatMoney(stats.valorTotal)}
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
        className="flex flex-wrap gap-3 mb-6"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, solicitante, proveedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'en_transito', label: 'En Transito' },
            { value: 'entregado', label: 'Entregados' },
            { value: 'facturado', label: 'Facturados' },
          ].map((filtro) => (
            <Button
              key={filtro.value}
              variant={filtroEstado === filtro.value ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFiltroEstado(filtro.value)}
            >
              {filtro.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Vista ampliada sin scroll horizontal — tarjetas grandes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {filtrados.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">No hay pedidos para mostrar</Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map(p => (
              <Card key={p.id} className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-sm" onClick={() => openDetail(p)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm font-bold text-blue-600">{p.numeroOrden}</p>
                      <p className="text-xs text-muted-foreground">Solicitud #{p.solicitud.numero} · {p.solicitud.nombreUsuario}</p>
                    </div>
                    <Badge className={
                      p.estadoPedido === 'entregado' ? 'bg-green-100 text-green-700 border-green-200' :
                      p.estadoPedido === 'en_transito' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      p.estadoPedido === 'facturado' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                      'bg-amber-100 text-amber-700 border-amber-200'
                    } variant="outline">
                      {p.estadoPedido === 'pendiente' && '⏳ Pendiente'}
                      {p.estadoPedido === 'en_transito' && '🚚 En Tránsito'}
                      {p.estadoPedido === 'entregado' && '✅ Entregado'}
                      {p.estadoPedido === 'facturado' && '📄 Facturado'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><span className="font-medium">{p.proveedor || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Centro</span><span className="font-medium truncate ml-2">{p.solicitud.centroTrabajo}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span className="font-medium">{p.solicitud.items?.length || 0}</span></div>
                    <div className="flex justify-between items-center pt-2 border-t"><span className="text-muted-foreground">Valor</span><span className="font-bold text-green-600 text-base">{formatMoney(p.valorTotal || 0)}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1" onClick={(e)=>{e.stopPropagation(); openDetail(p);}}><Eye className="h-4 w-4 mr-1"/> Ver</Button>
                    <Button size="sm" className="flex-1" onClick={(e)=>{e.stopPropagation(); openEdit(p);}}><Edit className="h-4 w-4 mr-1"/> Editar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Tabla completa sin scroll horizontal — solo si hay muchos, paginada */}
        <details className="mt-6">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">Ver como tabla completa (sin scroll lateral, columnas acomodadas)</summary>
          <div className="mt-3">
            <DataTable
              columns={columns}
              data={filtrados}
              searchPlaceholder="Buscar pedido..."
              onRowClick={openDetail}
              emptyMessage="No hay pedidos para mostrar"
              pageSize={50}
            />
          </div>
        </details>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del Pedido</DialogTitle>
          </DialogHeader>
          {pedidoSel && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div>
                  <p className="text-sm text-muted-foreground">Numero de Orden</p>
                  <p className="text-2xl font-bold text-primary">{pedidoSel.numeroOrden}</p>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    pedidoSel.estadoPedido === 'entregado' ? 'bg-green-100 text-green-700 border-green-200' :
                    pedidoSel.estadoPedido === 'en_transito' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    'bg-amber-100 text-amber-700 border-amber-200'
                  }
                >
                  {pedidoSel.estadoPedido === 'pendiente' && '⏳ Pendiente'}
                  {pedidoSel.estadoPedido === 'en_transito' && '🚚 En Transito'}
                  {pedidoSel.estadoPedido === 'entregado' && '✅ Entregado'}
                  {pedidoSel.estadoPedido === 'facturado' && '📄 Facturado'}
                </Badge>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Solicitante</p>
                    <p className="font-medium">{pedidoSel.solicitud.nombreUsuario}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Centro de Trabajo</p>
                    <p className="font-medium">{pedidoSel.solicitud.centroTrabajo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{pedidoSel.proveedor || 'No asignado'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha Solicitud</p>
                    <p className="font-medium">
                      {pedidoSel.solicitud.fechaCreacion?.toLocaleDateString() || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatMoney(pedidoSel.valorTotal || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Items</p>
                    <p className="font-medium">{pedidoSel.solicitud.items?.length || 0} productos</p>
                  </div>
                </div>
              </div>

              {/* Items List — sin scroll, todo visible */}
              {pedidoSel.solicitud.items && pedidoSel.solicitud.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Productos Solicitados</p>
                  <div className="border rounded-lg divide-y">
                    {pedidoSel.solicitud.items.map((item, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.descripcion}</p>
                          <p className="text-xs text-muted-foreground">Codigo: {item.codigoProducto || '-'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">Cantidad: {item.cantidad}</p>
                          {item.precioUnitario && (
                            <p className="text-xs text-muted-foreground">
                              {formatMoney(item.precioUnitario)} / unidad
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Historial</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Solicitud Aprobada</p>
                      <p className="text-xs text-muted-foreground">Orden de compra generada</p>
                    </div>
                  </div>
                  {pedidoSel.estadoPedido === 'en_transito' && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">En Camino</p>
                        <p className="text-xs text-muted-foreground">Pedido en transito al destino</p>
                      </div>
                    </div>
                  )}
                  {pedidoSel.estadoPedido === 'entregado' && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Entregado</p>
                        <p className="text-xs text-muted-foreground">Pedido recibido confirmado</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
            {pedidoSel && (
              <Button onClick={() => {
                setShowDetail(false);
                openEdit(pedidoSel);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Actualizar Estado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Actualizar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Estado del Pedido</Label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm"
                value={editForm.estadoPedido}
                onChange={(e) => setEditForm({ ...editForm, estadoPedido: e.target.value })}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_transito">En Transito</option>
                <option value="entregado">Entregado</option>
                <option value="facturado">Facturado</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input
                  value={editForm.proveedor}
                  onChange={(e) => setEditForm({ ...editForm, proveedor: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>
              <div className="space-y-2">
                <Label>Numero de Orden</Label>
                <Input
                  value={editForm.numeroOrden}
                  onChange={(e) => setEditForm({ ...editForm, numeroOrden: e.target.value })}
                  placeholder="ORD-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Total</Label>
                <Input
                  type="number"
                  value={editForm.valorTotal}
                  onChange={(e) => setEditForm({ ...editForm, valorTotal: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Entrega Estimada</Label>
                <Input
                  type="date"
                  value={editForm.fechaEntregaEstimada}
                  onChange={(e) => setEditForm({ ...editForm, fechaEntregaEstimada: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={editForm.observaciones}
                onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                placeholder="Notas adicionales sobre el pedido..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
