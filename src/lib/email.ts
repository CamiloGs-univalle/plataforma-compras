import type { Solicitud, Empresa } from '@/types';

const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_EMAIL_NOTIFICACIONES || process.env.GMAIL_USER || '';

export async function enviarCorreoNuevaSolicitud(solicitud: Solicitud & { id: string }, empresa: Empresa | null, emailDestino?: string) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'nueva_solicitud',
        solicitud: {
          numero: solicitud.numero,
          id: solicitud.id || String(solicitud.numero),
          nombreUsuario: solicitud.nombreUsuario,
          emailUsuario: solicitud.emailUsuario,
          centroTrabajo: solicitud.centroTrabajo,
          prioridad: solicitud.prioridad,
          fechaRequerida: solicitud.fechaRequerida,
          observaciones: solicitud.observaciones,
          items: solicitud.items,
          archivos: (solicitud as any).archivos || [],
        },
        empresa,
        emailDestino: emailDestino || FALLBACK_EMAIL,
      }),
    });
    const data = await res.json();
    if (!data.success && !data.skipped) throw new Error(data.error);
    if (data.skipped) {
      if (process.env.NODE_ENV !== 'production') console.warn('Email omitido:', data.message);
    } else if (process.env.NODE_ENV !== 'production') console.log('Email enviado via:', data.via || 'smtp', data.threadId || '');
    // Guardar threadId si viene de Apps Script
    if (data.threadId && solicitud.id) {
      try {
        const { actualizarSolicitud } = await import('@/lib/firestore');
        await actualizarSolicitud(solicitud.id, { threadId: data.threadId } as unknown as Partial<Solicitud>);
      } catch {}
    }
    return true;
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('Aviso email (no bloquea solicitud):', error);
    return false;
  }
}

export async function enviarCorreoSeguimiento(solicitud: Solicitud, estado: string, threadId?: string, html?: string) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'respuesta_solicitud',
        solicitud: { numero: solicitud.numero, nombreUsuario: solicitud.nombreUsuario, emailUsuario: solicitud.emailUsuario, items: solicitud.items },
        empresa: null,
        respuesta: html || `Estado actualizado a ${estado}`,
        nuevoEstado: estado,
        emailDestino: FALLBACK_EMAIL || (() => { throw new Error('FALLBACK_EMAIL no configurado'); })(),
        threadId,
      }),
    });
    const data = await res.json();
    return !!data.success;
  } catch { return false; }
}

export async function enviarCorreoRespuesta(
  solicitud: Solicitud,
  empresa: Empresa | null,
  respuesta: string,
  nuevoEstado: string
) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'respuesta_solicitud',
        solicitud: {
          numero: solicitud.numero,
          nombreUsuario: solicitud.nombreUsuario,
          emailUsuario: solicitud.emailUsuario,
          items: solicitud.items,
        },
        empresa,
        respuesta,
        nuevoEstado,
        emailDestino: solicitud.emailUsuario,
      }),
    });
    const data = await res.json();
    if (!data.success && !data.skipped) throw new Error(data.error);
    if (data.skipped && process.env.NODE_ENV !== 'production') console.warn('Email omitido:', data.message);
    return true;
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('Aviso email (no bloquea):', error);
    return false;
  }
}
