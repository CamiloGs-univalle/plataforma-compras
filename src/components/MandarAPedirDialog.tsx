'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Send, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Solicitud } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: Solicitud;
  proveedoresMap: Record<string, Record<string, number>>;
  onSuccess?: () => void;
}

export function MandarAPedirDialog({ open, onOpenChange, solicitud, proveedoresMap, onSuccess }: Props) {
  const [items, setItems] = useState<Record<string, { proveedor: string; precio: number }>>({});
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const payload = solicitud.items.map((it) => {
        const sel = items[it.codigoProducto] || items[it.codigoProducto + '_' + it.descripcion] || {};
        // Fallback to first available or existing cotizacion
        const fallback = it.cotizaciones?.[it.mejorCotizacionIndex ?? 0];
        return {
          codigoProducto: it.codigoProducto,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          proveedor: sel.proveedor || fallback?.proveedor || '',
          precio: sel.precio ?? fallback?.precioUnitario ?? it.precioUnitario ?? 0,
        };
      });

      // Validar que todos tengan proveedor y precio
      const sinDatos = payload.filter(p => !p.proveedor || !p.precio);
      if (sinDatos.length > 0) {
        toast.error(`Falta proveedor/precio para ${sinDatos.length} producto(s)`);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/solicitudes/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generar_pedido',
          numeroPedido: `OC-${new Date().getFullYear()}-${String(solicitud.numero || 0).padStart(4, '0')}`,
          usuarioUid: solicitud.usuario,
          usuarioNombre: 'Abastecimiento',
          items: payload.map(p => ({
            codigoProducto: p.codigoProducto,
            proveedor: p.proveedor,
            precio: p.precio,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al generar pedido');

      // Enviar correo al proveedor (el backend ya lo hace en generar_pedido, pero reforzamos)
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'pedido_enviado_proveedor',
            solicitud: { ...solicitud, numeroPedido: data.numeroPedido || payload[0]?.proveedor },
            emailDestino: payload[0]?.proveedor, // el backend resolvera el email real via proveedores
          }),
        });
      } catch {}

      toast.success('Pedido generado y proveedor notificado');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const isValid = useMemo(() => {
    return solicitud.items.every((it) => {
      const sel = items[it.codigoProducto];
      const fallback = it.cotizaciones?.[it.mejorCotizacionIndex ?? 0];
      const prov = sel?.proveedor || fallback?.proveedor;
      const pr = sel?.precio ?? fallback?.precioUnitario ?? it.precioUnitario;
      return prov && Number(pr) > 0;
    });
  }, [solicitud.items, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 rounded-2xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white grid place-items-center"><ShoppingCart className="w-4 h-4" /></span>
            Mandar a pedir
          </DialogTitle>
          <DialogDescription className="text-xs">
            Solicitud #{solicitud.numero} • {solicitud.items.length} productos • Se genera Orden SAP (14 cols) y se notifica al proveedor copiando al solicitante
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[340px] overflow-y-auto px-6 py-2 space-y-3">
          {solicitud.items.map((item) => {
            const precios = proveedoresMap[item.codigoProducto] || {};
            const opciones = Object.entries(precios).filter(([, pr]) => Number(pr) > 0).sort((a,b)=> Number(a[1])-Number(b[1])) as [string, number][];
            const minPrecio = opciones.length ? Math.min(...opciones.map(([,v])=> Number(v))) : 0;
            const maxPrecio = opciones.length ? Math.max(...opciones.map(([,v])=> Number(v))) : 0;
            const sel = items[item.codigoProducto];
            return (
              <div key={item.codigoProducto + item.descripcion} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.descripcion}</p>
                  <p className="text-xs text-muted-foreground">{item.codigoProducto} • Cant: {item.cantidad}</p>
                </div>
                <Select
                  value={String(sel?.proveedor || '')}
                  onValueChange={(val: string | null) => {
                    if (!val) return;
                    const precio = Number((precios as any)[val] || 0);
                    setItems(prev => ({ ...prev, [String(item.codigoProducto)]: { proveedor: String(val), precio } }));
                  }}
                >
                  <SelectTrigger className="w-[200px] h-9 text-xs">
                    <SelectValue placeholder="Proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {opciones.length === 0 ? (
                      <SelectItem value="__manual__" disabled>Sin precio mapeado — use cotizacion manual</SelectItem>
                    ) : (
                      opciones.map(([prov, precio]) => (
                        <SelectItem key={prov} value={prov} className="text-xs">
                          <span className="flex items-center gap-2">
                            {prov} - ${Number(precio).toLocaleString('es-CO')}
                            {Number(precio) === minPrecio && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1 py-0">Mas barato</Badge>}
                            {Number(precio) === maxPrecio && opciones.length > 1 && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 py-0">Mayor calidad</Badge>}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="w-[110px] h-9 text-sm"
                  placeholder="$"
                  value={sel?.precio ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems(prev => ({ ...prev, [String(item.codigoProducto)]: { proveedor: String(prev[String(item.codigoProducto)]?.proveedor || ''), precio: Number(val) } }));
                  }}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-6 pt-4 bg-muted/30 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!isValid || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-w-[220px]">
            {loading ? 'Generando...' : <><Send className="w-4 h-4 mr-2" /> Generar pedido y notificar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BotonMandarAPedir({ solicitud, proveedoresMap, onSuccess, variant = 'default' }: { solicitud: Solicitud; proveedoresMap: Record<string, Record<string, number>>; onSuccess?: () => void; variant?: 'default' | 'table-row' }) {
  const [open, setOpen] = useState(false);
  if (!['pendiente', 'aprobada', 'cotizada'].includes(solicitud.estado)) return null;
  if (variant === 'table-row') {
    return (
      <>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 px-2 text-emerald-700 hover:bg-emerald-50" title="Mandar a pedir directo">
          <Zap className="w-3.5 h-3.5" />
        </Button>
        <MandarAPedirDialog open={open} onOpenChange={setOpen} solicitud={solicitud} proveedoresMap={proveedoresMap} onSuccess={onSuccess} />
      </>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl">
        <Zap className="w-4 h-4 mr-2" /> Mandar a pedir
      </Button>
      <MandarAPedirDialog open={open} onOpenChange={setOpen} solicitud={solicitud} proveedoresMap={proveedoresMap} onSuccess={onSuccess} />
    </>
  );
}
