'use client';
import { useState, useMemo, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { obtenerTodasSolicitudesEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import { ESTADOS_SOLICITUD } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Archive, TrendingUp, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';

export default function HistorialPage(){
  const { empresa } = useCompany();
  const { usuario } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mes, setMes] = useState(format(new Date(),'yyyy-MM'));
  const [q, setQ] = useState('');

  useEffect(()=>{
    if(!empresa?.id) return;
    return obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sols)=>{
      setSolicitudes(sols.filter(s=> (s as any).archivado));
      setCargando(false);
    });
  },[empresa?.id]);

  const [y,m] = mes.split('-').map(Number);
  const delMes = useMemo(()=> solicitudes.filter(s=>{
    const d = new Date((s as any).fechaArchivado || s.fechaActualizacion || s.fechaCreacion);
    return d.getFullYear()===y && d.getMonth()+1===m;
  }),[solicitudes,y,m]);

  const filtradas = delMes.filter(s=> !q || String(s.numero).includes(q) || s.nombreUsuario.toLowerCase().includes(q.toLowerCase()) || s.centroTrabajo.toLowerCase().includes(q.toLowerCase()));
  const stats = useMemo(()=>{
    const total = delMes.length;
    const valor = delMes.reduce((a,s)=> a + (s.items?.reduce((x,it)=> x+(((it as any).cotizaciones?.[(it as any).mejorCotizacionIndex??0]?.total)||it.precioUnitario*it.cantidad||0),0)||0),0);
    const porEstado = Object.entries(delMes.reduce((acc,s)=>{ acc[s.estado]=(acc[s.estado]||0)+1; return acc; },{} as Record<string,number>));
    return { total, valor, porEstado };
  },[delMes]);

  if(cargando) return <div className="p-8 text-center">Cargando historial...</div>;

  return (
    <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🗂️ Historial</h1>
          <p className="text-sm text-muted-foreground">Completadas y facturas pagadas archivadas — se guardan por mes para indicadores realistas. Operativo queda limpio.</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={mes} onChange={e=>setMes(e.target.value)} className="w-[160px]"/>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><Input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} className="pl-8 w-[220px]"/></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Archive className="h-8 w-8 text-gray-500"/><div><p className="text-xs text-gray-500">Archivadas en {format(new Date(y,m-1), 'MMMM yyyy',{locale:es})}</p><p className="text-2xl font-bold">{stats.total}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><TrendingUp className="h-8 w-8 text-emerald-600"/><div><p className="text-xs text-gray-500">Valor del mes</p><p className="text-xl font-bold text-emerald-600">{formatMoney(stats.valor)}</p></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3"/> Distribución</p><div className="flex gap-1.5 flex-wrap mt-1">{stats.porEstado.map(([e,c])=> <Badge key={e} variant="secondary">{e}: {c}</Badge>)}</div></CardContent></Card>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center justify-between"><h3 className="font-semibold">Archivadas — {format(new Date(y,m-1),'MMMM yyyy',{locale:es})}</h3><Badge variant="outline">{filtradas.length}</Badge></div>
        <div className="divide-y">
          {filtradas.length===0 ? <div className="p-10 text-center text-gray-400">Sin archivadas este mes. Las completadas/pagadas aparecerán aquí al archivar.</div> : filtradas.map(s=>(
            <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div>
                <p className="font-mono font-bold text-sm">#{s.numero} <span className="font-normal text-gray-500">{s.nombreUsuario} · {s.centroTrabajo}</span></p>
                <p className="text-xs text-gray-500 truncate max-w-[400px]">{s.items?.map(i=>i.descripcion).join(', ')}</p>
                <p className="text-[11px] text-gray-400">Archivada { (s as any).fechaArchivado ? format(new Date((s as any).fechaArchivado),'dd/MM/yy HH:mm') : format(new Date(s.fechaActualizacion),'dd/MM/yy')}</p>
              </div>
              <div className="text-right">
                <Badge style={{background: ESTADOS_SOLICITUD.find(e=>e.value===s.estado)?.color+'15', color: ESTADOS_SOLICITUD.find(e=>e.value===s.estado)?.color}}>{ESTADOS_SOLICITUD.find(e=>e.value===s.estado)?.label}</Badge>
                <p className="text-xs font-mono font-bold mt-1">{formatMoney(s.items?.reduce((a,it)=>a+(((it as any).cotizaciones?.[(it as any).mejorCotizacionIndex??0]?.total)||it.precioUnitario*it.cantidad||0),0)||0)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <b>Cómo funciona:</b> Al completar una solicitud o pagar su factura, use <b>Archivar</b> — desaparece de <i>Solicitudes/Seguimiento/Facturación</i> (operativo limpio) y queda aquí por <b>mes de archivado</b> para que <b>Reportes</b> muestre indicadores reales por mes (valor, tiempos, tasa). No se borra, solo se mueve a historial.
      </div>
    </div>
  );
}
