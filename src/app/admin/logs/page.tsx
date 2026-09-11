'use client';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Mail, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LogsPage(){
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('todos');

  useEffect(()=>{
    const q = query(collection(db, 'email_logs'), orderBy('timestamp','desc'), limit(100));
    const unsub = onSnapshot(q, snap=>{
      setLogs(snap.docs.map(d=>({ id:d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() || new Date(d.data().timestamp) })));
    });
    return ()=> unsub();
  },[]);

  const filtrados = filter==='todos' ? logs : logs.filter(l=> l.tipo===filter);

  return (
    <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6 text-blue-600"/> Logs en tiempo real — Correos</h1>
          <p className="text-sm text-muted-foreground">Cada envío y cada respuesta en el hilo [SOL-#] aparece aquí al instante. Via: apps-script / smtp</p>
        </div>
        <div className="flex gap-2">
          {['todos','nueva_solicitud','respuesta_solicitud'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter===f?'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 grid place-items-center"><Mail className="h-5 w-5 text-blue-600"/></div><div><p className="text-xs text-gray-500">Total logs</p><p className="text-2xl font-bold">{logs.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 grid place-items-center"><CheckCircle className="h-5 w-5 text-emerald-600"/></div><div><p className="text-xs text-gray-500">Via Apps Script</p><p className="text-2xl font-bold">{logs.filter(l=>String(l.via).includes('apps-script')).length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-100 grid place-items-center"><Clock className="h-5 w-5 text-amber-600"/></div><div><p className="text-xs text-gray-500">Último</p><p className="text-xs font-mono">{logs[0]?.timestamp ? format(logs[0].timestamp,'HH:mm:ss') : '—'}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Actividad en vivo — se actualiza solo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[600px] overflow-auto">
            {filtrados.length===0 ? <div className="p-8 text-center text-gray-400 text-sm">Sin logs aún — cree una solicitud para ver el primer envío aquí</div> : filtrados.map(l=>(
              <div key={l.id} className="p-4 flex gap-3 hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${l.tipo==='nueva_solicitud'?'bg-blue-500':'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">SOL-#{l.solicitudNumero || '—'}</Badge>
                    <Badge className={l.tipo==='nueva_solicitud'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}>{l.tipo}</Badge>
                    <span className="text-xs text-gray-500">{l.via}</span>
                    <span className="text-xs text-gray-400">{l.timestamp ? format(l.timestamp,'dd/MM HH:mm:ss') : ''}</span>
                  </div>
                  <p className="text-sm font-medium truncate mt-1">{l.subject || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">Para: {l.to} {l.threadId ? `· thread ${String(l.threadId).slice(0,8)}…` : ''} {l.estado ? `· ${l.estado}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 shrink-0">✓ enviado</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
