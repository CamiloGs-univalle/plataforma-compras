import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase-admin';

async function logEmail(data: any) {
  try {
    if (!adminDb) return;
    await adminDb.collection('email_logs').add({
      ...data,
      timestamp: new Date(),
    });
  } catch {}
}

function isEmailConfigured() {
  const u = process.env.GMAIL_USER || '';
  const p = process.env.GMAIL_APP_PASSWORD || '';
  return !!u && !!p && !u.includes('tu_email') && !p.includes('tu_contrase') && u.includes('@');
}

const transporter = isEmailConfigured() ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
}) : null as any;

interface EmailData {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function sendEmail(data: EmailData) {
  const info = await transporter.sendMail({
    from: `"Plataforma Compras" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: data.subject,
    html: data.html,
    replyTo: data.replyTo,
  });
  return info.messageId;
}

// Templates
function templateNuevaSolicitud(solicitud: any, empresa: any) {
  const items = solicitud.items.map((item: any) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace">${item.codigoProducto}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.descripcion}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.cantidad}</td>
    </tr>`
  ).join('');

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1e40af;color:white;padding:20px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:20px">Nueva Solicitud de Compra #${solicitud.numero || 'N/A'}</h1>
      <p style="margin:5px 0 0;opacity:0.9;font-size:14px">${empresa?.nombre || 'Empresa'}</p>
    </div>
    <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
      <div style="background:white;padding:15px;border-radius:8px;margin-bottom:15px">
        <h3 style="margin:0 0 10px;color:#334155;font-size:14px">DATOS DEL SOLICITANTE</h3>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Nombre:</strong> ${solicitud.nombreUsuario}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Email:</strong> ${solicitud.emailUsuario}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Centro Trabajo:</strong> ${solicitud.centroTrabajo}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Prioridad:</strong> ${solicitud.prioridad?.toUpperCase()}</p>
        ${solicitud.fechaRequerida ? `<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Fecha Requerida:</strong> ${solicitud.fechaRequerida}</p>` : ''}
      </div>
      <div style="background:white;padding:15px;border-radius:8px;margin-bottom:15px">
        <h3 style="margin:0 0 10px;color:#334155;font-size:14px">PRODUCTOS SOLICITADOS</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Codigo</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Descripcion</th>
              <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0">Cant.</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
      </div>
      ${solicitud.observaciones ? `
      <div style="background:white;padding:15px;border-radius:8px;margin-bottom:15px">
        <h3 style="margin:0 0 10px;color:#334155;font-size:14px">OBSERVACIONES</h3>
        <p style="color:#64748b;font-size:13px;margin:0">${solicitud.observaciones}</p>
      </div>` : ''}
    </div>
    <div style="background:#f1f5f9;padding:15px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0">
      <p style="margin:0;color:#94a3b8;font-size:12px">Plataforma de Compras - Notificacion automatica</p>
    </div>
  </div>`;
}

function templateRespuestaSolicitud(solicitud: any, empresa: any, respuesta: string, nuevoEstado: string) {
  const estadoColor = nuevoEstado === 'completada' ? '#16a34a' : nuevoEstado === 'cancelada' ? '#dc2626' : '#2563eb';
  const estadoLabel = nuevoEstado === 'completada' ? 'APROBADA' : nuevoEstado === 'cancelada' ? 'RECHAZADA' : 'EN PROCESO';

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:${estadoColor};color:white;padding:20px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:20px">Solicitud #${solicitud.numero || 'N/A'} - ${estadoLabel}</h1>
      <p style="margin:5px 0 0;opacity:0.9;font-size:14px">${empresa?.nombre || 'Empresa'}</p>
    </div>
    <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
      <div style="background:white;padding:15px;border-radius:8px;margin-bottom:15px">
        <h3 style="margin:0 0 10px;color:#334155;font-size:14px">RESPUESTA DEL EQUIPO DE ABASTECIMIENTO</h3>
        <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6">${respuesta || 'Sin comentarios adicionales.'}</p>
      </div>
      <div style="background:white;padding:15px;border-radius:8px">
        <h3 style="margin:0 0 10px;color:#334155;font-size:14px">DETALLE DE LA SOLICITUD</h3>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Solicitante:</strong> ${solicitud.nombreUsuario}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Estado:</strong> <span style="color:${estadoColor};font-weight:bold">${estadoLabel}</span></p>
        <p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Productos:</strong> ${solicitud.items?.length || 0} items</p>
      </div>
    </div>
    <div style="background:#f1f5f9;padding:15px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0">
      <p style="margin:0;color:#94a3b8;font-size:12px">Plataforma de Compras - Notificacion automatica</p>
    </div>
  </div>`;
}

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {}
  try {
    // Intenta Apps Script primero (hilo único) — server-side sin CORS
    const appsUrl = process.env.APPS_SCRIPT_URL;
    if (appsUrl && body?.tipo === 'nueva_solicitud') {
      try {
        const r = await fetch(appsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'nueva_solicitud_compra',
            solicitud: {
              numero: body.solicitud.numero,
              nombreUsuario: body.solicitud.nombreUsuario,
              emailUsuario: body.solicitud.emailUsuario,
              centroTrabajo: body.solicitud.centroTrabajo,
              prioridad: body.solicitud.prioridad,
              fechaRequerida: body.solicitud.fechaRequerida,
              observaciones: body.solicitud.observaciones,
              items: body.solicitud.items,
              archivos: body.solicitud.archivos || [],
            },
            empresa: body.empresa ? { nombre: body.empresa.nombre } : null,
            analistaEmail: body.emailDestino || 'camilo13369@gmail.com',
          }),
        });
        const j = await r.json();
        if (j.success) {
          logEmail({ tipo: 'nueva_solicitud', via: 'apps-script', to: body.emailDestino || 'camilo13369@gmail.com', subject: `Nueva Solicitud #${body.solicitud.numero}`, threadId: j.data?.threadId, solicitudNumero: body.solicitud.numero, estado: 'enviado' });
          return NextResponse.json({ success: true, via: 'apps-script', threadId: j.data?.threadId });
        }
        console.warn('Apps Script respondió sin success:', j);
      } catch (e) {
        console.warn('Apps Script falló, fallback a SMTP', e);
      }
    }

    if (!isEmailConfigured()) {
      console.warn('Email no configurado — GMAIL_USER/GMAIL_APP_PASSWORD faltan. Solicitud guardada sin envio.');
      return NextResponse.json({ success: true, skipped: true, message: 'Email no configurado, se omitio el envio' });
    }
    const { tipo, solicitud, empresa, respuesta, nuevoEstado, emailDestino } = body || {};

    let subject = '';
    let html = '';
    let to = '';
    let replyTo = '';

    // Si viene threadId/subject es seguimiento en mismo hilo → intenta Apps Script primero
    const appsUrlThread = process.env.APPS_SCRIPT_URL;
    if (appsUrlThread && (body.threadId || body.subject) && (tipo === 'respuesta_solicitud' || body.threadId)) {
      try {
        const r = await fetch(appsUrlThread, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'respuesta_analista',
            solicitud: { numero: solicitud?.numero, id: solicitud?.id },
            threadId: body.threadId || '',
            subject: body.subject || `Re: [SOL-#${solicitud?.numero}]`,
            html: respuesta || html,
            to: emailDestino || solicitud?.emailUsuario || 'camilo13369@gmail.com',
            estado: nuevoEstado || 'actualizacion',
          }),
        });
        const j = await r.json();
        if (j.success) {
          logEmail({ tipo: 'respuesta_solicitud', via: 'apps-script-thread', to: emailDestino || solicitud?.emailUsuario, subject: body.subject, threadId: j.data?.threadId || body.threadId, solicitudNumero: solicitud?.numero, estado: nuevoEstado, reply: true });
          return NextResponse.json({ success: true, via: 'apps-script-thread', threadId: j.data?.threadId });
        }
      } catch (e) { console.warn('Apps Script hilo falló, fallback SMTP', e); }
    }

    switch (tipo) {
      case 'nueva_solicitud':
        to = emailDestino || process.env.GMAIL_USER;
        subject = `Nueva Solicitud de Compra #${solicitud.numero || ''} - ${empresa?.nombre || ''}`;
        html = templateNuevaSolicitud(solicitud, empresa);
        replyTo = solicitud.emailUsuario;
        break;

      case 'respuesta_solicitud':
        to = emailDestino || solicitud.emailUsuario;
        // Usa subject del hilo si viene, para mantener [SOL-#]
        subject = body.subject || `Solicitud #${solicitud.numero || ''} - ${nuevoEstado === 'completada' ? 'Aprobada' : nuevoEstado === 'cancelada' ? 'Rechazada' : 'Actualizada'} - ${empresa?.nombre || ''}`;
        html = respuesta && respuesta.includes('<') ? respuesta : templateRespuestaSolicitud(solicitud, empresa, respuesta, nuevoEstado);
        break;

      default:
        return NextResponse.json({ error: 'Tipo no valido' }, { status: 400 });
    }

    const messageId = await sendEmail({ to, subject, html, replyTo });
    logEmail({ tipo, via: 'smtp', to, subject, messageId, solicitudNumero: solicitud?.numero, estado: nuevoEstado });
    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
