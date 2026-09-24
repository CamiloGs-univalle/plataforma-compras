import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type Action =
  | 'aprobar'
  | 'rechazar'
  | 'enviar_cotizacion'
  | 'cotizar'
  | 'generar_pedido'
  | 'completar'
  | 'actualizar_estado'
  | 'agregar_archivo'
  | 'archivar'
  | 'archivar_factura';

interface PatchBody {
  action: Action;
  motivo?: string;
  numeroPedido?: string;
  items?: any[];
  usuarioUid: string;
  usuarioNombre: string;
  nuevoEstado?: string;
  archivo?: { nombre: string; descripcion: string; base64: string; tipo?: string; tamano?: number };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firebase Admin no está configurado' },
      { status: 500 }
    );
  }

  try {
    const { id } = await params;
    const body: PatchBody = await request.json();
    const { action, motivo, numeroPedido, items, usuarioUid, usuarioNombre, nuevoEstado } = body;

    if (!action || !usuarioUid || !usuarioNombre) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: action, usuarioUid, usuarioNombre' },
        { status: 400 }
      );
    }

    const solicitudRef = adminDb.collection('solicitudes').doc(id);
    const solicitudSnap = await solicitudRef.get();

    if (!solicitudSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'La solicitud no existe' },
        { status: 404 }
      );
    }

    const notasRef = solicitudRef.collection('notas');
    const now = FieldValue.serverTimestamp();

    switch (action) {
      case 'aprobar': {
        const updateData: Record<string, any> = {
          estado: 'aprobada',
          aprobadoPor: usuarioUid,
          aprobadoPorNombre: usuarioNombre,
          fechaAprobacion: now,
          fechaActualizacion: now,
        };
        if (items) updateData.items = items;

        await solicitudRef.update(updateData);
        await notasRef.add({
          texto: `${usuarioNombre} aprobo la cotizacion`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'aprobacion',
        });
        break;
      }

      case 'rechazar': {
        if (!motivo) {
          return NextResponse.json(
            { success: false, error: 'El motivo es requerido para rechazar' },
            { status: 400 }
          );
        }
        await solicitudRef.update({
          estado: 'en_cotizacion',
          motivoRechazo: motivo,
          fechaActualizacion: now,
        });
        await notasRef.add({
          texto: `${usuarioNombre} rechazo la cotizacion. Motivo: ${motivo}`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'rechazo',
        });
        break;
      }

      case 'enviar_cotizacion': {
        await solicitudRef.update({
          estado: 'en_cotizacion',
          fechaActualizacion: now,
        });
        await notasRef.add({
          texto: `${usuarioNombre} inicio el proceso de cotizacion`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'cotizacion',
        });
        break;
      }

      case 'cotizar': {
        if (!items) {
          return NextResponse.json(
            { success: false, error: 'Los items son requeridos para cotizar' },
            { status: 400 }
          );
        }

        const cleanItems = items.map((item: any) => {
          const clean: any = {};
          for (const [key, val] of Object.entries(item)) {
            if (val !== undefined) clean[key] = val;
          }
          if (clean.cotizaciones) {
            clean.cotizaciones = clean.cotizaciones.map((cot: any) => {
              const cleanCot: any = {};
              for (const [k, v] of Object.entries(cot)) {
                if (v !== undefined) cleanCot[k] = v;
              }
              return cleanCot;
            });
          }
          return clean;
        });

        await solicitudRef.update({
          items: cleanItems,
          estado: 'cotizada',
          cotizadoPor: usuarioUid,
          cotizadoPorNombre: usuarioNombre,
          fechaCotizacion: now,
          fechaActualizacion: now,
        });
        await notasRef.add({
          texto: `${usuarioNombre} envio la cotizacion con ${items.filter((i: any) => i.cotizaciones?.length > 0).length} items cotizados`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'cotizacion',
        });
        // Actualizar precioUnitario del producto si estaba en 0 o viene un nuevo valor (muchos productos estan en 0)
        try {
          const empresaId = (solicitudSnap.data() as any).empresaId;
          for (const it of items as any[]) {
            const codigo = (it as any).codigoProducto;
            const cotIdx = (it as any).mejorCotizacionIndex ?? 0;
            const cot = (it as any).cotizaciones?.[cotIdx] ?? (it as any).cotizaciones?.[0];
            const precioNuevo = cot?.precioUnitario ?? (it as any).precioUnitario;
            if (!codigo || !precioNuevo || Number(precioNuevo) <= 0) continue;
            const snapProd = await adminDb.collection('productos').where('empresaId', '==', empresaId).where('codigo', '==', codigo).limit(1).get();
            if (!snapProd.empty) {
              const docProd = snapProd.docs[0];
              const dataProd = docProd.data() as any;
              const precioActual = Number(dataProd.precioUnitario) || 0;
              if (precioActual === 0 || precioActual !== Number(precioNuevo)) {
                await docProd.ref.update({ precioUnitario: Number(precioNuevo), fechaActualizacion: now });
              }
            }
          }
        } catch (e) {
          console.error('Error actualizando precioUnitario de productos:', e);
        }
        break;
      }

      case 'generar_pedido': {
        // Auto-genera orden de compra si no se provee
        let numeroFinal = numeroPedido;
        if (!numeroFinal) {
          const snap = await adminDb.collection('solicitudes').where('numeroPedido', '!=', null).get();
          let maxNum = 0;
          snap.docs.forEach((d: any) => {
            const n = d.data().numeroPedido || '';
            const m = n.match(/(\d+)\s*$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
          });
          const next = maxNum + 1;
          const year = new Date().getFullYear();
          numeroFinal = `OC-${year}-${String(next).padStart(4, '0')}`;
        }
        await solicitudRef.update({
          estado: 'en_pedido',
          numeroPedido: numeroFinal,
          fechaPedido: now,
          fechaActualizacion: now,
        });
        await notasRef.add({
          texto: `${usuarioNombre} genero la orden de compra #${numeroFinal}`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'general',
        });
        return NextResponse.json({ success: true, numeroPedido: numeroFinal });
      }

      case 'completar': {
        await solicitudRef.update({
          estado: 'completada',
          archivado: true,
          fechaArchivado: now,
          fechaActualizacion: now,
        });
        await notasRef.add({
          texto: `${usuarioNombre} marcó como completada y se archivó automáticamente al historial`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'general',
        });
        break;
      }

      case 'actualizar_estado': {
        if (!nuevoEstado) {
          return NextResponse.json(
            { success: false, error: 'nuevoEstado es requerido para actualizar_estado' },
            { status: 400 }
          );
        }
        const autoArchivar = ['completada','cancelada'].includes(nuevoEstado);
        await solicitudRef.update({
          estado: nuevoEstado,
          ...(autoArchivar ? { archivado: true, fechaArchivado: now } : { archivado: false }),
          fechaActualizacion: now,
        } as any);
        await notasRef.add({
          texto: `${usuarioNombre} cambió el estado a ${nuevoEstado}${autoArchivar ? ' y se archivó automáticamente' : ''}`,
          autor: usuarioNombre,
          fecha: now,
          tipo: 'general',
        });
        break;
      }

      case 'agregar_archivo': {
        const { archivo } = body as any;
        if (!archivo?.base64 || !archivo?.nombre) {
          return NextResponse.json({ success: false, error: 'Archivo requerido' }, { status: 400 });
        }
        const snap = await solicitudRef.get();
        const data = snap.data() as any;
        const lista = Array.isArray(data.archivos) ? data.archivos : [];
        const nuevo = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          nombre: archivo.nombre,
          descripcion: archivo.descripcion || '',
          base64: archivo.base64,
          tipo: archivo.tipo || 'application/pdf',
          tamano: archivo.tamano || 0,
          fecha: new Date(),
          autor: usuarioNombre,
        };
        await solicitudRef.update({ archivos: [...lista, nuevo], fechaActualizacion: now });
        await notasRef.add({ texto: `${usuarioNombre} adjunto ${archivo.nombre} — ${archivo.descripcion || 'sin descripción'}`, autor: usuarioNombre, fecha: now, tipo: 'general' });
        return NextResponse.json({ success: true, archivo: nuevo });
      }

      case 'archivar': {
        await solicitudRef.update({ archivado: true, fechaArchivado: now, fechaActualizacion: now });
        await notasRef.add({ texto: `${usuarioNombre} archivó la solicitud (historial)`, autor: usuarioNombre, fecha: now, tipo: 'general' });
        break;
      }

      case 'archivar_factura': {
        const facturaEstado = (body as any).facturaEstado || 'pagada';
        await solicitudRef.update({ facturaEstado, fechaFacturaArchivado: facturaEstado === 'pagada' ? now : null, archivado: facturaEstado === 'pagada' ? true : false, fechaArchivado: facturaEstado === 'pagada' ? now : null, fechaActualizacion: now } as any);
        await notasRef.add({ texto: `${usuarioNombre} marcó factura como ${facturaEstado} ${facturaEstado==='pagada'?'y archivó':''}`, autor: usuarioNombre, fecha: now, tipo: 'general' });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Accion no soportada: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en PATCH /api/solicitudes/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
