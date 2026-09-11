'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { obtenerTodasSolicitudesEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import { motion } from 'motion/react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, StatusBadge, Skeleton } from '@/components/ui';
import {
  FileText,
  Clock,
  TrendingUp,
  CheckCircle2,
  Package,
  ArrowRight,
  Plus,
  ShoppingCart,
  AlertCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sol) => {
      setSolicitudes(sol);
      setCargando(false);
    });
    return () => unsub();
  }, [empresa?.id]);

  const stats = useMemo(() => {
    const total = solicitudes.length;
    const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
    const enCotizacion = solicitudes.filter(s => s.estado === 'en_cotizacion').length;
    const cotizadas = solicitudes.filter(s => s.estado === 'cotizada').length;
    const aprobadas = solicitudes.filter(s => s.estado === 'aprobada').length;
    const completadas = solicitudes.filter(s => s.estado === 'completada').length;
    const urgentes = solicitudes.filter(s => s.prioridad === 'urgente').length;
    const totalItems = solicitudes.reduce((acc, s) => acc + (s.items?.length || 0), 0);

    return { total, pendientes, enCotizacion, cotizadas, aprobadas, completadas, urgentes, totalItems };
  }, [solicitudes]);

  const ultimasSolicitudes = useMemo(() => {
    return [...solicitudes]
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
      .slice(0, 5);
  }, [solicitudes]);

  const solicitudesUrgentes = useMemo(() => {
    return solicitudes
      .filter(s => s.prioridad === 'urgente' && s.estado !== 'completada' && s.estado !== 'cancelada')
      .slice(0, 3);
  }, [solicitudes]);

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Hola, {usuario?.nombre?.split(' ')[0] || 'Usuario'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Aqui tienes un resumen de tus solicitudes de compra
            </p>
          </div>
          <Button onClick={() => router.push('/nueva-solicitud')} size="lg" className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
            <Plus className="h-5 w-5 mr-2" />
            Nueva Solicitud
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600/80">Total Solicitudes</p>
                  <p className="text-4xl font-bold text-blue-700 mt-2">{stats.total}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-blue-600/70">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>Activo</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600/80">Pendientes</p>
                  <p className="text-4xl font-bold text-amber-700 mt-2">{stats.pendientes}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-amber-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-amber-600/70">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>Requieren atencion</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600/80">En Cotizacion</p>
                  <p className="text-4xl font-bold text-purple-700 mt-2">{stats.enCotizacion}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <ShoppingCart className="h-7 w-7 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-purple-600/70">
                <BarChart3 className="h-4 w-4 mr-1" />
                <span>En proceso</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600/80">Completadas</p>
                  <p className="text-4xl font-bold text-green-700 mt-2">{stats.completadas}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-green-600/70">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                <span>Finalizadas</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Solicitudes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <CardTitle className="text-lg">Ultimas Solicitudes</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/solicitudes')}
                className="text-primary hover:text-primary/80"
              >
                Ver todas
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ultimasSolicitudes.length === 0 ? (
                  <div className="py-16 text-center">
                    <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No hay solicitudes aun</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Crea tu primera solicitud para comenzar</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/nueva-solicitud')}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear solicitud
                    </Button>
                  </div>
                ) : (
                  ultimasSolicitudes.map((solicitud, index) => (
                    <motion.div
                      key={solicitud.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/admin/solicitudes/${solicitud.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">
                              Solicitud #{solicitud.numero}
                            </p>
                            {solicitud.prioridad === 'urgente' && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                URGENTE
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {solicitud.nombreUsuario} - {solicitud.centroTrabajo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge variant={solicitud.estado as any} />
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-1" />
                          {solicitud.fechaCreacion?.toLocaleDateString?.() || ''}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="space-y-6"
        >
          {/* Quick Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Acciones Rapidas</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/20"
                  onClick={() => router.push('/nueva-solicitud')}
                >
                  <Plus className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Nueva Solicitud</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/20"
                  onClick={() => router.push('/admin/solicitudes')}
                >
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Ver Solicitudes</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/20"
                  onClick={() => router.push('/admin/productos')}
                >
                  <Package className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Productos</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/20"
                  onClick={() => router.push('/admin/reportes')}
                >
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Reportes</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Urgent Items */}
          {solicitudesUrgentes.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {solicitudesUrgentes.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/solicitudes/${solicitud.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">#{solicitud.numero}</p>
                          <p className="text-xs text-muted-foreground">{solicitud.nombreUsuario}</p>
                        </div>
                        <StatusBadge variant={solicitud.estado as any} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Resumen del Mes</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Items</span>
                  <span className="font-bold text-primary">{stats.totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Aprobadas</span>
                  <span className="font-bold text-green-600">{stats.aprobadas}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Urgentes</span>
                  <span className="font-bold text-red-600">{stats.urgentes}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
