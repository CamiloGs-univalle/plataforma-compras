'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/DataTable';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Eye,
  Edit,
  Upload,
  Download,
  Filter,
  Calendar,
  Building2,
  Receipt,
} from 'lucide-react';
import {
  obtenerTodasSolicitudesEnTiempoReal,
  actualizarSolicitud,
} from '@/lib/firestore';
import type { Solicitud } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney } from '@/lib/format';

interface Factura {
  id: string;
  numero: string;
  solicitudId: string;
  solicitudNumero: number;
  proveedor: string;
  proveedorNIT: string;
  valorBruto: number;
  iva: number;
  valorTotal: number;
  estado: 'pendiente' | 'en_revision' | 'aprobada' | 'pagada' | 'rechazada';
  fechaFactura: Date;
  fechaAprobacion?: Date;
  fechaPago?: Date;
  centroTrabajo: string;
  solicitante: string;
  observaciones?: string;
}

export default function FacturacionPage() {
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [facturaSel, setFacturaSel] = useState<Factura | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [facturaEstados, setFacturaEstados] = useState<Record<string, Factura['estado']>>({});

  // Form state
  const [formData, setFormData] = useState({
    solicitudId: '',
    proveedor: '',
    proveedorNIT: '',
    valorBruto: 0,
    iva: 19,
    fechaFactura: '',
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

  // Genera facturas desde solicitudes reales con valor calculado de cotizaciones
  const facturas = useMemo(() => {
    const calcValor = (s: Solicitud) => {
      const total = s.items?.reduce((acc, it) => {
        const cot = (it as any).cotizaciones?.[(it as any).mejorCotizacionIndex ?? 0];
        if (cot?.total) return acc + cot.total;
        if (cot?.precioConIva) return acc + cot.precioConIva * (it.cantidad || 1);
        return acc + (it.precioUnitario || 0) * (it.cantidad || 1);
      }, 0) || 0;
      return total || (s as any).valorTotal || 0;
    };
    return solicitudes
      .filter(s => !(s as any).archivado && ['completada','aprobada','en_pedido'].includes(s.estado))
      .map((s, index) => {
        const bruto = calcValor(s);
        const iva = Math.round(bruto * 0.19);
        const total = bruto + iva;
        const estadoPersistido = (s as any).facturaEstado as Factura['estado'] | undefined;
        const estado = facturaEstados[`fact-${s.id}`] || estadoPersistido || 'pendiente';
        const prov = s.items?.[0]?.cotizaciones?.[0]?.proveedor || (s as any).proveedor || 'Proveedor Pendiente';
        return {
          id: `fact-${s.id}`,
          numero: `FAC-${String(s.numero || index + 1).padStart(4, '0')}`,
          solicitudId: s.id,
          solicitudNumero: s.numero || 0,
          proveedor: prov,
          proveedorNIT: (s as any).proveedorNIT || '900000000',
          valorBruto: bruto,
          iva,
          valorTotal: total,
          estado,
          fechaFactura: (s as any).fechaPedido ? new Date((s as any).fechaPedido) : new Date(s.fechaActualizacion || s.fechaCreacion),
          centroTrabajo: s.centroTrabajo,
          solicitante: s.nombreUsuario,
        } as Factura;
      });
  }, [solicitudes, facturaEstados]);

  const filtradas = facturas.filter(f => {
    const matchBusqueda = !busqueda ||
      f.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.solicitudNumero.toString().includes(busqueda);
    const matchEstado = filtroEstado === 'todos' || f.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const stats = useMemo(() => ({
    total: facturas.length,
    pendientes: facturas.filter(f => f.estado === 'pendiente').length,
    enRevision: facturas.filter(f => f.estado === 'en_revision').length,
    aprobadas: facturas.filter(f => f.estado === 'aprobada').length,
    pagadas: facturas.filter(f => f.estado === 'pagada').length,
    rechazadas: facturas.filter(f => f.estado === 'rechazada').length,
    valorTotal: facturas.reduce((acc, f) => acc + f.valorTotal, 0),
    valorIVA: facturas.reduce((acc, f) => acc + f.iva, 0),
  }), [facturas]);

  const openDetail = (factura: Factura) => {
    setFacturaSel(factura);
    setShowDetail(true);
  };

  const cambiarEstado = async (factura: Factura, nuevo: Factura['estado']) => {
    try {
      const now = new Date();
      const payload: any = { facturaEstado: nuevo, fechaActualizacion: now };
      if (nuevo === 'en_revision') payload.fechaRevision = now;
      if (nuevo === 'aprobada') payload.fechaAprobacion = now;
      if (nuevo === 'pagada') payload.fechaPago = now;
      await actualizarSolicitud(factura.solicitudId, payload);
      setFacturaEstados(prev => ({ ...prev, [factura.id]: nuevo }));
      if (facturaSel?.id === factura.id) setFacturaSel({ ...factura, estado: nuevo } as Factura);
      toast.success(`Factura ${factura.numero} → ${nuevo}`);
    } catch {
      toast.error('No se pudo actualizar la factura');
    }
  };

  const handleCreateFactura = () => {
    if (!formData.proveedor || !formData.proveedorNIT || !formData.valorBruto || !formData.fechaFactura) {
      toast.error('Completa proveedor, NIT, valor y fecha');
      return;
    }
    // Crea solicitud dummy en estado pagada para demo o solo toast + local
    const bruto = formData.valorBruto;
    const nueva: Factura = {
      id: `fact-manual-${Date.now()}`,
      numero: `FAC-${String(facturas.length + 1).padStart(4, '0')}`,
      solicitudId: formData.solicitudId || `manual-${Date.now()}`,
      solicitudNumero: 0,
      proveedor: formData.proveedor,
      proveedorNIT: formData.proveedorNIT,
      valorBruto: bruto,
      iva: Math.round(bruto * (formData.iva/100)),
      valorTotal: bruto + Math.round(bruto * (formData.iva/100)),
      estado: 'pendiente',
      fechaFactura: new Date(formData.fechaFactura),
      centroTrabajo: empresa?.nombre || '',
      solicitante: usuario?.email || '',
      observaciones: formData.observaciones,
    };
    // Optimista: inyecta como solicitud virtual
    setFacturaEstados(prev => ({ ...prev, [nueva.id]: 'pendiente' }));
    // @ts-ignore empuja a solicitudes locales para que aparezca en tabla
    setSolicitudes(prev => [...prev, {
      id: nueva.solicitudId, numero: parseInt(nueva.numero.replace('FAC-',''))||0,
      empresaId: empresa?.id || '', usuario: usuario?.uid || '', nombreUsuario: nueva.solicitante, emailUsuario: nueva.solicitante,
      centroTrabajo: nueva.centroTrabajo, prioridad:'media', estado:'completada',
      items:[{ codigoProducto:'MANUAL', descripcion: nueva.proveedor, cantidad:1, precioUnitario: bruto } as any],
      facturaEstado:'pendiente', valorTotal: bruto, fechaCreacion: nueva.fechaFactura, fechaActualizacion: nueva.fechaFactura,
    } as any]);
    toast.success(`Factura ${nueva.numero} creada en Pendiente`);
    setShowCreate(false);
    setFormData({ solicitudId:'', proveedor:'', proveedorNIT:'', valorBruto:0, iva:19, fechaFactura:'', observaciones:'' });
  };

  const columns: Column<Factura>[] = [
    {
      key: 'numero',
      label: 'Factura',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm font-bold text-primary">{item.numero}</span>
      ),
    },
    {
      key: 'solicitudNumero',
      label: 'Solicitud',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">#{item.solicitudNumero}</span>
      ),
    },
    {
      key: 'proveedor',
      label: 'Proveedor',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.proveedor}</p>
          <p className="text-xs text-muted-foreground">NIT: {item.proveedorNIT}</p>
        </div>
      ),
    },
    {
      key: 'solicitante',
      label: 'Solicitante',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.solicitante}</p>
          <p className="text-xs text-muted-foreground">{item.centroTrabajo}</p>
        </div>
      ),
    },
    {
      key: 'valorTotal',
      label: 'Valor',
      sortable: true,
      render: (item) => (
        <div className="text-right">
          <p className="font-bold text-green-600">{formatMoney(item.valorTotal)}</p>
          <p className="text-xs text-muted-foreground">IVA incluido</p>
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (item) => (
        <Badge 
          variant="outline"
          className={
            item.estado === 'pagada' ? 'bg-green-100 text-green-700 border-green-200' :
            item.estado === 'aprobada' ? 'bg-blue-100 text-blue-700 border-blue-200' :
            item.estado === 'rechazada' ? 'bg-red-100 text-red-700 border-red-200' :
            item.estado === 'en_revision' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-gray-100 text-gray-700 border-gray-200'
          }
        >
          {item.estado === 'pendiente' && '⏳ Pendiente'}
          {item.estado === 'en_revision' && '🔍 En Revision'}
          {item.estado === 'aprobada' && '✅ Aprobada'}
          {item.estado === 'pagada' && '💰 Pagada'}
          {item.estado === 'rechazada' && '❌ Rechazada'}
        </Badge>
      ),
    },
    {
      key: 'fechaFactura',
      label: 'Fecha',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.fechaFactura.toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-center',
      render: (item) => {
        const next: Record<string, Factura['estado'] | null> = { pendiente:'en_revision', en_revision:'aprobada', aprobada:'pagada', pagada:null, rechazada:null };
        const n = next[item.estado];
        return (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openDetail(item)} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
          {n && <Button variant="ghost" size="sm" onClick={()=>cambiarEstado(item, n)} title={`Pasar a ${n}`} className="text-blue-600 hover:text-blue-700">→ {n === 'en_revision'?'Revisión': n==='aprobada'?'Aprobar':'Pagar'}</Button>}
          {item.estado!=='rechazada' && item.estado!=='pagada' && <Button variant="ghost" size="sm" onClick={()=>cambiarEstado(item,'rechazada')} className="text-red-500 hover:text-red-600" title="Rechazar"><AlertCircle className="h-4 w-4"/></Button>}
        </div>
        );
      },
    },
  ];

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
              Facturacion
            </h1>
            <p className="text-muted-foreground mt-1">
              Control de facturas y pagos
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
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
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600/80">Total Facturas</p>
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
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600/80">Aprobadas</p>
                <p className="text-2xl font-bold text-green-700">{stats.aprobadas}</p>
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

      {/* IVA Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Base Gravable</p>
                <p className="text-lg font-bold">{formatMoney(stats.valorTotal - stats.valorIVA)}</p>
              </div>
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">IVA (19%)</p>
                <p className="text-lg font-bold text-amber-600">{formatMoney(stats.valorIVA)}</p>
              </div>
              <Receipt className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total con IVA</p>
                <p className="text-lg font-bold text-green-600">{formatMoney(stats.valorTotal)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-500" />
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
            placeholder="Buscar por numero, proveedor, solicitante..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'todos', label: 'Todas' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'en_revision', label: 'En Revision' },
            { value: 'aprobada', label: 'Aprobadas' },
            { value: 'pagada', label: 'Pagadas' },
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

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DataTable
          columns={columns}
          data={filtradas}
          searchPlaceholder="Buscar factura..."
          onRowClick={openDetail}
          emptyMessage="No hay facturas para mostrar"
        />
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Factura</DialogTitle>
          </DialogHeader>
          {facturaSel && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div>
                  <p className="text-sm text-muted-foreground">Numero de Factura</p>
                  <p className="text-2xl font-bold text-primary">{facturaSel.numero}</p>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    facturaSel.estado === 'pagada' ? 'bg-green-100 text-green-700 border-green-200' :
                    facturaSel.estado === 'aprobada' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    'bg-amber-100 text-amber-700 border-amber-200'
                  }
                >
                  {facturaSel.estado === 'pendiente' && '⏳ Pendiente'}
                  {facturaSel.estado === 'en_revision' && '🔍 En Revision'}
                  {facturaSel.estado === 'aprobada' && '✅ Aprobada'}
                  {facturaSel.estado === 'pagada' && '💰 Pagada'}
                  {facturaSel.estado === 'rechazada' && '❌ Rechazada'}
                </Badge>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{facturaSel.proveedor}</p>
                    <p className="text-xs text-muted-foreground">NIT: {facturaSel.proveedorNIT}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Solicitante</p>
                    <p className="font-medium">{facturaSel.solicitante}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Centro de Trabajo</p>
                    <p className="font-medium">{facturaSel.centroTrabajo}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Solicitud Asociada</p>
                    <p className="font-mono font-medium">#{facturaSel.solicitudNumero}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha Factura</p>
                    <p className="font-medium">{facturaSel.fechaFactura.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Amounts */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor Bruto</span>
                  <span className="font-medium">{formatMoney(facturaSel.valorBruto)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span className="font-medium text-amber-600">{formatMoney(facturaSel.iva)}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-xl text-green-600">
                    {formatMoney(facturaSel.valorTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}
          {facturaSel && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground py-2">Cambiar estado:</span>
              {(['pendiente','en_revision','aprobada','pagada'] as const).map(s=>(
                <Button key={s} size="sm" variant={facturaSel.estado===s?'default':'outline'} onClick={()=>cambiarEstado(facturaSel, s)} disabled={facturaSel.estado===s}>
                  {s==='pendiente'?'⏳ Pendiente': s==='en_revision'?'🔍 Revisión': s==='aprobada'?'✅ Aprobada':'💰 Pagada'}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="text-red-600" onClick={()=>cambiarEstado(facturaSel,'rechazada')}>❌ Rechazada</Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Factura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <Input
                  value={formData.proveedor}
                  onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>
              <div className="space-y-2">
                <Label>NIT Proveedor *</Label>
                <Input
                  value={formData.proveedorNIT}
                  onChange={(e) => setFormData({ ...formData, proveedorNIT: e.target.value })}
                  placeholder="900123456-7"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Bruto *</Label>
                <Input
                  type="number"
                  value={formData.valorBruto}
                  onChange={(e) => setFormData({ ...formData, valorBruto: Number(e.target.value) })}
                  placeholder="1000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Factura *</Label>
                <Input
                  type="date"
                  value={formData.fechaFactura}
                  onChange={(e) => setFormData({ ...formData, fechaFactura: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
            {/* IVA Calculation */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Valor Bruto</span>
                <span>{formatMoney(formData.valorBruto)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">IVA (19%)</span>
                <span className="text-amber-600">
                  {formatMoney(formData.valorBruto * 0.19)}
                </span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-green-600">
                  {formatMoney(formData.valorBruto * 1.19)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFactura}>
              Crear Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
