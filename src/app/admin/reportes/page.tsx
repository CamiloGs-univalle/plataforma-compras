'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { obtenerTodasSolicitudesEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import { ESTADOS_SOLICITUD, PRIORIDADES } from '@/types';
import { format, startOfMonth, endOfMonth, isWithinInterval, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
} from 'recharts';
import { Loader2, Download, FileText, FileSpreadsheet, Clock, Timer, Truck, CheckCircle } from 'lucide-react';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

import { formatMoney } from '@/lib/format';

function horasAHorasMinutos(horas: number): string {
  if (horas < 24) return `${Math.round(horas)}h`;
  const dias = Math.floor(horas / 24);
  const hRestantes = Math.round(horas % 24);
  return `${dias}d ${hRestantes}h`;
}

function diasAHorasMinutos(dias: number): string {
  return `${dias.toFixed(1)} dias`;
}

export default function ReportesPage() {
  const { empresa } = useCompany();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));
  const [exportando, setExportando] = useState<string | null>(null);

  useEffect(() => {
    if (!empresa?.id) return;
    return obtenerTodasSolicitudesEnTiempoReal(empresa.id, (s: Solicitud[]) => {
      setSolicitudes(s);
      setCargando(false);
    });
  }, [empresa?.id]);

  const [anio, mes] = mesSeleccionado.split('-').map(Number);
  const inicioMes = startOfMonth(new Date(anio, mes - 1));
  const finMes = endOfMonth(new Date(anio, mes - 1));

  const delMes = useMemo(() =>
    solicitudes.filter(s => {
      const f = new Date(s.fechaCreacion);
      return isWithinInterval(f, { start: inicioMes, end: finMes });
    }),
  [solicitudes, inicioMes, finMes]);

  // ─── CALCULO DE TIEMPOS ────────────────────────────────
  const tiempos = useMemo(() => {
    const tiemposRespuesta: number[] = []; // creacion -> en_cotizacion
    const tiemposCotizacion: number[] = []; // en_cotizacion -> cotizada
    const tiemposAprobacion: number[] = []; // cotizada -> aprobada
    const tiemposPedido: number[] = []; // aprobada -> en_pedido
    const tiemposEntrega: number[] = []; // en_pedido -> completada
    const tiemposTotal: number[] = []; // creacion -> completada

    delMes.forEach(s => {
      const creacion = new Date(s.fechaCreacion);
      
      // Tiempo de respuesta: creacion -> cuando se inicia cotizacion (fechaCotizacion o primera nota)
      if (s.fechaCotizacion) {
        const horas = differenceInHours(new Date(s.fechaCotizacion), creacion);
        if (horas >= 0) tiemposRespuesta.push(horas);
      }

      // Tiempo de cotizacion: cuando se cotizo
      if (s.fechaCotizacion && s.fechaAprobacion) {
        const horas = differenceInHours(new Date(s.fechaAprobacion), new Date(s.fechaCotizacion));
        if (horas >= 0) tiemposCotizacion.push(horas);
      }

      // Tiempo de aprobacion: cotizada -> aprobada
      if (s.fechaAprobacion && s.fechaPedido) {
        const horas = differenceInHours(new Date(s.fechaPedido), new Date(s.fechaAprobacion));
        if (horas >= 0) tiemposAprobacion.push(horas);
      }

      // Tiempo de pedido: aprobada -> en_pedido
      if (s.fechaPedido && (s.estado === 'completada' || s.estado === 'en_pedido')) {
        // Usar fechaActualizacion como approximation de entrega para completadas
        if (s.estado === 'completada') {
          const horas = differenceInHours(new Date(s.fechaActualizacion), new Date(s.fechaPedido));
          if (horas >= 0) tiemposEntrega.push(horas);
        }
      }

      // Tiempo total: creacion -> completada
      if (s.estado === 'completada') {
        const horas = differenceInHours(new Date(s.fechaActualizacion), creacion);
        if (horas >= 0) tiemposTotal.push(horas);
      }
    });

    const promedio = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const minimo = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
    const maximo = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;

    return {
      respuesta: { promedio: promedio(tiemposRespuesta), min: minimo(tiemposRespuesta), max: maximo(tiemposRespuesta), cantidad: tiemposRespuesta.length, datos: tiemposRespuesta },
      cotizacion: { promedio: promedio(tiemposCotizacion), min: minimo(tiemposCotizacion), max: maximo(tiemposCotizacion), cantidad: tiemposCotizacion.length, datos: tiemposCotizacion },
      aprobacion: { promedio: promedio(tiemposAprobacion), min: minimo(tiemposAprobacion), max: maximo(tiemposAprobacion), cantidad: tiemposAprobacion.length, datos: tiemposAprobacion },
      pedido: { promedio: promedio(tiemposPedido), min: minimo(tiemposPedido), max: maximo(tiemposPedido), cantidad: tiemposPedido.length, datos: tiemposPedido },
      entrega: { promedio: promedio(tiemposEntrega), min: minimo(tiemposEntrega), max: maximo(tiemposEntrega), cantidad: tiemposEntrega.length, datos: tiemposEntrega },
      total: { promedio: promedio(tiemposTotal), min: minimo(tiemposTotal), max: maximo(tiemposTotal), cantidad: tiemposTotal.length, datos: tiemposTotal },
    };
  }, [delMes]);

  // ─── STATS GENERALES ────────────────────────────────
  const stats = useMemo(() => {
    const total = delMes.length;
    const pendientes = delMes.filter(s => s.estado === 'pendiente').length;
    const enCotizacion = delMes.filter(s => s.estado === 'en_cotizacion').length;
    const cotizadas = delMes.filter(s => s.estado === 'cotizada').length;
    const aprobadas = delMes.filter(s => s.estado === 'aprobada').length;
    const completadas = delMes.filter(s => s.estado === 'completada').length;
    const canceladas = delMes.filter(s => s.estado === 'cancelada').length;
    const totalItems = delMes.reduce((acc, s) => acc + (s.items?.length || 0), 0);
    const urgentes = delMes.filter(s => s.prioridad === 'urgente').length;
    const valorTotal = delMes.reduce((acc, s) => {
      return acc + (s.items?.reduce((itemAcc, item) => {
        const cotizacionSeleccionada = item.cotizaciones?.[item.mejorCotizacionIndex || 0];
        return itemAcc + (cotizacionSeleccionada?.total || item.precioUnitario * item.cantidad || 0);
      }, 0) || 0);
    }, 0);
    return { total, pendientes, enCotizacion, cotizadas, aprobadas, completadas, canceladas, totalItems, urgentes, valorTotal };
  }, [delMes]);

  // ─── DATOS PARA CHARTS ────────────────────────────────
  const porSolicitante = useMemo(() => {
    const map = new Map<string, number>();
    delMes.forEach(s => {
      const nombre = s.nombreUsuario || 'Desconocido';
      map.set(nombre, (map.get(nombre) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [delMes]);

  const porCentro = useMemo(() => {
    const map = new Map<string, number>();
    delMes.forEach(s => {
      const centro = s.centroTrabajo || 'Sin centro';
      map.set(centro, (map.get(centro) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [delMes]);

  const porProducto = useMemo(() => {
    const map = new Map<string, number>();
    delMes.forEach(s => {
      s.items?.forEach(item => {
        const desc = item.descripcion || 'Sin descripcion';
        map.set(desc, (map.get(desc) || 0) + (item.cantidad || 1));
      });
    });
    return Array.from(map.entries())
      .map(([nombre, cantidad]) => ({ nombre: nombre.substring(0, 30), cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15);
  }, [delMes]);

  const tendenciaDiaria = useMemo(() => {
    const dias = [];
    const d = new Date(inicioMes);
    while (d <= finMes) {
      const diaStr = format(d, 'dd');
      const count = delMes.filter(s => format(new Date(s.fechaCreacion), 'dd/MM/yyyy') === format(d, 'dd/MM/yyyy')).length;
      dias.push({ dia: diaStr, solicitudes: count });
      d.setDate(d.getDate() + 1);
    }
    return dias;
  }, [delMes, inicioMes, finMes]);

  const porEstado = useMemo(() => {
    return [
      { nombre: 'Pendientes', value: stats.pendientes, color: '#f59e0b' },
      { nombre: 'En Cotizacion', value: stats.enCotizacion, color: '#3b82f6' },
      { nombre: 'Cotizadas', value: stats.cotizadas, color: '#8b5cf6' },
      { nombre: 'Aprobadas', value: stats.aprobadas, color: '#10b981' },
      { nombre: 'Completadas', value: stats.completadas, color: '#22c55e' },
      { nombre: 'Canceladas', value: stats.canceladas, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Chart de tiempos promedio
  const chartTiempos = useMemo(() => [
    { nombre: 'Respuesta', horas: Math.round(tiempos.respuesta.promedio), color: '#f59e0b' },
    { nombre: 'Cotizacion', horas: Math.round(tiempos.cotizacion.promedio), color: '#3b82f6' },
    { nombre: 'Aprobacion', horas: Math.round(tiempos.aprobacion.promedio), color: '#8b5cf6' },
    { nombre: 'Entrega', horas: Math.round(tiempos.entrega.promedio), color: '#10b981' },
    { nombre: 'Total Ciclo', horas: Math.round(tiempos.total.promedio), color: '#ef4444' },
  ].filter(d => d.horas > 0), [tiempos]);

  // Distribucion de tiempos de respuesta
  const distribucionRespuesta = useMemo(() => {
    const rangos = [
      { rango: '< 1h', min: 0, max: 1, count: 0 },
      { rango: '1-4h', min: 1, max: 4, count: 0 },
      { rango: '4-8h', min: 4, max: 8, count: 0 },
      { rango: '8-24h', min: 8, max: 24, count: 0 },
      { rango: '1-3d', min: 24, max: 72, count: 0 },
      { rango: '> 3d', min: 72, max: Infinity, count: 0 },
    ];
    tiempos.respuesta.datos.forEach(h => {
      const rango = rangos.find(r => h >= r.min && h < r.max);
      if (rango) rango.count++;
    });
    return rangos.filter(r => r.count > 0);
  }, [tiempos]);

  // Solicitudes por prioridad con tiempo promedio
  const tiemposPorPrioridad = useMemo(() => {
    const prioridades = ['urgente', 'alta', 'media', 'baja'];
    return prioridades.map(p => {
      const sols = delMes.filter(s => s.prioridad === p);
      const tiemposP = sols.filter(s => s.fechaCotizacion).map(s => 
        differenceInHours(new Date(s.fechaCotizacion!), new Date(s.fechaCreacion))
      );
      return {
        prioridad: p,
        cantidad: sols.length,
        tiempoPromedio: tiemposP.length > 0 ? Math.round(tiemposP.reduce((a, b) => a + b, 0) / tiemposP.length) : 0,
      };
    }).filter(d => d.cantidad > 0);
  }, [delMes]);

  const getEstadoLabel = (estado: string) => ESTADOS_SOLICITUD.find(e => e.value === estado)?.label || estado;
  const getPrioridadLabel = (prioridad: string) => PRIORIDADES.find(p => p.value === prioridad)?.label || prioridad;

  // ─── EXPORT HTML PROFESIONAL ───────────────────────
  const exportarHTML = () => {
    setExportando('html');
    const mesNombre = format(inicioMes, 'MMMM yyyy', { locale: es });
    const mesNombreCap = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
    const tasaExito = stats.total > 0 ? Math.round((stats.completadas / stats.total) * 100) : 0;
    const tasaCancel = stats.total > 0 ? Math.round((stats.canceladas / stats.total) * 100) : 0;
    const slaRapido = tiempos.respuesta.datos.filter(h => h <= 4).length;
    const slaOk = tiempos.respuesta.datos.filter(h => h <= 24).length;
    const slaIncu = tiempos.respuesta.datos.filter(h => h > 24).length;
    const pctRapido = tiempos.respuesta.cantidad ? Math.round(slaRapido / tiempos.respuesta.cantidad * 100) : 0;
    const pctOk = tiempos.respuesta.cantidad ? Math.round(slaOk / tiempos.respuesta.cantidad * 100) : 0;
    // Score de rendimiento 0-100
    const score = Math.round((tasaExito * 0.4) + (pctOk * 0.35) + (Math.max(0, 100 - Math.min(tiempos.respuesta.promedio, 72) * 1.1) * 0.25));
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    const scoreLabel = score >= 80 ? 'Excelente' : score >= 60 ? 'Bueno' : score >= 40 ? 'Regular' : 'Crítico';
    const valorFormateado = formatMoney(stats.valorTotal);
    const tiempoRespTxt = horasAHorasMinutos(tiempos.respuesta.promedio);
    const tiempoCotTxt = horasAHorasMinutos(tiempos.cotizacion.promedio);
    const tiempoTotTxt = horasAHorasMinutos(tiempos.total.promedio);
    const tiempoAprTxt = horasAHorasMinutos(tiempos.aprobacion.promedio);
    const tiempoEntTxt = horasAHorasMinutos(tiempos.entrega.promedio);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte Ejecutivo — ${mesNombreCap} · ${empresa?.nombre || 'Siamo'}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
  :root{ --blue:#2563eb; --blue-dark:#1e40af; --slate-900:#0f172a; --slate-600:#475569; --slate-400:#94a3b8; --border:#e2e8f0; --bg:#f8fafc; --card:#ffffff; --green:#10b981; --amber:#f59e0b; --red:#ef4444; --purple:#7c3aed; --cyan:#06b6d4; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--slate-900);line-height:1.5}
  a{color:var(--blue)}
  /* Top bar */
  .topbar{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:12px 28px;gap:16px}
  .brand{display:flex;align-items:center;gap:12px}
  .logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:grid;place-items:center;color:#fff;font-weight:800}
  .brand h1{font-size:15px;font-weight:700;letter-spacing:-.02em}
  .brand p{font-size:12px;color:var(--slate-600)}
  .actions{display:flex;gap:8px;flex-wrap:wrap}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;padding:8px 14px;border-radius:10px;font:600 13px Inter;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
  .btn.primary{background:var(--blue);color:#fff;border-color:var(--blue)}
  .btn:hover{filter:brightness(.98)}
  /* Hero */
  .hero{margin:22px auto;max-width:1280px;padding:0 20px}
  .hero-card{background:linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#334155 100%);color:#fff;border-radius:20px;padding:26px;position:relative;overflow:hidden}
  .hero-card::after{content:"";position:absolute;inset:0;background:radial-gradient(600px 300px at 85% 0%,rgba(37,99,235,.35),transparent 60%)}
  .hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;position:relative}
  .hero h2{font-size:26px;letter-spacing:-.03em}
  .hero .sub{color:#cbd5e1;font-size:13px;margin-top:6px}
  .hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}
  .hero-stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px}
  .hero-stat .v{font:800 22px 'JetBrains Mono',monospace}
  .hero-stat .k{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#cbd5e1}
  .score-wrap{background:#fff;color:var(--slate-900);border-radius:16px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%}
  .gauge{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(${scoreColor} calc(${score} * 3.6deg), #e2e8f0 0)}
  .gauge::before{content:"";position:absolute;inset:10px;background:#fff;border-radius:50%}
  .gauge span{position:relative;font:800 28px Inter;color:var(--slate-900)}
  .score-label{margin-top:10px;font:700 13px Inter}
  .score-bar{width:100%;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:10px}
  .score-bar i{display:block;height:100%;background:${scoreColor};width:${score}%}
  /* Layout */
  .container{max-width:1280px;margin:0 auto;padding:0 20px 40px;display:flex;flex-direction:column;gap:18px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px}
  .card h3{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--slate-600);display:flex;align-items:center;gap:8px;margin-bottom:12px}
  .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
  .kpi{border-radius:14px;padding:14px;border:1px solid var(--border);background:#fff;display:flex;flex-direction:column;gap:6px}
  .kpi .val{font:800 24px 'JetBrains Mono',monospace}
  .kpi .lab{font:600 11px Inter;letter-spacing:.06em;text-transform:uppercase;color:var(--slate-600)}
  .kpi .sub{font-size:11px;color:var(--slate-400)}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;font:600 11px Inter;border:1px solid var(--border);background:#fff}
  .flow{display:flex;align-items:center;gap:8px;overflow:auto;padding:6px 2px}
  .flow-step{min-width:150px;flex:1;background:#fff;border:1px solid var(--border);border-radius:14px;padding:12px;text-align:center;position:relative}
  .flow-step .ico{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;margin:0 auto 6px;font-size:16px}
  .flow-step .n{font:700 13px Inter}
  .flow-step .c{font:600 12px 'JetBrains Mono',monospace;color:var(--slate-600)}
  .flow-step .t{font:500 11px Inter;color:var(--slate-400)}
  .arrow{font-size:18px;color:var(--slate-400);flex:0 0 auto}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{position:sticky;top:0;background:#f8fafc;text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);font:700 11px Inter;letter-spacing:.06em;text-transform:uppercase;color:var(--slate-600);white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:hover td{background:#f8fafc}
  .badge{padding:3px 8px;border-radius:999px;font:700 11px Inter;border:1px solid var(--border);white-space:nowrap}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .input{border:1px solid var(--border);border-radius:10px;padding:8px 10px;font:500 13px Inter;min-width:220px}
  .tabs{display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:12px}
  .tab{padding:8px 12px;border-radius:10px 10px 0 0;font:600 13px Inter;cursor:pointer;border:1px solid transparent}
  .tab.active{background:#fff;border-color:var(--border);border-bottom-color:#fff;margin-bottom:-1px}
  .insight{border-left:4px solid var(--blue);background:#eff6ff;border-radius:10px;padding:12px}
  .insight.warn{border-color:var(--amber);background:#fffbeb}
  .insight.ok{border-color:var(--green);background:#ecfdf5}
  .insight.bad{border-color:var(--red);background:#fef2f2}
  .foot{text-align:center;color:var(--slate-400);font-size:12px;padding:18px}
  canvas{max-width:100%}
  @media (max-width:900px){ .hero-grid{grid-template-columns:1fr} .kpis{grid-template-columns:repeat(2,1fr)} .grid2,.grid3{grid-template-columns:1fr} .topbar{flex-direction:column;align-items:flex-start}}
  @media print{ .topbar,.actions{display:none!important} body{background:#fff} .card{break-inside:avoid} }
</style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="logo">S</div>
      <div>
        <h1>Plataforma de Compras — Reporte Ejecutivo</h1>
        <p>${mesNombreCap} · ${empresa?.nombre || 'Siamo'} · Generado ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      <button class="btn primary" onclick="downloadCSV()">⬇️ Descargar CSV</button>
    </div>
  </div>

  <div class="hero">
    <div class="hero-card">
      <div class="hero-grid">
        <div>
          <h2>Resumen del mes: ${mesNombreCap}</h2>
          <p class="sub">Visión 360° para el <b>Analista de Compras</b> — volumen, tiempos, cumplimiento SLA y valor gestionado. Datos reales de Firestore.</p>
          <div class="hero-stats">
            <div class="hero-stat"><div class="v">${stats.total}</div><div class="k">Solicitudes</div></div>
            <div class="hero-stat"><div class="v">${valorFormateado}</div><div class="k">Valor gestionado</div></div>
            <div class="hero-stat"><div class="v">${tasaExito}%</div><div class="k">Tasa de éxito</div></div>
          </div>
        </div>
        <div class="score-wrap">
          <div class="gauge"><span>${score}</span></div>
          <div class="score-label" style="color:${scoreColor}">${scoreLabel} · Rendimiento</div>
          <div class="score-bar"><i></i></div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;text-align:center">40% éxito · 35% SLA · 25% velocidad<br><span style="font-family:'JetBrains Mono'">${pctOk}% dentro de SLA 24h · ${tiempoRespTxt} promedio respuesta</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi" style="border-top:3px solid #2563eb"><div class="val">${stats.total}</div><div class="lab">Total solicitudes</div><div class="sub">${stats.totalItems} items · ${stats.urgentes} urgentes</div></div>
      <div class="kpi" style="border-top:3px solid #f59e0b"><div class="val" style="color:#d97706">${stats.pendientes}</div><div class="lab">Pendientes</div><div class="sub">${stats.total ? Math.round(stats.pendientes/stats.total*100):0}% del total</div></div>
      <div class="kpi" style="border-top:3px solid #7c3aed"><div class="val" style="color:#7c3aed">${stats.enCotizacion + stats.cotizadas}</div><div class="lab">En proceso</div><div class="sub">Cotización + cotizadas</div></div>
      <div class="kpi" style="border-top:3px solid #06b6d4"><div class="val" style="color:#0891b2">${stats.aprobadas}</div><div class="lab">Aprobadas</div><div class="sub">Listas para pedido</div></div>
      <div class="kpi" style="border-top:3px solid #10b981"><div class="val" style="color:#059669">${stats.completadas}</div><div class="lab">Completadas</div><div class="sub">${tasaExito}% tasa de cierre</div></div>
      <div class="kpi" style="border-top:3px solid #ef4444"><div class="val" style="color:#dc2626">${stats.canceladas}</div><div class="lab">Canceladas</div><div class="sub">${tasaCancel}% del total</div></div>
    </div>

    <!-- Flujo -->
    <div class="card">
      <h3>🔀 Flujo de compra — volumen y tiempo por etapa</h3>
      <div class="flow">
        <div class="flow-step"><div class="ico" style="background:#fffbeb">📝</div><div class="n">Pendiente</div><div class="c">${stats.pendientes}</div><div class="t">inicio</div></div>
        <div class="arrow">→</div>
        <div class="flow-step"><div class="ico" style="background:#eff6ff">🔍</div><div class="n">En cotización</div><div class="c">${stats.enCotizacion}</div><div class="t">${tiempoRespTxt} prom. respuesta</div></div>
        <div class="arrow">→</div>
        <div class="flow-step"><div class="ico" style="background:#f5f3ff">💰</div><div class="n">Cotizada</div><div class="c">${stats.cotizadas}</div><div class="t">${tiempoCotTxt} prom. cotizar</div></div>
        <div class="arrow">→</div>
        <div class="flow-step"><div class="ico" style="background:#ecfdf5">✅</div><div class="n">Aprobada</div><div class="c">${stats.aprobadas}</div><div class="t">${tiempoAprTxt} prom. aprobar</div></div>
        <div class="arrow">→</div>
        <div class="flow-step"><div class="ico" style="background:#ecfeff">🛒</div><div class="n">En pedido</div><div class="c">${delMes.filter(s=>s.estado==='en_pedido').length}</div><div class="t">OC generada auto</div></div>
        <div class="arrow">→</div>
        <div class="flow-step"><div class="ico" style="background:#f0fdf4">🎉</div><div class="n">Completada</div><div class="c">${stats.completadas}</div><div class="t">${tiempoTotTxt} ciclo</div></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="chip">⏱️ Entrega prom. ${tiempoEntTxt}</span>
        <span class="chip">⚡ ${pctRapido}% &lt; 4h (excelente)</span>
        <span class="chip">✅ ${pctOk}% &lt; 24h (SLA OK)</span>
        <span class="chip" style="background:#fef2f2;border-color:#fecaca">⚠️ ${slaIncu} &gt; 24h</span>
      </div>
    </div>

    <!-- Evaluación Analysta -->
    <div class="grid2">
      <div class="card">
        <h3>🎯 Evaluación del Analista — ¿cómo lo hice?</h3>
        <div style="display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center">
          <div style="width:110px;height:110px;border-radius:50%;background:conic-gradient(${scoreColor} calc(${score}*3.6deg), #e2e8f0 0);display:grid;place-items:center;position:relative"><div style="position:absolute;inset:10px;background:#fff;border-radius:50%"></div><span style="position:relative;font:800 22px Inter">${score}/100</span></div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;font-size:13px"><span>Tasa de éxito (completadas)</span><b>${tasaExito}%</b></div>
            <div class="score-bar" style="height:8px"><i style="width:${tasaExito}%;background:${tasaExito>=60?'#10b981':'#f59e0b'}"></i></div>
            <div style="display:flex;justify-content:space-between;font-size:13px"><span>Cumplimiento SLA 24h</span><b>${pctOk}%</b></div>
            <div class="score-bar" style="height:8px"><i style="width:${pctOk}%;background:${pctOk>=80?'#10b981':'#f59e0b'}"></i></div>
            <div style="display:flex;justify-content:space-between;font-size:13px"><span>Velocidad (respuesta)</span><b>${tiempoRespTxt}</b></div>
            <div style="font-size:12px;color:#475569">Meta sugerida: &lt; 8h promedio. ${tiempos.respuesta.promedio <= 8 ? '✅ Dentro de meta' : '⚠️ Por encima — revisar carga'}</div>
          </div>
        </div>
        <div style="margin-top:12px;display:grid;gap:8px">
          ${tasaExito >= 60 ? `<div class="insight ok"><b>Fortaleza:</b> Buen cierre (${tasaExito}%). Mantén seguimiento en Kanban y genera OC automática.</div>` : `<div class="insight warn"><b>Oportunidad:</b> Solo ${tasaExito}% cerradas. Revisa cuellos en Aprobación (${tiempoAprTxt}) y Cotización (${tiempoCotTxt}).</div>`}
          ${pctOk < 70 ? `<div class="insight bad"><b>Alerta SLA:</b> Solo ${pctOk}% responden en 24h. Prioriza urgentes y usa plantillas de cotización.</div>` : `<div class="insight ok"><b>SLA OK:</b> ${pctOk}% dentro de 24h. Sigue así.</div>`}
          ${stats.urgentes > 0 ? `<div class="insight"><b>Urgentes:</b> ${stats.urgentes} en el mes. Tiempo prom. urgentes: ${(tiemposPorPrioridad.find(p=>p.prioridad==='urgente')?.tiempoPromedio||0)}h. ${ (tiemposPorPrioridad.find(p=>p.prioridad==='urgente')?.tiempoPromedio||99) <= 4 ? '✅ Excelente reacción' : '⚠️ Mejora el triage' }.</div>` : ``}
        </div>
      </div>
      <div class="card">
        <h3>💡 Recomendaciones accionables</h3>
        <ul style="display:flex;flex-direction:column;gap:10px;list-style:none">
          <li class="insight"><b>1. Acelera cotización:</b> tiempo actual ${tiempoCotTxt}. Si &gt; 24h, crea lista corta de proveedores por producto (ver Top Productos).</li>
          <li class="insight warn"><b>2. Reduce pendientes:</b> ${stats.pendientes} abiertas. Agenda bloque diario de 60 min solo para cotizar.</li>
          <li class="insight ok"><b>3. Automatiza:</b> OC ya es automática (OC-AAAA-####). Activa notificaciones por correo para aprobaciones.</li>
          <li class="insight"><b>4. Control de valor:</b> ${valorFormateado} gestionados. Prioriza por valor (filtra tabla por monto) y negocia con 3 cotizaciones mínimo.</li>
          <li class="insight bad"><b>5. Evita cancelaciones:</b> ${tasaCancel}% canceladas. Revisa motivo (costo, especificación) y valida antes de cotizar.</li>
        </ul>
        <div style="margin-top:10px;font-size:12px;color:#64748b">Tip: usa los gráficos interactivos abajo para filtrar por solicitante/centro y detectar dónde se concentra la demanda.</div>
      </div>
    </div>

    <!-- Gráficos -->
    <div class="grid2">
      <div class="card"><h3>⏱️ Tiempos promedio por fase (horas)</h3><canvas id="cTiempos" height="240"></canvas></div>
      <div class="card"><h3>📊 Distribución tiempo de respuesta</h3><canvas id="cDist" height="240"></canvas></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>🎚️ Tiempos por prioridad</h3><canvas id="cPrio" height="240"></canvas></div>
      <div class="card"><h3>🧭 Por estado</h3><canvas id="cEstado" height="240"></canvas><div style="font-size:11px;color:#64748b;margin-top:8px">Click en leyenda para filtrar</div></div>
    </div>
    <div class="grid3">
      <div class="card"><h3>👥 Por solicitante (top)</h3><canvas id="cSol" height="260"></canvas></div>
      <div class="card"><h3>🏢 Por centro de trabajo</h3><canvas id="cCentro" height="260"></canvas></div>
      <div class="card"><h3>📈 Tendencia diaria</h3><canvas id="cTend" height="260"></canvas></div>
    </div>

    <!-- Tabla con filtros -->
    <div class="card">
      <h3>📋 Detalle — todas las solicitudes del mes (valores reales)</h3>
      <div class="controls">
        <input id="q" class="input" placeholder="🔍 Buscar por # , solicitante, producto, centro...">
        <select id="fEstado" class="input" style="min-width:160px"><option value="">Todos los estados</option>${ESTADOS_SOLICITUD.map(e=>`<option value="${e.value}">${e.label}</option>`).join('')}</select>
        <select id="fPrio" class="input" style="min-width:140px"><option value="">Todas prioridades</option>${PRIORIDADES.map(p=>`<option value="${p.value}">${p.label}</option>`).join('')}</select>
        <span class="chip" id="countChip">${delMes.length} registros</span>
      </div>
      <div class="table-wrap">
        <table id="tabla">
          <thead><tr><th>#</th><th>Solicitante</th><th>Productos (real)</th><th>Centro</th><th>Prioridad</th><th>Estado</th><th style="text-align:right">Valor</th><th style="text-align:center">T. Resp.</th><th>Fecha</th></tr></thead>
          <tbody>
            ${delMes.slice().sort((a,b)=> new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()).map(s=>{
              const mejor = s.items?.[0]?.cotizaciones?.[s.items[0]?.mejorCotizacionIndex ?? 0];
              const valor = s.items?.reduce((acc,it)=>{
                const cot = it.cotizaciones?.[it.mejorCotizacionIndex ?? 0];
                return acc + (cot?.total || it.precioUnitario * it.cantidad || 0);
              },0) || 0;
              const tr = s.fechaCotizacion ? Math.round((new Date(s.fechaCotizacion).getTime() - new Date(s.fechaCreacion).getTime())/36e5) : null;
              const trTxt = tr===null ? '—' : horasAHorasMinutos(tr);
              const trColor = tr===null ? '#94a3b8' : tr <=4 ? '#059669' : tr <=24 ? '#d97706' : '#dc2626';
              return `<tr data-estado="${s.estado}" data-prio="${s.prioridad||'media'}" data-q="${('#'+s.numero+' '+s.nombreUsuario+' '+ (s.items?.map(i=>i.descripcion).join(' ')||'')+' '+ (s.centroTrabajo||'')).toLowerCase()}">
                <td style="font-family:'JetBrains Mono';font-weight:700">#${s.numero}</td>
                <td><div style="font-weight:600">${s.nombreUsuario}</div><div style="font-size:11px;color:#64748b">${s.emailUsuario||''}</div></td>
                <td style="max-width:260px"><div style="white-space:normal">${s.items?.map(i=>i.descripcion).filter(Boolean).join(', ').substring(0,120)||'—'}</div><div style="font-size:11px;color:#64748b">${s.items?.length||0} items</div></td>
                <td>${s.centroTrabajo||'—'}</td>
                <td><span class="badge" style="background:${PRIORIDADES.find(p=>p.value===(s.prioridad||'media'))?.color||'#64748b'}15;color:${PRIORIDADES.find(p=>p.value===(s.prioridad||'media'))?.color}">${getPrioridadLabel(s.prioridad||'media')}</span></td>
                <td><span class="badge" style="background:${ESTADOS_SOLICITUD.find(e=>e.value===s.estado)?.color||'#64748b'}15;color:${ESTADOS_SOLICITUD.find(e=>e.value===s.estado)?.color}">${getEstadoLabel(s.estado)}</span>${s.numeroPedido?`<div style="font-size:11px;color:#64748b;font-family:monospace">\${s.numeroPedido}</div>`:``}</td>
                <td style="text-align:right;font-family:'JetBrains Mono';font-weight:700;white-space:nowrap">${formatMoney(valor)}</td>
                <td style="text-align:center;color:${trColor};font-weight:700">${trTxt}</td>
                <td style="white-space:nowrap">${format(new Date(s.fechaCreacion),'dd/MM/yy')}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#64748b">
        <span>Valores en COP con punto del mil. T. Resp. = creación → primera cotización.</span>
        <span>Total mostrado: <b id="totalValor">${valorFormateado}</b></span>
      </div>
    </div>

    <div class="foot">Reporte dinámico — ${empresa?.nombre || 'Siamo'} · ${mesNombreCap} · Generado ${format(new Date(),'dd/MM/yyyy HH:mm')} · Datos en vivo de Firestore (${delMes.length} registros) · Gráficos con Chart.js</div>
  </div>

<script>
  // Filtros tabla
  const q = document.getElementById('q');
  const fEstado = document.getElementById('fEstado');
  const fPrio = document.getElementById('fPrio');
  const rows = Array.from(document.querySelectorAll('#tabla tbody tr'));
  const countChip = document.getElementById('countChip');
  function applyFilters(){
    const qq = (q.value||'').toLowerCase();
    const fe = fEstado.value; const fp = fPrio.value;
    let visible=0;
    rows.forEach(r=>{
      const okQ = !qq || r.dataset.q.includes(qq);
      const okE = !fe || r.dataset.estado===fe;
      const okP = !fp || r.dataset.prio===fp;
      const show = okQ && okE && okP;
      r.style.display = show ? '' : 'none';
      if(show) visible++;
    });
    countChip.textContent = visible + ' registros';
  }
  q.addEventListener('input', applyFilters);
  fEstado.addEventListener('change', applyFilters);
  fPrio.addEventListener('change', applyFilters);
  function downloadCSV(){
    const header = ['Numero','Solicitante','Productos','Centro','Prioridad','Estado','Valor','TiempoResp_h','Fecha'];
    const data = rows.filter(r=>r.style.display!=='none').map(r=>{
      const tds = r.querySelectorAll('td');
      return Array.from(tds).map(td=> '"' + td.innerText.replace(/"/g,'""') + '"' ).join(',');
    });
    const csv = [header.join(','), ...data].join('\\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='reporte-${mesSeleccionado}.csv'; a.click(); URL.revokeObjectURL(url);
  }
  // Charts
  const chartData = {
    tiempos: ${JSON.stringify(chartTiempos)},
    dist: ${JSON.stringify(distribucionRespuesta)},
    prio: ${JSON.stringify(tiemposPorPrioridad)},
    estado: ${JSON.stringify(porEstado.map(p=>({label:p.nombre, value:p.value, color:p.color})))},
    solicitante: ${JSON.stringify(porSolicitante)},
    centro: ${JSON.stringify(porCentro)},
    tendencia: ${JSON.stringify(tendenciaDiaria)},
  };
  function renderCharts(){
    const ctx1 = document.getElementById('cTiempos');
    if(ctx1) new Chart(ctx1, { type:'bar', data:{ labels: chartData.tiempos.map(d=>d.nombre), datasets:[{ label:'Horas', data: chartData.tiempos.map(d=>d.horas), backgroundColor: chartData.tiempos.map(d=>d.color), borderRadius:8 }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, title:{display:true,text:'Horas'}}}}});
    const ctx2 = document.getElementById('cDist');
    if(ctx2) new Chart(ctx2, { type:'bar', data:{ labels: chartData.dist.map(d=>d.rango), datasets:[{ label:'Solicitudes', data: chartData.dist.map(d=>d.count), backgroundColor:'#f59e0b', borderRadius:8 }] }, options:{ responsive:true, plugins:{legend:{display:false}}}});
    const ctx3 = document.getElementById('cPrio');
    if(ctx3) new Chart(ctx3, { type:'bar', data:{ labels: chartData.prio.map(d=>d.prioridad), datasets:[{ label:'Cantidad', data: chartData.prio.map(d=>d.cantidad), backgroundColor:'#2563eb' },{ label:'Tiempo prom (h)', data: chartData.prio.map(d=>d.tiempoPromedio), backgroundColor:'#f59e0b' }] }, options:{ responsive:true }});
    const ctx4 = document.getElementById('cEstado');
    if(ctx4) new Chart(ctx4, { type:'doughnut', data:{ labels: chartData.estado.map(d=>d.label), datasets:[{ data: chartData.estado.map(d=>d.value), backgroundColor: chartData.estado.map(d=>d.color)}]}, options:{ responsive:true, plugins:{legend:{position:'bottom'}}}});
    const ctx5 = document.getElementById('cSol');
    if(ctx5) new Chart(ctx5, { type:'bar', data:{ labels: chartData.solicitante.map(d=>d.nombre), datasets:[{ label:'Solicitudes', data: chartData.solicitante.map(d=>d.cantidad), backgroundColor:'#2563eb', borderRadius:6 }] }, options:{ indexAxis:'y', responsive:true, plugins:{legend:{display:false}}}});
    const ctx6 = document.getElementById('cCentro');
    if(ctx6) new Chart(ctx6, { type:'bar', data:{ labels: chartData.centro.map(d=>d.nombre), datasets:[{ label:'Solicitudes', data: chartData.centro.map(d=>d.cantidad), backgroundColor:['#2563eb','#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444'] }] }, options:{ responsive:true, plugins:{legend:{display:false}}}});
    const ctx7 = document.getElementById('cTend');
    if(ctx7) new Chart(ctx7, { type:'line', data:{ labels: chartData.tendencia.map(d=>d.dia), datasets:[{ label:'Solicitudes', data: chartData.tendencia.map(d=>d.solicitudes), borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,.15)', tension:.35, fill:true, pointRadius:2 }] }, options:{ responsive:true }});
  }
  renderCharts();
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-ejecutivo-${mesSeleccionado}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setExportando(null);
  };

  // ─── EXPORT PDF ──────────────────────────────────
  const exportarPDF = () => {
    setExportando('pdf');
    const mesNombre = format(inicioMes, 'MMMM yyyy', { locale: es });
    
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Ejecutivo - ${mesNombre}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 30px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 15px; }
    .header h1 { font-size: 22px; margin-bottom: 6px; }
    .header .empresa { font-size: 16px; color: #3b82f6; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi .value { font-size: 22px; font-weight: 700; }
    .kpi .label { font-size: 10px; color: #64748b; }
    .section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; }
    .section h2 { font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .tiempo-box { text-align: center; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .tiempo-box .valor { font-size: 20px; font-weight: 700; }
    .tiempo-box .label { font-size: 9px; color: #64748b; }
    .table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .table th { background: #f8fafc; text-align: left; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
    .table td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; }
    .stat-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; }
    .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="empresa">${empresa?.nombre || 'Siamo'}</div>
    <h1>Reporte Ejecutivo de Compras</h1>
    <p>Periodo: ${mesNombre} | Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="value" style="color:#3b82f6">${stats.total}</div><div class="label">Total</div></div>
    <div class="kpi"><div class="value" style="color:#f59e0b">${stats.pendientes}</div><div class="label">Pendientes</div></div>
    <div class="kpi"><div class="value" style="color:#10b981">${stats.completadas}</div><div class="label">Completadas</div></div>
    <div class="kpi"><div class="value" style="color:#ef4444">${stats.canceladas}</div><div class="label">Canceladas</div></div>
    <div class="kpi"><div class="value" style="color:#8b5cf6">${formatMoney(stats.valorTotal)}</div><div class="label">Valor</div></div>
  </div>
  <div class="section">
    <h2>Indicadores de Tiempo</h2>
    <div class="grid-3">
      <div class="tiempo-box"><div class="valor" style="color:#f59e0b">${horasAHorasMinutos(tiempos.respuesta.promedio)}</div><div class="label">Respuesta Promedio</div></div>
      <div class="tiempo-box"><div class="valor" style="color:#3b82f6">${horasAHorasMinutos(tiempos.cotizacion.promedio)}</div><div class="label">Cotizacion Promedio</div></div>
      <div class="tiempo-box"><div class="valor" style="color:#10b981">${horasAHorasMinutos(tiempos.total.promedio)}</div><div class="label">Total Ciclo Promedio</div></div>
    </div>
  </div>
  <div class="section">
    <h2>Detalle de Solicitudes</h2>
    <table class="table">
      <thead><tr><th>#</th><th>Solicitante</th><th>Productos</th><th>Centro</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        ${delMes.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()).map(s => `
          <tr><td><strong>#${s.numero}</strong></td><td>${s.nombreUsuario}</td><td>${s.items?.map(i => i.descripcion).filter(Boolean).join(', ').substring(0, 50)}</td><td>${s.centroTrabajo || '-'}</td><td>${getEstadoLabel(s.estado)}</td><td>${format(new Date(s.fechaCreacion), 'dd/MM/yy')}</td></tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <div class="footer">Reporte generado por Plataforma de Compras - ${empresa?.nombre || 'Siamo'}</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    setExportando(null);
  };

  // ─── EXPORT EXCEL ──────────────────────────────────
  const exportarExcel = async () => {
    setExportando('excel');
    const XLSX = await import('xlsx');
    
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Resumen
    const resumenData = [
      ['REPORTE EJECUTIVO DE COMPRAS'],
      ['Empresa:', empresa?.nombre || 'Siamo'],
      ['Periodo:', format(inicioMes, 'MMMM yyyy', { locale: es })],
      [],
      ['INDICADORES DE TIEMPO'],
      ['Tiempo Respuesta Promedio (horas)', Math.round(tiempos.respuesta.promedio)],
      ['Tiempo Cotizacion Promedio (horas)', Math.round(tiempos.cotizacion.promedio)],
      ['Tiempo Aprobacion Promedio (horas)', Math.round(tiempos.aprobacion.promedio)],
      ['Tiempo Entrega Promedio (horas)', Math.round(tiempos.entrega.promedio)],
      ['Tiempo Total Promedio (horas)', Math.round(tiempos.total.promedio)],
      [],
      ['RESUMEN GENERAL'],
      ['Total Solicitudes', stats.total],
      ['Pendientes', stats.pendientes],
      ['Completadas', stats.completadas],
      ['Canceladas', stats.canceladas],
      ['Total Items', stats.totalItems],
      ['Valor Total Estimado', stats.valorTotal],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Hoja 2: Tiempos por Solicitud
    const tiemposData = [
      ['TIEMPOS POR SOLICITUD'],
      ['#', 'Solicitante', 'Estado', 'Fecha Creacion', 'Fecha Cotizacion', 'Fecha Aprobacion', 'Fecha Pedido', 'Tiempo Respuesta (h)', 'Tiempo Total (h)'],
      ...delMes.map(s => [
        `#${s.numero}`,
        s.nombreUsuario,
        getEstadoLabel(s.estado),
        format(new Date(s.fechaCreacion), 'dd/MM/yyyy HH:mm'),
        s.fechaCotizacion ? format(new Date(s.fechaCotizacion), 'dd/MM/yyyy HH:mm') : '-',
        s.fechaAprobacion ? format(new Date(s.fechaAprobacion), 'dd/MM/yyyy HH:mm') : '-',
        s.fechaPedido ? format(new Date(s.fechaPedido), 'dd/MM/yyyy HH:mm') : '-',
        s.fechaCotizacion ? Math.round(differenceInHours(new Date(s.fechaCotizacion), new Date(s.fechaCreacion))) : '-',
        s.estado === 'completada' ? Math.round(differenceInHours(new Date(s.fechaActualizacion), new Date(s.fechaCreacion))) : '-',
      ])
    ];
    const wsTiempos = XLSX.utils.aoa_to_sheet(tiemposData);
    wsTiempos['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsTiempos, 'Tiempos');

    // Hoja 3: Por Solicitante
    const solicitanteData = [
      ['DISTRIBUCION POR SOLICITANTE'],
      ['#', 'Solicitante', 'Cantidad', '% del Total'],
      ...porSolicitante.map((p, i) => [i + 1, p.nombre, p.cantidad, `${stats.total > 0 ? Math.round((p.cantidad / stats.total) * 100) : 0}%`])
    ];
    const wsSolicitante = XLSX.utils.aoa_to_sheet(solicitanteData);
    XLSX.utils.book_append_sheet(wb, wsSolicitante, 'Por Solicitante');

    // Hoja 4: Por Centro
    const centroData = [
      ['DISTRIBUCION POR CENTRO'],
      ['#', 'Centro', 'Cantidad', '% del Total'],
      ...porCentro.map((p, i) => [i + 1, p.nombre, p.cantidad, `${stats.total > 0 ? Math.round((p.cantidad / stats.total) * 100) : 0}%`])
    ];
    const wsCentro = XLSX.utils.aoa_to_sheet(centroData);
    XLSX.utils.book_append_sheet(wb, wsCentro, 'Por Centro');

    // Hoja 5: Top Productos
    const productoData = [
      ['TOP PRODUCTOS'],
      ['#', 'Producto', 'Cantidad'],
      ...porProducto.map((p, i) => [i + 1, p.nombre, p.cantidad])
    ];
    const wsProducto = XLSX.utils.aoa_to_sheet(productoData);
    XLSX.utils.book_append_sheet(wb, wsProducto, 'Top Productos');

    // Hoja 6: Tendencia Diaria
    const tendenciaData = [
      ['TENDENCIA DIARIA'],
      ['Dia', 'Solicitudes'],
      ...tendenciaDiaria.map(d => [d.dia, d.solicitudes])
    ];
    const wsTendencia = XLSX.utils.aoa_to_sheet(tendenciaData);
    XLSX.utils.book_append_sheet(wb, wsTendencia, 'Tendencia Diaria');

    XLSX.writeFile(wb, `reporte-ejecutivo-${mesSeleccionado}.xlsx`);
    setExportando(null);
  };

  if (cargando) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportes de Compras</h1>
          <p className="text-sm text-gray-500">{empresa?.nombre || 'Todas las empresas'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
          <div className="flex gap-2">
            <button onClick={exportarHTML} disabled={exportando === 'html'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {exportando === 'html' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              HTML
            </button>
            <button onClick={exportarPDF} disabled={exportando === 'pdf'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {exportando === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </button>
            <button onClick={exportarExcel} disabled={exportando === 'excel'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {exportando === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Solicitudes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{stats.pendientes}</p>
          <p className="text-xs text-gray-500">Pendientes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{stats.enCotizacion}</p>
          <p className="text-xs text-gray-500">En Cotizacion</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-green-500">{stats.completadas}</p>
          <p className="text-xs text-gray-500">Completadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.totalItems}</p>
          <p className="text-xs text-gray-500">Total Items</p>
        </div>
      </div>

      {/* Valor Total Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Valor Total Estimado del Mes</p>
            <p className="text-3xl font-bold">{formatMoney(stats.valorTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Tasa de Exito</p>
            <p className="text-2xl font-bold">{stats.total > 0 ? Math.round((stats.completadas / stats.total) * 100) : 0}%</p>
          </div>
        </div>
      </div>

      {/* Indicadores de Tiempo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Indicadores de Tiempo</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
            <Timer className="h-6 w-6 text-amber-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-600">{horasAHorasMinutos(tiempos.respuesta.promedio)}</p>
            <p className="text-[10px] text-amber-700 font-medium">Respuesta Promedio</p>
            <p className="text-[9px] text-amber-500">Creacion a Cotizacion</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{horasAHorasMinutos(tiempos.cotizacion.promedio)}</p>
            <p className="text-[10px] text-blue-700 font-medium">Cotizacion Promedio</p>
            <p className="text-[9px] text-blue-500">Analista a Proveedor</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
            <CheckCircle className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-600">{horasAHorasMinutos(tiempos.aprobacion.promedio)}</p>
            <p className="text-[10px] text-purple-700 font-medium">Aprobacion Promedio</p>
            <p className="text-[9px] text-purple-500">Cotizada a Aprobada</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4 text-center border border-cyan-200">
            <Truck className="h-6 w-6 text-cyan-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-cyan-600">{horasAHorasMinutos(tiempos.entrega.promedio)}</p>
            <p className="text-[10px] text-cyan-700 font-medium">Entrega Promedio</p>
            <p className="text-[9px] text-cyan-500">Pedido a Entregado</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{horasAHorasMinutos(tiempos.total.promedio)}</p>
            <p className="text-[10px] text-green-700 font-medium">Ciclo Total Promedio</p>
            <p className="text-[9px] text-green-500">Creacion a Completada</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
            <p className="text-2xl font-bold text-gray-600">{tiempos.respuesta.cantidad}</p>
            <p className="text-[10px] text-gray-700 font-medium">Con Tiempo Medido</p>
            <p className="text-[9px] text-gray-500">Solicitudes</p>
          </div>
        </div>
      </div>

      {/* Charts de Tiempos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tiempos Promedio por Fase (horas)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartTiempos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}h`, 'Tiempo']} />
              <Bar dataKey="horas" radius={[4, 4, 0, 0]}>
                {chartTiempos.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribucion Tiempo de Respuesta</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distribucionRespuesta}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Solicitudes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts por Prioridad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tiempos por Prioridad</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tiemposPorPrioridad}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="prioridad" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value, name) => name === 'tiempoPromedio' ? [`${value}h`, 'Tiempo Prom'] : [value, 'Cantidad']} />
              <Legend />
              <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Cantidad" />
              <Bar dataKey="tiempoPromedio" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tiempo Prom (h)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Estado</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={porEstado} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                {porEstado.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts de Distribucion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Solicitante</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={porSolicitante} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Productos</h3>
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
            {porProducto.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-gray-400 text-right">{i + 1}</span>
                <div className="flex-1 truncate text-gray-700">{p.nombre}</div>
                <span className="font-bold text-gray-900">{p.cantidad}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia Diaria</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={tendenciaDiaria}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="solicitudes" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla resumen */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Detalle de Solicitudes del Mes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Solicitante</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Productos</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Centro</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Prioridad</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">Tiempo Resp.</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {delMes.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No hay solicitudes este mes</td></tr>
              ) : (
                delMes.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()).map(s => {
                  const tiempoRespuesta = s.fechaCotizacion
                    ? differenceInHours(new Date(s.fechaCotizacion), new Date(s.fechaCreacion))
                    : null;
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-bold">#{s.numero}</td>
                      <td className="px-4 py-2">{s.nombreUsuario}</td>
                      <td className="px-4 py-2 text-gray-600 truncate max-w-[180px]">
                        {s.items?.map(i => i.descripcion).filter(Boolean).join(', ')}
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{s.centroTrabajo || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: PRIORIDADES.find(p => p.value === s.prioridad)?.color + '20',
                            color: PRIORIDADES.find(p => p.value === s.prioridad)?.color }}>
                          {getPrioridadLabel(s.prioridad || 'normal')}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: ESTADOS_SOLICITUD.find(e => e.value === s.estado)?.color + '20',
                            color: ESTADOS_SOLICITUD.find(e => e.value === s.estado)?.color }}>
                          {getEstadoLabel(s.estado)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {tiempoRespuesta !== null ? (
                          <span className={`text-xs font-medium ${tiempoRespuesta <= 4 ? 'text-green-600' : tiempoRespuesta <= 24 ? 'text-amber-600' : 'text-red-600'}`}>
                            {horasAHorasMinutos(tiempoRespuesta)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{format(new Date(s.fechaCreacion), 'dd/MM/yy')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
