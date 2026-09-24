'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Solicitud } from '@/types';
import { ESTADOS_SOLICITUD } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Clock, Sparkles, Grip, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';

const COLUMNAS = ['pendiente', 'en_cotizacion', 'cotizada', 'aprobada', 'en_pedido', 'completada'] as const;

// ── Card orgánica ──
function Card({ solicitud, onClick }: { solicitud: Solicitud; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: solicitud.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const valor = useMemo(() => solicitud.items?.reduce((a,it)=> a+(((it as any).cotizaciones?.[(it as any).mejorCotizacionIndex??0]?.total) || it.precioUnitario*it.cantidad ||0),0) ||0, [solicitud.items]);
  const dias = useMemo(() => {
    if (!solicitud.fechaCreacion) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(solicitud.fechaCreacion as any).getTime()) / 86400000));
  }, [solicitud.fechaCreacion]);
  const urg = (solicitud.prioridad||'media')==='urgente';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity:0, y:16, scale:0.96 }}
      animate={{ opacity: isDragging?0.35:1, y:0, scale: isDragging?0.98:1, rotate: isDragging?1.5:0 }}
      exit={{ opacity:0, scale:0.9 }}
      whileHover={{ y:-4, scale:1.015 }}
      transition={{ type:'spring', stiffness:420, damping:28 }}
      onClick={onClick}
      className={`group relative bg-white rounded-[18px] p-4 border cursor-pointer select-none ${isDragging?'shadow-2xl ring-2 ring-blue-400 z-50':'shadow-sm hover:shadow-xl hover:border-blue-200 border-gray-100'} ${isOver?'ring-2 ring-emerald-300':''}`}
    >
      {urg && <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">URGENTE</div>}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-black tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">#{solicitud.numero}</span>
        <span {...attributes} {...listeners} className="p-1.5 text-gray-300 group-hover:text-gray-500 hover:bg-gray-100 rounded-xl cursor-grab active:cursor-grabbing touch-none" onClick={e=>e.stopPropagation()}><Grip className="h-4 w-4"/></span>
      </div>
      <h4 className="mt-3 text-[14px] font-extrabold leading-tight line-clamp-2 text-gray-900">{solicitud.nombreUsuario}</h4>
      <p className="text-xs text-gray-500 line-clamp-1">{solicitud.centroTrabajo}</p>
      <div className="mt-3 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl px-3 py-2.5">
        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{solicitud.items?.map(i=>i.descripcion).join(' • ') || 'Sin descripción'}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-full inline-flex items-center gap-1"><Package className="h-3 w-3"/>{solicitud.items?.length||0}</span>
          <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3"/>{dias}d</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{solicitud.fechaCreacion? new Date(solicitud.fechaCreacion as any).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):''}</span>
        <span className={`text-sm font-black font-mono ${valor?'text-emerald-600':'text-gray-300'}`}>{valor? formatMoney(valor):'—'}</span>
      </div>
    </motion.div>
  );
}

function Column({ estado, solicitudes, onCardClick, isOver, collapsed, onToggle }: { estado:string; solicitudes: Solicitud[]; onCardClick:(s:Solicitud)=>void; isOver:boolean; collapsed:boolean; onToggle:()=>void }) {
  const info = ESTADOS_SOLICITUD.find(e=>e.value===estado);
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: estado });
  const hover = isOver || isDroppableOver;
  const totalValor = solicitudes.reduce((a,s)=>a+(s.items?.reduce((x,it)=>x+(((it as any).cotizaciones?.[(it as any).mejorCotizacionIndex??0]?.total)||it.precioUnitario*it.cantidad||0),0)||0),0);

  return (
    <div ref={setNodeRef} className={`flex flex-col rounded-[22px] transition-all duration-200 snap-start shrink-0 w-[84vw] sm:w-[360px] lg:w-[340px] xl:w-[320px] ${hover?'bg-blue-50 ring-2 ring-blue-300 scale-[1.01] shadow-inner':'bg-white border border-gray-100 shadow-sm'}`} style={{ minHeight: 560 }}>
      <div className="p-4 pb-3 sticky top-0 z-10 bg-inherit rounded-t-[22px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl grid place-items-center text-white font-black shadow" style={{background: info?.color || '#64748b'}}>{info?.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black tracking-tight leading-none">{info?.label}</h3>
            <p className="text-xs text-gray-500">{solicitudes.length} · {totalValor ? formatMoney(totalValor) : '—'}</p>
          </div>
          <span className={`w-9 h-9 rounded-full grid place-items-center text-sm font-black ${hover?'bg-blue-600 text-white':'bg-gray-900 text-white'}`}>{solicitudes.length}</span>
          <button onClick={onToggle} className="hidden sm:grid w-8 h-8 place-items-center hover:bg-gray-100 rounded-xl text-xs">{collapsed?'↕':'—'}</button>
        </div>
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width: `${Math.min(100, solicitudes.length*18)}%`, background: info?.color || '#94a3b8'}}/></div>
      </div>

      {!collapsed && (
        <SortableContext items={solicitudes.map(s=>s.id)} strategy={verticalListSortingStrategy}>
          <div className="px-3 pb-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
            <AnimatePresence>
              {solicitudes.length===0 ? (
                <div className={`border-2 border-dashed rounded-2xl p-8 text-center ${hover?'border-blue-300 bg-blue-50 text-blue-600':'border-gray-200 bg-gray-50 text-gray-400'}`}>
                  <div className="text-2xl mb-2">✨</div>
                  <div className="text-sm font-bold">{hover?'Suelta aquí':'Vacío'}</div>
                  <div className="text-xs">Arrastra cualquier tarjeta</div>
                </div>
              ) : solicitudes.map(s=> <Card key={s.id} solicitud={s} onClick={()=>onCardClick(s)} />)}
            </AnimatePresence>
          </div>
        </SortableContext>
      )}
    </div>
  );
}

export default function KanbanBoard({ solicitudes, onCardClick, onEstadoChange }: { solicitudes: Solicitud[]; onCardClick:(s:Solicitud)=>void; onEstadoChange:(id:string, nuevoEstado:string)=>void }) {
  const [activeId, setActiveId] = useState<string|null>(null);
  const [overId, setOverId] = useState<string|null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}));

  // auto-scroll when dragging near edges
  useEffect(()=>{
    if(!activeId || !scrollerRef.current) return;
    let raf:number;
    const onMove = (e: PointerEvent)=>{
      const el=scrollerRef.current; if(!el) return;
      const rect=el.getBoundingClientRect();
      const x=e.clientX;
      if(x < rect.left+80) el.scrollBy({left:-12, behavior:'auto'});
      else if(x > rect.right-80) el.scrollBy({left:12, behavior:'auto'});
      raf=requestAnimationFrame(()=>{});
    };
    window.addEventListener('pointermove', onMove);
    return ()=>{ window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  },[activeId]);

  const filtradas = useMemo(()=>{
    if(!query) return solicitudes;
    const q=query.toLowerCase();
    return solicitudes.filter(s=> String(s.numero).includes(q) || s.nombreUsuario.toLowerCase().includes(q) || s.centroTrabajo.toLowerCase().includes(q) || s.items?.some(i=>i.descripcion.toLowerCase().includes(q)));
  },[solicitudes,query]);

  const totalValor = filtradas.reduce((a,s)=>a+(s.items?.reduce((x,it)=>x+(((it as any).cotizaciones?.[(it as any).mejorCotizacionIndex??0]?.total)||it.precioUnitario*it.cantidad||0),0)||0),0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
          <Input placeholder="Buscar # , solicitante, centro, producto… arrastra para mover" value={query} onChange={e=>setQuery(e.target.value)} className="pl-9 h-10 rounded-xl bg-gray-50 border-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-full"><Sparkles className="h-4 w-4"/> {filtradas.length} visibles</span>
          <Badge variant="secondary" className="font-mono text-sm px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">{formatMoney(totalValor)}</Badge>
          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="h-3 w-3"/> Desliza horizontal para ver más</span>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e=>setActiveId(e.active.id as string)} onDragOver={e=>setOverId((e.over?.id as string)||null)} onDragEnd={e=>{
        const {active, over}=e; setActiveId(null); setOverId(null); if(!over) return;
        const a=filtradas.find(s=>s.id===active.id); if(!a) return;
        let n:string|null=null; const o=filtradas.find(s=>s.id===over.id);
        if(o) n=o.estado; else if((COLUMNAS as readonly string[]).includes(over.id as string)) n=over.id as string;
        if(n && n!==a.estado) onEstadoChange(a.id,n);
      }}>
        {/* Orgánico: carrusel horizontal con snap, sin amontonar, tarjetas con spring */}
        <div ref={scrollerRef} className="flex gap-5 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-thin scroll-smooth" style={{scrollPaddingInline:16}}>
          {COLUMNAS.map(estado=> (
            <Column key={estado} estado={estado} solicitudes={filtradas.filter(s=>s.estado===estado)} onCardClick={onCardClick} isOver={overId===estado} collapsed={!!collapsed[estado]} onToggle={()=>setCollapsed(p=>({...p,[estado]:!p[estado]}))} />
          ))}
        </div>
        <DragOverlay dropAnimation={{duration:220, easing:'cubic-bezier(0.16,1,0.3,1)'}}>
          {(() => { const d=filtradas.find(s=>s.id===activeId); return d ? (
            <div className="bg-white rounded-2xl p-4 border-2 border-blue-500 shadow-2xl w-[360px] rotate-1">
              <span className="font-mono text-xs font-black text-blue-600">#{d.numero}</span>
              <p className="text-sm font-black mt-1 line-clamp-1">{d.nombreUsuario}</p>
              <p className="text-xs text-gray-500 line-clamp-1">{d.items?.map(i=>i.descripcion).join(' • ')}</p>
            </div>
          ): null })()}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-center text-gray-400">Tip: mantén presionado y arrastra cualquier tarjeta a otra columna — se guarda automático. En móvil, desliza horizontalmente.</p>
    </div>
  );
}
